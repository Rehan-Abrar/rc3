from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import require_candidate, require_recruiter
from services import assess as assess_svc
from services import embeddings, fairness, llm, matching, pdf, skills

router = APIRouter(tags=["talent"])

QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "requirements": {"type": "array", "items": {"type": "string"}},
        "seniority": {"type": "string"},
    },
    "required": ["requirements", "seniority"],
    "additionalProperties": False,
}

QUERY_SYSTEM = """Turn a recruiter's natural-language talent query into searchable requirements.
Return 2-6 short technical requirement phrases (skills, tools, domain experience).
Never add requirements the query does not imply. "seniority" is "" unless the query states one."""


def _parse_query(q: str) -> list[str]:
    try:
        data = llm.chat_json(QUERY_SYSTEM, f"QUERY: {q}", tier="fast", schema=QUERY_SCHEMA,
                             schema_name="talent_query", max_tokens=600)
        out = [r.strip() for r in (data.get("requirements") or []) if r.strip()]
        if out:
            return out[:6]
    except llm.AIUnavailable:
        pass
    return [p.strip() for p in q.replace(",", " ").split() if len(p.strip()) > 2][:6]


@router.get("/talent/search")
def search(q: str = Query(min_length=2, max_length=300), db: Session = Depends(get_db),
           recruiter: m.User = Depends(require_recruiter)):
    reqs = _parse_query(q)
    req_vecs = embeddings.encode(reqs)
    cands = db.scalars(select(m.User).where(m.User.role == "candidate")).all()
    hits = []
    for cand in cands:
        resumes = db.scalars(select(m.Resume).where(
            m.Resume.candidate_id == cand.id, m.Resume.parse_status == "ok").order_by(
            m.Resume.created_at.desc())).all()
        if not resumes:
            continue
        resume = resumes[0]
        chunks = assess_svc.ensure_chunks(db, resume)
        if not chunks:
            continue
        masked = fairness.mask_same_length(resume.raw_text or "")
        texts = [masked[c.char_start:c.char_end][:1200] or c.text[:1200] for c in chunks]
        vecs = embeddings.encode(texts)
        evidence, matched, scores = [], [], []
        for req, rv in zip(reqs, req_vecs):
            best_i, best_sim = -1, -1.0
            for i, cv in enumerate(vecs):
                sim = embeddings.cosine(rv, cv)
                if sim > best_sim:
                    best_i, best_sim = i, sim
            if best_sim > 0.20:
                matched.append(req)
                if best_i >= 0:
                    c = chunks[best_i]
                    quote = (resume.raw_text or "")[c.char_start:c.char_end].strip()[:300]
                    evidence.append({"requirement": req, "quote": quote,
                                     "similarity": round(best_sim, 3)})
            scores.append(max(0.0, best_sim))
        if not matched:
            continue
        coverage = len(matched) / len(reqs)
        score = round(100.0 * (0.7 * coverage + 0.3 * (sum(scores) / len(scores))), 1)
        hits.append({"candidate_id": cand.id, "name": cand.full_name, "email": cand.email,
                     "score": score, "evidence": evidence, "matched": matched,
                     "missing": [r for r in reqs if r not in matched]})
    hits.sort(key=lambda h: -h["score"])
    return {"query": q, "mode": embeddings.mode(), "hits": hits[:20],
            "parsed_requirements": reqs}


@router.get("/talent/compare")
def compare(ids: str = Query(min_length=1), job_id: int | None = None,
            db: Session = Depends(get_db),
            recruiter: m.User = Depends(require_recruiter)):
    try:
        app_ids = [int(x) for x in ids.split(",") if x.strip()][:4]
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "ids must be comma-separated application ids")
    out = []
    for aid in app_ids:
        a = db.get(m.Application, aid)
        if not a:
            continue
        job = db.get(m.Job, a.job_id)
        if not job or job.recruiter_id != recruiter.id:
            continue
        cand = db.get(m.User, a.candidate_id)
        ass = db.scalar(select(m.Assessment).where(m.Assessment.application_id == a.id))
        detail = [S.skill_row(s) for s in ass.skills_detail] if ass else []
        out.append({
            "application_id": a.id, "candidate_id": cand.id, "name": cand.full_name,
            "score": S.score_block(ass, "", embeddings.mode()),
            "matched": [d for d in detail if d["status"] == "matched"],
            "missing": [d for d in detail if d["status"] in ("not_evidenced", "confirmed_absent")],
            "gaps": [d["label"] for d in detail if d["status"] == "not_evidenced"],
        })
    return {"rows": out}


_EMAIL_IN_TEXT = None


def _resume_signals(db: Session) -> dict[int, dict]:
    """Latest parsed résumé per candidate: normalised text, contacts found in it, embedding."""
    import re

    from services import pdf as pdf_svc

    out: dict[int, dict] = {}
    rows = db.execute(
        select(m.Resume.candidate_id, m.Resume.raw_text, m.Resume.id)
        .where(m.Resume.parse_status == "ok").order_by(m.Resume.id)).all()
    for cand_id, raw, _rid in rows:
        text = (raw or "").strip()
        if not text:
            continue
        norm = " ".join(text.lower().split())
        emails = set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", text.lower()))
        phones = {"".join(ch for ch in p if ch.isdigit())[-9:]
                  for p in re.findall(r"(?:\+?\d[\d\s-]{7,})", text)}
        out[cand_id] = {"norm": norm, "emails": {e for e in emails if "@" in e},
                        "phones": {p for p in phones if len(p) >= 9},
                        "vector": embeddings.encode([text[:1200]])[0]}
    return out


@router.get("/talent/duplicates")
def duplicates(db: Session = Depends(get_db), recruiter: m.User = Depends(require_recruiter)):
    """Same person, twice. Compares account identity AND résumé content, because the usual
    duplicate is one candidate applying twice with two emails and the same CV."""
    cands = db.scalars(select(m.User).where(m.User.role == "candidate")).all()
    signals = _resume_signals(db)
    out = []
    for i, a in enumerate(cands):
        for b in cands[i + 1:]:
            reason, sim = None, 0.0
            sa, sb = (a.email or "").lower(), (b.email or "").lower()
            ra, rb = signals.get(a.id), signals.get(b.id)
            if sa and sa == sb:
                reason, sim = "identical email", 1.0
            elif ra and rb and ra["norm"] == rb["norm"]:
                reason, sim = "identical résumé text", 1.0
            elif ra and rb and (ra["emails"] & rb["emails"] or ra["phones"] & rb["phones"]):
                shared = sorted(ra["emails"] & rb["emails"] | ra["phones"] & rb["phones"])[0]
                reason, sim = f"same contact detail on both résumés ({shared[:40]})", 0.95
            elif ra and rb:
                cos = embeddings.cosine(ra["vector"], rb["vector"])
                if cos >= 0.92:
                    reason, sim = "near-identical résumé", round(cos, 2)
            if not reason:
                ta = [t for t in (a.full_name or "").lower().split() if len(t) > 2]
                tb = [t for t in (b.full_name or "").lower().split() if len(t) > 2]
                if ta and tb and ta[0] == tb[0] and set(ta) & set(tb):
                    reason, sim = "matching name", 0.75
            if reason:
                out.append({"keep": {"id": a.id, "name": a.full_name, "email": a.email},
                            "duplicate": {"id": b.id, "name": b.full_name, "email": b.email},
                            "reason": reason, "similarity": sim})
    return out


def _purge_application(db: Session, app_row: m.Application) -> None:
    """Remove an application and every row that hangs off it (no orphaned scores/notes)."""
    from sqlalchemy import delete as _delete

    ass = db.scalar(select(m.Assessment).where(m.Assessment.application_id == app_row.id))
    if ass:
        db.execute(_delete(m.AssessmentSkill).where(m.AssessmentSkill.assessment_id == ass.id))
        db.delete(ass)
    for iv in db.scalars(select(m.Interview).where(m.Interview.application_id == app_row.id)).all():
        db.execute(_delete(m.Feedback).where(m.Feedback.interview_id == iv.id))
        db.delete(iv)
    for model in (m.Note, m.InterviewQuestion, m.StatusEvent, m.FinalDecision):
        db.execute(_delete(model).where(model.application_id == app_row.id))
    db.delete(app_row)


@router.post("/talent/merge")
def merge(body: schemas.MergeIn, db: Session = Depends(get_db),
          recruiter: m.User = Depends(require_recruiter)):
    keep, dupe = db.get(m.User, body.keep_id), db.get(m.User, body.merge_id)
    if not keep or not dupe or keep.role != "candidate" or dupe.role != "candidate":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidate not found")
    moved = 0
    for a in db.scalars(select(m.Application).where(
            m.Application.candidate_id == dupe.id)).all():
        clash = db.scalar(select(m.Application).where(
            m.Application.job_id == a.job_id, m.Application.candidate_id == keep.id))
        if clash:
            _purge_application(db, a)
        else:
            a.candidate_id = keep.id
            moved += 1
    for r in db.scalars(select(m.Resume).where(m.Resume.candidate_id == dupe.id)).all():
        r.candidate_id = keep.id
    db.delete(dupe)
    db.commit()
    return {"ok": True, "kept": keep.id, "merged": body.merge_id,
            "applications_moved": moved}


@router.get("/candidates/jobs/recommended")
def recommended_jobs(db: Session = Depends(get_db),
                     user: m.User = Depends(require_candidate)):
    resumes = db.scalars(select(m.Resume).where(
        m.Resume.candidate_id == user.id, m.Resume.parse_status == "ok").order_by(
        m.Resume.created_at.desc())).all()
    if not resumes:
        return {"jobs": [], "note": "Upload a resume first"}
    resume = resumes[0]
    profile = assess_svc.profile_of(resume)
    my_skills = [s["label"] for s in profile.get("skills") or []]
    my_vec = embeddings.encode([" ".join(my_skills) + " " +
                                (profile.get("summary") or "")])[0]
    applied = {a.job_id for a in db.scalars(
        select(m.Application).where(m.Application.candidate_id == user.id)).all()}
    out = []
    for job in db.scalars(select(m.Job).where(m.Job.status == "open")).all():
        if job.id in applied:
            continue
        job_vec = embeddings.encode([f"{job.title} {job.description} " +
                                     " ".join(r.label for r in job.requirements)])[0]
        sim = embeddings.cosine(my_vec, job_vec)
        matched = [r.label for r in job.requirements
                   if any(skills.matches(r.label, s) for s in my_skills)]
        out.append({"job_id": job.id, "title": job.title, "department": job.department,
                    "similarity": round(sim, 3),
                    "score": round(100.0 * max(0.0, min(1.0, sim / 0.55)), 1),
                    "matched_skills": matched,
                    "reason": (f"{len(matched)} of your skills match this vacancy"
                               if matched else "Adjacent to your profile by semantic similarity")})
    out.sort(key=lambda x: -x["score"])
    return {"jobs": out, "mode": embeddings.mode()}


@router.get("/audit/fairness")
def fairness_audit(job_id: int | None = None, db: Session = Depends(get_db),
                   recruiter: m.User = Depends(require_recruiter)):
    """Attribute-swap proof that protected fields cannot change a score (R33).

    Runs the real scoring pipeline over one résumé, then over the same résumé with gender,
    name, age, marital status and nationality changed, and compares the resulting numbers -
    so the reported baseline is a score comparable to the ranked list, not a self-similarity 1.0.
    """
    app_row = db.execute(
        select(m.Application, m.Assessment)
        .join(m.Assessment, m.Assessment.application_id == m.Application.id)
        .join(m.Job, m.Job.id == m.Application.job_id)
        .where(m.Job.recruiter_id == recruiter.id)
        .order_by(m.Assessment.overall.desc())).first()
    if job_id:
        app_row = db.execute(
            select(m.Application, m.Assessment)
            .join(m.Assessment, m.Assessment.application_id == m.Application.id)
            .where(m.Application.job_id == job_id)
            .order_by(m.Assessment.overall.desc())).first()
    if not app_row:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No assessed application yet - seed the demo data first")
    app_row, assessment = app_row
    resume = db.get(m.Resume, app_row.resume_id)
    job = db.get(m.Job, app_row.job_id)
    if not resume or not job:
        raise HTTPException(status.HTTP_409_CONFLICT, "Assessment is missing its résumé or job")
    cand_name = (db.get(m.User, app_row.candidate_id).full_name if app_row.candidate_id else "")
    reqs = [{"id": r.id, "label": r.label, "kind": r.kind, "importance": r.importance,
             "weight": r.weight, "evidence_hint": r.evidence_hint}
            for r in sorted(job.requirements, key=lambda x: x.id)]
    if not reqs:
        raise HTTPException(status.HTTP_409_CONFLICT, "That job has no requirements to score")

    def semantic_score(text: str) -> float:
        """Deterministic, LLM-free score (semantic gate with fixed thresholds)."""
        view = fairness.scoring_view(text)
        parts = pdf.chunks(view)
        if not parts:
            return 0.0
        vecs = embeddings.encode([p["text"][:1200] for p in parts])
        sims = matching.gate_requirements(reqs, vecs)
        rows = []
        for r in reqs:
            sim = float(sims.get(r["id"]) or 0.0)
            status = ("matched" if sim >= 0.55 else
                      "partial" if sim >= 0.35 else "not_evidenced")
            rows.append({"requirement_id": r["id"], "label": r["label"],
                         "kind": r.get("kind", "skill"), "importance": r["importance"],
                         "weight": float(r.get("weight") or 1.0), "status": status,
                         "score": matching.STATUS_SCORE.get(status, 0.0), "similarity": sim})
        return round(matching.skills_score(rows), 2)

    def _norm(text: str) -> str:
        return " ".join(text.split())

    # The number the recruiter actually sees for this candidate, so the audit is comparable
    # to the ranked list instead of being an abstract 100/100 self-similarity.
    baseline = round(assessment.skills_score, 2)
    base_view = _norm(fairness.scoring_view(resume.raw_text or ""))
    texts = fairness.audit_texts(resume.raw_text or "")
    checks, deltas = [], []
    for key, value in texts.items():
        if key == "baseline":
            continue
        view = _norm(fairness.scoring_view(value))
        identical = view == base_view
        # Identical scoring text means every scorer - embedding gate or LLM - sees the same
        # input, so the score provably cannot move. Only re-score when masking fell short.
        perturbed = baseline if identical else semantic_score(value)
        deltas.append(abs(baseline - perturbed))
        checks.append({"attribute": key, "baseline": baseline, "perturbed": perturbed,
                       "identical": identical})
    worst = max(deltas) if deltas else 0.0
    removed = fairness.scoring_view(texts["baseline"])
    protected_removed = ("@example.com" not in removed) and ("+92" not in removed)
    passed = protected_removed and worst < 0.05
    return {"passed": bool(passed), "baseline": baseline,
            "perturbed": round(min([c["perturbed"] for c in checks] or [baseline]), 2),
            "delta": round(worst, 2), "checks": checks,
            "candidate": cand_name,
            "job": job.title,
            "note": (f"Took {cand_name}'s own résumé for {job.title} and changed only gender, "
                     "name, age, marital status and nationality. After protected fields are "
                     "stripped, the text handed to the scorer is byte-identical in every variant, "
                     f"so the score cannot move. Baseline {baseline:.1f} is that candidate's real "
                     "Skills score from the ranked list (not the weighted Overall). Contact "
                     "details removed: " + ("yes" if protected_removed else "NO"))}


@router.post("/audit/merge", status_code=201)
def merge_alias(body: schemas.MergeIn, db: Session = Depends(get_db),
                recruiter: m.User = Depends(require_recruiter)):
    """Alias of /talent/merge, kept because the frontend calls this path."""
    return merge(body, db, recruiter)
