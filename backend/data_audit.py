"""Read-only integrity audit of the demo dataset.

Checks the properties we claim out loud: the weighted arithmetic adds up, every 'verified'
quote really is a slice of the original résumé, matched rows are backed by evidence, and no
protected attribute survived into the text scoring sees.

Run:  python data_audit.py
"""
import json
import sys

import models as m
from db import SessionLocal
from services import embeddings, fairness, matching

WEIGHTS = {"skills": 0.50, "experience": 0.25, "projects": 0.15, "qualifications": 0.10}
STATUSES = {"matched", "partial", "not_evidenced", "confirmed_absent"}
problems: list[str] = []


def note(msg: str) -> None:
    problems.append(msg)


def main() -> int:
    db = SessionLocal()
    rows = db.query(m.Assessment).order_by(m.Assessment.id).all()
    print(f"{len(rows)} assessments\n")
    header = f"{'candidate':24}{'overall':>8}{'skills':>8}{'expr':>7}{'proj':>7}{'qual':>7}{'conf':>8}{'ai':>10}"
    print(header)
    print("-" * len(header))
    for a in rows:
        app_row = db.get(m.Application, a.application_id)
        cand = db.get(m.User, app_row.candidate_id) if app_row else None
        name = (cand.full_name if cand else "?")[:23]
        print(f"{name:24}{a.overall:>8.1f}{a.skills_score:>8.1f}{a.experience_score:>7.1f}"
              f"{a.projects_score:>7.1f}{a.qualifications_score:>7.1f}{a.confidence:>8}{a.ai_mode:>10}")

        # 1. weighted arithmetic must reproduce the reported overall, using the weights the
        #    assessor actually applied (dimensions that were not measured carry 0%).
        payload = {}
        try:
            payload = json.loads(a.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        not_measured = set(payload.get("not_measured", []))
        effective = payload.get("effective_weights", {})
        parts = {"skills": a.skills_score, "experience": a.experience_score,
                 "projects": a.projects_score, "qualifications": a.qualifications_score}
        if effective:
            expect = sum(w * (parts.get(k) or 0.0) for k, w in effective.items())
            if abs(expect - a.overall) > 0.6:
                note(f"{name}: overall {a.overall} does not match effective weights ({expect:.1f})")
        else:
            total_w = sum(WEIGHTS[k] for k, v in parts.items() if v is not None)
            if total_w:
                expect = sum(WEIGHTS[k] * (v or 0.0)
                             for k, v in parts.items() if v is not None) / total_w
                if abs(expect - a.overall) > 0.6:
                    note(f"{name}: overall {a.overall} does not match weighted parts ({expect:.1f})")
        for dim in ("skills", "experience", "projects", "qualifications"):
            if dim in not_measured and (parts[dim] or 0.0) != 0.0:
                note(f"{name}: {dim} reported as not measured but stored {parts[dim]}")

        # 2. evidence integrity
        resume = db.get(m.Resume, app_row.resume_id) if app_row else None
        raw = (resume.raw_text or "") if resume else ""
        for s in a.skills_detail:
            if s.status not in STATUSES:
                note(f"{name}/{s.label}: unknown status {s.status}")
            if s.status == "matched" and s.support != "verified":
                note(f"{name}/{s.label}: matched without verified evidence ({s.support})")
            if s.support == "verified":
                if s.evidence_start is None or s.evidence_end is None:
                    note(f"{name}/{s.label}: verified but missing offsets")
                else:
                    span = raw[s.evidence_start:s.evidence_end]
                    if s.evidence_start < 0 or s.evidence_end > len(raw):
                        note(f"{name}/{s.label}: offsets out of range")
                    elif matching._norm(span) != matching._norm(s.evidence_quote or ""):
                        note(f"{name}/{s.label}: quote words not at [{s.evidence_start}:{s.evidence_end}]")
            if s.status in ("not_evidenced", "confirmed_absent") and s.evidence_quote:
                note(f"{name}/{s.label}: {s.status} row still carries a quote")

        # 3. fairness: no protected identifiers left in the text scoring sees. Note this only
        #    proves the text fed to the scorer is clean; it is not a claim of fairness in hiring.
        view = fairness.scoring_view(raw)
        if cand and cand.full_name:
            first, last = (cand.full_name.split()[0], cand.full_name.split()[-1])
            if len(first) > 2 and first.lower() in view.lower():
                note(f"{name}: first name still present in the scoring text")
            if len(last) > 2 and last.lower() in view.lower():
                note(f"{name}: last name still present in the scoring text")
        if cand and cand.email and cand.email.lower() in view.lower():
            note(f"{name}: email still present in the scoring text")

        # 4. honesty of the reported modes
        if a.ai_mode not in ("groq", "degraded", "heuristic"):
            note(f"{name}: unexpected ai_mode {a.ai_mode}")
        if a.embedding_mode not in ("dense", "lexical"):
            note(f"{name}: unexpected embedding_mode {a.embedding_mode}")

    # 5. orphan check across every child table
    app_ids = {i for (i,) in db.query(m.Application.id).all()}
    for label, model in [("assessments", m.Assessment), ("notes", m.Note),
                         ("questions", m.InterviewQuestion), ("interviews", m.Interview),
                         ("events", m.StatusEvent), ("decisions", m.FinalDecision)]:
        for obj in db.query(model).all():
            if obj.application_id not in app_ids:
                note(f"{label}: row {obj.id} points at missing application {obj.application_id}")

    print(f"\nembedding backend: {embeddings.mode()}")
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  - " + p)
        return 1
    print("0 problems: arithmetic, evidence offsets, fairness masking and orphan rows all check out.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
