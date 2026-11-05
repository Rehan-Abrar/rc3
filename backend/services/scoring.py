"""One authoritative scoring implementation.

Every path that turns dimension scores into a weighted total goes through here: the live
assessment pipeline, the deterministic re-score after a weights change, and the What-If
ranking simulator. If the maths lived in two places they would drift, and the breakdown the
recruiter sees would stop reproducing the number above it.
"""
from __future__ import annotations

import json
from decimal import Decimal

DIMENSIONS = ("skills", "experience", "projects", "qualifications")
LABELS = {"skills": "Skills", "experience": "Experience",
          "projects": "Project relevance", "qualifications": "Qualifications"}
DEFAULT_WEIGHTS = {"skills": 50.0, "experience": 25.0, "projects": 15.0, "qualifications": 10.0}
TOTAL = 100.0
TOLERANCE = Decimal("0.001")  # percentages are two decimals; 33.33 + 33.33 + 33.34 must pass


class WeightsError(ValueError):
    """A weights configuration the API must reject, with a recruiter-readable reason."""


def _dec(value) -> Decimal:
    """Percentages arrive as JSON numbers; convert without binary-float surprises."""
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool) or value is None:
        raise WeightsError("Weights must be numbers between 0 and 100.")
    try:
        return Decimal(str(value))
    except Exception as exc:  # noqa: BLE001
        raise WeightsError("Weights must be numbers between 0 and 100.") from exc


def validate(raw: dict) -> dict:
    """Return a clean {dimension: float} or raise WeightsError explaining exactly what is wrong."""
    if not isinstance(raw, dict):
        raise WeightsError("Weights must be an object with skills, experience, projects "
                           "and qualifications.")
    missing = [d for d in DIMENSIONS if d not in raw]
    if missing:
        raise WeightsError("Missing weight(s): " + ", ".join(missing) +
                           ". All four dimensions must be supplied.")
    unknown = [k for k in raw if k not in DIMENSIONS]
    if unknown:
        raise WeightsError("Unknown dimension(s): " + ", ".join(unknown) +
                           ". Allowed: " + ", ".join(DIMENSIONS) + ".")
    clean: dict[str, float] = {}
    for d in DIMENSIONS:
        value = _dec(raw[d])
        if value < 0 or value > 100:
            raise WeightsError(f"{LABELS[d]} weight must be between 0 and 100 (got {raw[d]}).")
        if value.as_tuple().exponent < -2:
            raise WeightsError(f"{LABELS[d]} weight may have at most two decimals (got {raw[d]}).")
        clean[d] = float(value)
    total = sum(_dec(v) for v in clean.values())
    if abs(total - Decimal(str(TOTAL))) > TOLERANCE:
        raise WeightsError(f"Weights must sum to 100% (they sum to {_fmt(total)}%). "
                           "Adjust a dimension by " + _fmt(Decimal(str(TOTAL)) - total) + " points.")
    return clean


def _fmt(value: Decimal) -> str:
    text = format(value.normalize(), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def from_job(job) -> dict:
    """The configured weights of a job row. Old rows without columns fall back to the default."""
    raw = {d: getattr(job, f"weight_{d}", None) for d in DIMENSIONS}
    if any(v is None for v in raw.values()):
        return dict(DEFAULT_WEIGHTS)
    try:
        return validate(raw)
    except WeightsError:
        # A corrupted row must not take the ranking down; fall back and say so in the audit.
        return dict(DEFAULT_WEIGHTS)


def to_percent(weights: dict) -> dict:
    return {d: float(weights.get(d, DEFAULT_WEIGHTS[d])) for d in DIMENSIONS}


def combine_dimensions(dims: dict, weights: dict) -> dict:
    """Weighted total over the dimensions that were actually measured.

    `dims` maps a dimension to a 0-100 score, or to None when the job does not measure it.
    Unmeasured dimensions are excluded and the remaining weights are renormalised
    proportionally - a configured weight is never silently applied to a dimension that was
    not scored, and a measured zero stays a real zero.
    """
    configured = to_percent(weights)
    present = {k: float(v) for k, v in dims.items() if v is not None}
    not_measured = [k for k in DIMENSIONS if k not in present]
    total_w = sum(configured[k] for k in present)
    if total_w <= 0:
        return {"overall": 0.0, "effective_weights": {k: 0.0 for k in DIMENSIONS},
                "not_measured": not_measured, "configured_weights": configured,
                "exhausted": True,
                "note": ("All configured weight sits on dimensions this role does not measure, "
                         "so there is nothing to weigh. Adjust the weights or add requirements "
                         "the assessment can score.")}
    effective = {k: (round(configured[k] / total_w, 4) if k in present else 0.0) for k in DIMENSIONS}
    overall = sum(effective[k] * present[k] for k in present)
    return {"overall": round(overall, 2), "effective_weights": effective,
            "not_measured": not_measured, "configured_weights": configured,
            "exhausted": False, "note": ""}


def contributions(dims: dict, before: dict, after: dict) -> dict:
    """Per-dimension contribution to the change in overall, in score points.

    Each term is (new effective weight x dimension) - (old effective weight x dimension), so
    the terms sum to the change in overall. That is what lets the simulator say which weights
    moved a candidate rather than just that the number changed.
    """
    out = {}
    for d in DIMENSIONS:
        dim = dims.get(d)
        if dim is None:
            out[d] = 0.0
            continue
        out[d] = round(after["effective_weights"][d] * dim
                       - before["effective_weights"][d] * dim, 2)
    return out


def assess_dims(assessment) -> dict | None:
    """Dimension scores stored on an assessment row, with unmeasured ones as None.

    Returns None when the row predates the not_measured bookkeeping: without it we cannot
    tell a measured zero from an excluded dimension, and guessing would invert the meaning of
    the score, so callers must report it instead of recomputing.
    """
    payload = {}
    try:
        payload = json.loads(getattr(assessment, "payload_json", "") or "{}")
    except Exception:  # noqa: BLE001
        payload = {}
    if "not_measured" not in payload:
        return None
    excluded = set(payload["not_measured"])
    stored = payload.get("dims") or {}
    return {d: (None if d in excluded else
                float(stored.get(d) if stored.get(d) is not None
                      else getattr(assessment, f"{d}_score") or 0.0))
            for d in DIMENSIONS}


# --------------------------------------------------------------------------- persistence
def refresh_assessment(db, assessment, job, *, commit: bool = True) -> dict:
    """Re-derive a stored assessment's overall from its dimension scores under `job`'s weights.

    Only arithmetic moves: the dimension scores, the evidence rows and every verdict stay
    exactly as the AI produced them. Returns a small report so callers can log what happened
    instead of pretending everything was recalculated.
    """
    dims = assess_dims(assessment)
    if dims is None:
        return {"updated": False, "reason": "missing_not_measured",
                "detail": ("This assessment predates the not-measured bookkeeping, so its "
                           "overall cannot be re-derived without guessing.")}
    weights = from_job(job)
    out = combine_dimensions(dims, weights)
    changed = abs(float(assessment.overall or 0.0) - out["overall"]) > 0.005
    assessment.overall = out["overall"]
    payload = json.loads(assessment.payload_json or "{}")
    payload["configured_weights"] = weights
    payload["effective_weights"] = out["effective_weights"]
    payload["not_measured"] = out["not_measured"]
    payload["weights_version"] = int(getattr(job, "scoring_version", 1) or 1)
    if out["exhausted"]:
        payload["weights_note"] = out["note"]
    else:
        payload.pop("weights_note", None)
    assessment.payload_json = json.dumps(payload)
    assessment.weights_json = json.dumps(weights)
    assessment.weights_version = int(getattr(job, "scoring_version", 1) or 1)
    if commit:
        db.flush()
    return {"updated": True, "changed": changed, "overall": out["overall"],
            "dims": dims, "weights": weights, "result": out}


def _payload(assessment) -> dict:
    try:
        return json.loads(getattr(assessment, "payload_json", "") or "{}")
    except json.JSONDecodeError:
        return {}


def is_stale(assessment, job) -> bool:
    """True when the stored total was produced under a different configuration.

    A row that has no configuration snapshot is also considered stale: without it we cannot
    prove which weights produced the number, and transparency is the point of this feature.
    """
    if int(getattr(assessment, "weights_version", 0) or 0) != int(
            getattr(job, "scoring_version", 1) or 1):
        return True
    return not _payload(assessment).get("configured_weights")


def ensure_current(db, assessment, job) -> dict:
    """Safety net for reads: a cached score must never be served under a newer configuration."""
    if assessment is None or job is None:
        return {"updated": False, "reason": "no_assessment"}
    if not is_stale(assessment, job):
        return {"updated": False, "reason": "current"}
    return refresh_assessment(db, assessment, job, commit=False)


def recalculate_job(db, job, *, commit: bool = False) -> dict:
    """Re-derive every stored assessment for a job. No LLM, no re-parsing, no evidence change."""
    import models as m
    from sqlalchemy import select

    rows = db.scalars(select(m.Assessment)
                      .join(m.Application, m.Application.id == m.Assessment.application_id)
                      .where(m.Application.job_id == job.id)).all()
    updated = changed = skipped = 0
    skipped_rows = []
    for a in rows:
        report = refresh_assessment(db, a, job, commit=False)
        if report["updated"]:
            updated += 1
            changed += 1 if report["changed"] else 0
        else:
            skipped += 1
            skipped_rows.append({"application_id": a.application_id,
                                 "reason": report["reason"]})
    if commit:
        db.commit()
    return {"assessments": len(rows), "updated": updated, "score_changed": changed,
            "skipped": skipped, "skipped_rows": skipped_rows}


# --------------------------------------------------------------------------- simulation
def simulate(applicants: list[dict], weights: dict) -> dict:
    """Rank the given applications under `weights`. Pure: touches no database, calls no model.

    Each input row is {application_id, candidate, stage, dims, current_overall, configured,
    override_score, override_reason, not_measured, confidence, insufficient_evidence}.
    """
    clean = validate(weights)
    rows = []
    for item in applicants:
        dims = item.get("dims")
        if dims is None:
            rows.append({
                "application_id": item["application_id"],
                "candidate": item.get("candidate"),
                "stage": item.get("stage"),
                "current_score": item.get("current_overall"),
                "simulated_score": None,
                "ranking_score": None,
                "current_rank": None, "simulated_rank": None, "movement": None,
                "override_score": item.get("override_score"),
                "override_reason": item.get("override_reason"),
                "not_measured": item.get("not_measured", []),
                "confidence": item.get("confidence"),
                "insufficient_evidence": item.get("insufficient_evidence"),
                "contributions": {},
                "effective_weights": {},
                "configured_weights": clean,
                "warnings": ["incomplete_assessment"],
            })
            continue
        before = combine_dimensions(dims, item.get("configured") or clean)
        after = combine_dimensions(dims, clean)
        # A recruiter override is a human decision, not an AI score: keep it in the ranking
        # and label it, rather than silently letting arithmetic outvote the recruiter.
        override = item.get("override_score")
        sim_effective = float(override) if override is not None else after["overall"]
        rows.append({
            "application_id": item["application_id"],
            "candidate": item.get("candidate"),
            "stage": item.get("stage"),
            "current_score": item.get("current_overall"),
            "simulated_score": after["overall"],
            "ranking_score": sim_effective,
            "override_score": override,
            "override_reason": item.get("override_reason"),
            "not_measured": after["not_measured"],
            "confidence": item.get("confidence"),
            "insufficient_evidence": item.get("insufficient_evidence"),
            "contributions": contributions(dims, before, after),
            "effective_weights": after["effective_weights"],
            "configured_weights": after["configured_weights"],
            "warnings": (["weights_exhausted"] if after["exhausted"] else []),
        })

    def rank_of(rows_: list[dict], key: str) -> dict[int, int]:
        scored = [r for r in rows_ if r.get(key) is not None]
        scored.sort(key=lambda r: (-float(r[key]), r["application_id"]))
        ranks: dict[int, int] = {}
        previous = None
        for index, row in enumerate(scored, start=1):
            value = float(row[key])
            if previous is not None and abs(value - previous) < 0.005:
                ranks[row["application_id"]] = ranks[scored[index - 2]["application_id"]]
            else:
                ranks[row["application_id"]] = index
            previous = value
        return ranks

    current = rank_of(rows, "current_score")
    simulated = rank_of(rows, "ranking_score")
    for row in rows:
        row["current_rank"] = current.get(row["application_id"])
        row["simulated_rank"] = simulated.get(row["application_id"])
        if row["current_rank"] is not None and row["simulated_rank"] is not None:
            row["movement"] = row["current_rank"] - row["simulated_rank"]  # + = moved up
    ordered = sorted(rows, key=lambda r: (r["simulated_rank"] is None,
                                          r["simulated_rank"] or 0,
                                          -(r.get("ranking_score") or 0)))
    scored_rows = [r for r in ordered if r.get("simulated_score") is not None]
    return {
        "weights": clean,
        "effective_weights": (scored_rows[0]["effective_weights"] if scored_rows else {}),
        "rows": ordered,
        "moved_up": sum(1 for r in ordered if (r.get("movement") or 0) > 0),
        "moved_down": sum(1 for r in ordered if (r.get("movement") or 0) < 0),
        "incomplete": sum(1 for r in ordered if r["simulated_score"] is None),
        "note": ("Simulation only. Nothing was saved: official scores, rankings, stages, "
                 "notes and interview decisions are unchanged."),
    }
