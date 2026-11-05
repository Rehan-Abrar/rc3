"""Assessment orchestration: parse cache -> chunks -> embeddings -> LLM adjudication -> scoring."""
import json

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import models as m
import serializers as S
from services import embeddings, extract, fairness, llm, matching, pdf


def ensure_chunks(db: Session, resume: m.Resume) -> list[m.ResumeChunk]:
    existing = db.scalars(select(m.ResumeChunk).where(
        m.ResumeChunk.resume_id == resume.id).order_by(m.ResumeChunk.id)).all()
    if existing:
        return list(existing)
    for c in pdf.chunks(resume.raw_text or ""):
        db.add(m.ResumeChunk(resume_id=resume.id, section=c["section"], text=c["text"],
                             char_start=c["char_start"], char_end=c["char_end"]))
    db.commit()
    return list(db.scalars(select(m.ResumeChunk).where(
        m.ResumeChunk.resume_id == resume.id).order_by(m.ResumeChunk.id)).all())


def profile_of(resume: m.Resume) -> dict:
    prof = extract.loads(resume.extracted_json)
    if prof is None:
        prof = {"skills": [], "experience": [], "education": [], "projects": [],
                "certifications": [], "summary": None, "name": None, "email": None,
                "phone": None, "links": []}
    return prof


def log_stage(db: Session, app: m.Application, actor_id: int, to_stage: str,
              reason: str | None) -> None:
    if app.stage == to_stage:
        return
    db.add(m.StatusEvent(application_id=app.id, actor_id=actor_id, from_stage=app.stage,
                         to_stage=to_stage, reason=reason))
    app.stage = to_stage


def run_assessment(db: Session, app: m.Application, actor_id: int) -> m.Assessment:
    job = db.get(m.Job, app.job_id)
    resume = db.get(m.Resume, app.resume_id)
    profile = profile_of(resume)
    reqs = [{"id": r.id, "label": r.label, "kind": r.kind, "importance": r.importance,
             "weight": float(r.weight or 1.0), "min_years": r.min_years,
             "evidence_hint": r.evidence_hint} for r in sorted(job.requirements, key=lambda x: x.id)]

    chunks = ensure_chunks(db, resume)
    masked = fairness.mask_same_length(resume.raw_text or "")
    chunk_rows = [{"id": c.id, "text": c.text, "char_start": c.char_start, "char_end": c.char_end,
                   "section": c.section} for c in chunks]
    chunk_vecs = embeddings.encode(
        [masked[c["char_start"]:c["char_end"]][:1200] or c["text"][:1200]
         for c in chunk_rows]) if chunk_rows else []
    similarities = matching.gate_requirements(reqs, chunk_vecs) if chunk_vecs else {}

    ai_mode, summary = "degraded", ""
    verdicts: dict[int, dict] = {}
    for attempt in range(2):
        try:
            verdicts, summary = matching.adjudicate(reqs, chunk_rows, masked)
            ai_mode = "groq"
        except llm.AIUnavailable as exc:
            verdicts = {}
            summary = f"AI adjudication unavailable ({str(exc)[:80]}). Showing semantic similarity only."
            ai_mode = "degraded"
            break
        # A resume whose excerpts clearly match a requirement cannot come back with every
        # requirement unevidenced; that is a bad completion, so ask once more before scoring it.
        all_empty = verdicts and all(v["status"] in ("not_evidenced", "confirmed_absent")
                                    for v in verdicts.values())
        if not (attempt == 0 and all_empty):
            break

    # Still nothing after a retry: do not present that as a confident low score. Fall back to
    # semantic similarity and label the assessment degraded so the number is never overstated.
    if ai_mode == "groq" and verdicts and all(
            v["status"] in ("not_evidenced", "confirmed_absent") for v in verdicts.values()):
        verdicts = {}
        ai_mode = "degraded"
        summary = ("AI returned no evidence for any requirement. Showing semantic similarity only; "
                   "re-run the assessment or review the résumé manually.")

    rows = matching.build_rows(reqs, verdicts, similarities)
    project_chunks = [{"text": c["text"]} for c in chunk_rows if c["section"] == "projects"]
    scores = matching.combine(rows, profile, job.description or "", project_chunks, reqs)
    explanation = matching.explain(rows, scores, summary)

    old = db.scalar(select(m.Assessment).where(m.Assessment.application_id == app.id))
    if old:
        db.execute(delete(m.AssessmentSkill).where(m.AssessmentSkill.assessment_id == old.id))
        db.delete(old)
        db.flush()

    a = m.Assessment(
        application_id=app.id, overall=scores["overall"], skills_score=scores["skills"],
        experience_score=scores["experience"], projects_score=scores["projects"],
        qualifications_score=scores["qualifications"], confidence=scores["confidence"],
        insufficient_evidence=scores["insufficient_evidence"], ai_mode=ai_mode,
        embedding_mode=embeddings.mode(),
        model=llm.model_for("quality") if ai_mode == "groq" else "none",
        summary=summary[:2000], explanation=explanation[:4000],
        payload_json=json.dumps({"gaps": scores["gaps"],
                                 "learning_suggestions": scores["learning_suggestions"]}))
    db.add(a)
    db.flush()
    for r in rows:
        db.add(m.AssessmentSkill(
            assessment_id=a.id, requirement_id=r["requirement_id"], label=r["label"],
            importance=r["importance"], weight=r["weight"], status=r["status"],
            score=r["score"], similarity=r["similarity"], evidence_quote=r["quote"],
            evidence_start=r["start"], evidence_end=r["end"], support=r["support"],
            reason=(r["reason"] or "")[:800]))
    if app.stage in ("submitted", "parsed"):
        log_stage(db, app, actor_id, "assessed", "AI assessment generated")
    db.commit()
    db.refresh(a)
    return a


def assessment_payload(db: Session, app: m.Application) -> dict | None:
    a = db.scalar(select(m.Assessment).where(m.Assessment.application_id == app.id))
    if not a:
        return None
    return S.assessment(a, a.ai_mode, embeddings.mode())
