"""Evidence-grounded candidate assessment.

Embeddings + cosine give semantic recall (never an LLM). The LLM only adjudicates
status/reason/quote for requirements it is shown, and every quote is re-verified
against the (offset-preserving masked) resume text. Scoring itself is deterministic.
"""
import json
import re

from services import embeddings, fairness, llm, scoring, skills

WEIGHTS = {"skills": 0.50, "experience": 0.25, "projects": 0.15, "qualifications": 0.10}
IMPORTANCE_FACTOR = {"required": 1.0, "preferred": 0.4}
STATUS_SCORE = {"matched": 1.0, "partial": 0.5, "not_evidenced": 0.0, "confirmed_absent": 0.0}

ADJUDICATE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "requirements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": "integer"},
                    "status": {"type": "string",
                               "enum": ["matched", "partial", "not_evidenced", "confirmed_absent"]},
                    "reason": {"type": "string"},
                    # null is legal: "not_evidenced" has nothing to quote. Strict schemas
                    # reject an unlisted null, which surfaced as a 400 for sparse resumes.
                    "quote": {"type": ["string", "null"]},
                },
                "required": ["requirement_id", "status", "reason", "quote"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "requirements"],
    "additionalProperties": False,
}

SYSTEM = """You are an evidence auditor for a recruitment system. You receive numbered resume
excerpts and a list of job requirements. For EVERY requirement decide one status:
- "matched": the excerpts explicitly evidence it (quote it verbatim).
- "partial": the excerpts show related/transferable evidence, but not the requirement itself.
- "not_evidenced": the excerpts say nothing about it. This is NOT proof the person lacks it.
- "confirmed_absent": use ONLY if the resume explicitly states they have no experience with it.
Rules:
- "quote" must be copied verbatim from the numbered excerpts, max 300 characters.
- Never infer from a person's name, gender, age, nationality, religion or marital status.
- Never claim certainty about something the text does not show.
- "reason" is one short sentence a human recruiter can check against the quote."""


def _masked_text(raw: str) -> str:
    return fairness.mask_same_length(raw or "")


def _cosine_best(req_vec, chunk_vecs) -> list[tuple[int, float]]:
    scored = [(i, embeddings.cosine(req_vec, v)) for i, v in enumerate(chunk_vecs)]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _requirements_block(reqs: list[dict]) -> str:
    lines = []
    for r in reqs:
        hint = f" (context: {r['evidence_hint']})" if r.get("evidence_hint") else ""
        lines.append(f"- id={r['id']} [{r['importance']}] {r['label']}{hint}")
    return "\n".join(lines)


def _excerpts_block(chunks: list[dict], masked: str) -> str:
    out = []
    for c in chunks:
        view = masked[c["char_start"]:c["char_end"]].strip()
        if view:
            out.append(f"[{c['id']}] {view[:1100]}")
    return "\n\n".join(out)


def _norm(text: str) -> str:
    """Whitespace/case-insensitive form used when comparing a quote with its source span."""
    return " ".join((text or "").split()).lower()


def _flat_with_map(text: str) -> tuple[str, list[int]]:
    """Whitespace-collapsed lowercase text plus, for each character, its index in `text`.

    Lets us recover real offsets for a quote that the PDF wrapped across lines, without ever
    inventing a position: we only report a span when every character maps back to the source.
    """
    chars: list[str] = []
    index: list[int] = []
    previous_space = False
    for position, char in enumerate(text):
        if char.isspace():
            if previous_space:
                continue
            chars.append(" ")
            index.append(position)
            previous_space = True
        else:
            chars.append(char.lower())
            index.append(position)
            previous_space = False
    return "".join(chars), index


def _verify(masked: str, quote: str) -> tuple[str | None, int | None, int | None, str]:
    """(quote, start, end, support). Offsets are always real positions in `masked`.

    A quote counts as verified only when its words occur at the reported span; a whitespace
    difference (the PDF wrapped the line) still qualifies and keeps its true offsets. If we
    cannot establish a source span, the quote is flagged, never given a guessed position.
    """
    q = (quote or "").strip()
    if not q:
        return None, None, None, "flagged_unverified"
    idx = masked.find(q)
    if idx >= 0:
        return q, idx, idx + len(q), "verified"
    flat_q = " ".join(q.split()).lower()
    if not flat_q:
        return None, None, None, "flagged_unverified"
    flat, index = _flat_with_map(masked)
    pos = flat.find(flat_q)
    if pos < 0:
        return q[:300], None, None, "flagged_unverified"
    start = index[pos]
    end = index[pos + len(flat_q) - 1] + 1
    # Guard the invariant we advertise: the words at [start:end] are the quote's words.
    if " ".join(masked[start:end].split()).lower() != flat_q:
        return q[:300], None, None, "flagged_unverified"
    return q, start, end, "verified"


def gate_requirements(reqs: list[dict], chunk_vecs: list[list[float]]) -> dict[int, float]:
    """Semantic recall: best cosine similarity per requirement (embeddings, not an LLM)."""
    out = {}
    for r in reqs:
        text = f"{r['label']} {r.get('evidence_hint') or ''}".strip()
        vec = embeddings.encode([text])[0]
        best = max((embeddings.cosine(vec, cv) for cv in chunk_vecs), default=0.0)
        out[r["id"]] = round(best, 4)
    return out


def adjudicate(reqs: list[dict], chunks: list[dict], masked: str) -> tuple[dict[int, dict], str]:
    """(per-requirement verdicts, summary). Raises llm.AIUnavailable on failure."""
    user = (f"REQUIREMENTS:\n{_requirements_block(reqs)}\n\n"
            f"RESUME EXCERPTS:\n{_excerpts_block(chunks, masked)}")
    try:
        data = llm.chat_json(SYSTEM, user, tier="quality", schema=ADJUDICATE_SCHEMA,
                             schema_name="assessment", max_tokens=2600)
    except llm.AIUnavailable as exc:
        # Strict-schema validation can reject an otherwise usable completion. Retry once in
        # JSON mode; every field is re-validated in Python below, so nothing is trusted blindly.
        msg = str(exc).lower()
        if "generated json" not in msg and "json_validate" not in msg and "schema" not in msg:
            raise
        data = llm.chat_json(SYSTEM + " Return ONLY the JSON object, no prose.",
                             user, tier="quality", schema=None, max_tokens=2600)
    verdicts: dict[int, dict] = {}
    valid = {r["id"] for r in reqs}
    for row in data.get("requirements") or []:
        try:
            rid = int(row.get("requirement_id"))
        except (TypeError, ValueError):
            continue
        if rid not in valid:
            continue
        status = row.get("status") if row.get("status") in STATUS_SCORE else "not_evidenced"
        quote, start, end, support = _verify(masked, row.get("quote") or "")
        if status in ("matched", "partial") and support == "flagged_unverified":
            # A claim we cannot anchor in the resume is downgraded, never trusted.
            status, support = "not_evidenced", "flagged_unverified"
        if status in ("not_evidenced", "confirmed_absent"):
            # Keep the response self-consistent: a requirement the model judged unevidenced
            # must not carry an evidence quote, or the UI shows a contradiction.
            quote, start, end, support = None, None, None, "flagged_unverified"
        verdicts[rid] = {"status": status, "reason": (row.get("reason") or "")[:400],
                         "quote": quote, "start": start, "end": end,
                         "support": "verified" if support.startswith("verified") else support}
    if reqs and not verdicts:
        # An empty/degraded completion must never be scored as "no evidence at all":
        # that would fail a candidate for a transport problem. Surface it instead.
        raise llm.AIUnavailable("adjudication returned no usable verdicts")
    return verdicts, (data.get("summary") or "")


def _skills_score(rows: list[dict]) -> float:
    num = den = 0.0
    for row in rows:
        w = row["weight"] * IMPORTANCE_FACTOR.get(row["importance"], 1.0)
        num += w * STATUS_SCORE.get(row["status"], 0.0)
        den += w
    return 100.0 * num / den if den else 0.0


def skills_score(rows: list[dict]) -> float:
    """Public wrapper: weighted skills score for already-built rows."""
    return _skills_score(rows)


def _experience_score(profile: dict, reqs: list[dict]) -> float | None:
    needed = [r["min_years"] for r in reqs if r.get("min_years")]
    if not needed:
        return None
    required = max(needed)
    months = 0
    for e in profile.get("experience") or []:
        m = e.get("months")
        if isinstance(m, (int, float)) and m > 0:
            months += float(m)
    if not months:
        return 0.0
    return round(min(1.0, (months / 12.0) / required) * 100.0, 1)


def _quantization(x: float) -> float:
    return round(max(0.0, min(100.0, x)), 1)


def _projects_score(profile: dict, job_description: str, project_chunks: list[dict]) -> float | None:
    texts = [p.get("description") or p.get("name") or "" for p in profile.get("projects") or []]
    texts = [t for t in texts if t.strip()] or [c["text"] for c in project_chunks]
    if not texts or not (job_description or "").strip():
        return None
    vecs = embeddings.encode([job_description[:2000]] + [t[:1200] for t in texts])
    sims = [embeddings.cosine(vecs[0], v) for v in vecs[1:]]
    best = max(sims) if sims else 0.0
    return _quantization(100.0 * min(1.0, best / 0.55))


def _qualifications_score(rows: list[dict]) -> float | None:
    quals = [r for r in rows if r["kind"] == "qualification"] if rows and "kind" in rows[0] else []
    if not quals:
        return None
    got = sum(STATUS_SCORE.get(r["status"], 0.0) for r in quals)
    return _quantization(100.0 * got / len(quals))


def _confidence(rows: list[dict]) -> tuple[str, bool]:
    req_rows = [r for r in rows if r["importance"] == "required"] or rows
    if not req_rows:
        return "low", True
    verified = sum(1 for r in req_rows
                   if r["status"] in ("matched", "partial") and r["support"].startswith("verified"))
    ratio = verified / len(req_rows)
    insufficient = ratio < 0.5
    return ("high" if ratio >= 0.7 else "medium" if verdict_ok(ratio) else "low"), insufficient


def verdict_ok(ratio: float) -> bool:
    return ratio >= 0.4


def combine(rows: list[dict], profile: dict, job_description: str,
            project_chunks: list[dict], reqs: list[dict],
            weights: dict | None = None) -> dict:
    """Deterministic arithmetic over adjudicated evidence. No LLM here.

    `weights` are the job's configured percentages (default 50/25/15/10). The weighted total
    itself is computed by services.scoring so the live pipeline, the re-score after a weights
    change and the What-If simulator can never disagree about what a score means.
    """
    dims = {
        "skills": _skills_score(rows),
        "experience": _experience_score(profile, reqs),
        "projects": _projects_score(profile, job_description, project_chunks),
        "qualifications": _qualifications_score(rows),
    }
    weighted = scoring.combine_dimensions(dims, weights or scoring.DEFAULT_WEIGHTS)
    overall = weighted["overall"]
    not_measured = weighted["not_measured"]
    effective = weighted["effective_weights"]
    confidence, insufficient = _confidence(rows)
    gaps = [r["label"] for r in rows if r["status"] in ("not_evidenced", "confirmed_absent")]
    return {
        # One rounding policy for the total: services.scoring already rounds to 2dp, and the
        # re-score path uses the same function, so a weights change cannot move a score by a
        # rounding step that has nothing to do with the weights.
        "overall": round(max(0.0, min(100.0, overall)), 2),
        "skills": _quantization(dims["skills"]),
        "experience": _quantization(dims["experience"] or 0.0),
        "projects": _quantization(dims["projects"] or 0.0),
        "qualifications": _quantization(dims["qualifications"] or 0.0),
        "confidence": confidence,
        "insufficient_evidence": insufficient,
        "gaps": gaps,
        "not_measured": not_measured,
        "effective_weights": effective,
        "configured_weights": weighted["configured_weights"],
        # Full-precision dimension scores, so a later re-score under new weights reproduces the
        # same numbers instead of drifting through the rounded values shown in the UI.
        "dims": {k: (None if v is None else float(v)) for k, v in dims.items()},
        "weights_exhausted": weighted["exhausted"],
        "weights_note": weighted["note"],
        "learning_suggestions": [f"Add concrete project evidence for {g}." for g in gaps[:5]],
    }


def build_rows(reqs: list[dict], verdicts: dict[int, dict], similarities: dict[int, float]) -> list[dict]:
    rows = []
    for r in reqs:
        v = verdicts.get(r["id"], {})
        status = v.get("status", "not_evidenced")
        rows.append({
            "requirement_id": r["id"], "label": r["label"], "kind": r.get("kind", "skill"),
            "importance": r["importance"], "weight": float(r.get("weight") or 1.0),
            "status": status, "score": STATUS_SCORE.get(status, 0.0),
            "similarity": similarities.get(r["id"]),
            "quote": v.get("quote"), "start": v.get("start"), "end": v.get("end"),
            "support": v.get("support", "flagged_unverified"),
            "reason": v.get("reason", ""),
        })
    return rows


def explain(rows: list[dict], scores: dict, summary: str) -> str:
    matched = [r["label"] for r in rows if r["status"] == "matched"]
    partial = [r["label"] for r in rows if r["status"] == "partial"]
    missing = [r["label"] for r in rows if r["status"] in ("not_evidenced", "confirmed_absent")]
    parts = [f"{len(matched)} requirement(s) evidenced directly"
             + (f" ({', '.join(matched[:6])})" if matched else "") + "."]
    if partial:
        parts.append(f"Partially evidenced: {', '.join(partial[:5])}.")
    if missing:
        parts.append(f"No resume evidence found for: {', '.join(missing[:6])} "
                     f"- this is missing evidence, not proof of absence.")
    parts.append(f"Weighted score {scores['overall']:.1f} "
                 f"(skills 50%, experience 25%, projects 15%, qualifications 10%), "
                 f"confidence {scores['confidence']}.")
    if summary:
        parts.insert(0, summary.strip())
    return " ".join(parts)
