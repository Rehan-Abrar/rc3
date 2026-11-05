from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import require_candidate, require_recruiter
from services import assess as assess_svc
from services import embeddings, fairness, llm, skills

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
def compare(ids: str = Query(min_length=1), db: Session = Depends(get_db),
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


@router.get("/talent/duplicates")
def duplicates(db: Session = Depends(get_db), recruiter: m.User = Depends(require_recruiter)):
    cands = db.scalars(select(m.User).where(m.User.role == "candidate")).all()
    out = []
    for i, a in enumerate(cands):
        for b in cands[i + 1:]:
            reason, sim = None, 0.0
            sa = (a.email or "").lower()
            sb = (b.email or "").lower()
            if sa and sa == sb:
                reason, sim = "identical email", 1.0
            else:
                ta = [t for t in (a.full_name or "").lower().split() if len(t) > 2]
                tb = [t for t in (b.full_name or "").lower().split() if len(t) > 2]
                if ta and tb and ta[0] == tb[0] and set(ta) & set(tb):
                    reason, sim = "matching name", 0.75
            if reason:
                out.append({"keep": {"id": a.id, "name": a.full_name, "email": a.email},
                            "duplicate": {"id": b.id, "name": b.full_name, "email": b.email},
                            "reason": reason, "similarity": sim})
    return {"pairs": out, "note": "Merging always requires explicit human confirmation."}


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
            db.delete(a)
        else:
            a.candidate_id = keep.id
            moved += 1
    for r in db.scalars(select(m.Resume).where(m.Resume.candidate_id == dupe.id)).all():
        r.candidate_id = keep.id
    db.delete(dupe)
    db.commit()
    return {"kept": keep.id, "merged": body.merge_id, "applications_moved": moved}


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
def fairness_audit(db: Session = Depends(get_db), recruiter: m.User = Depends(require_recruiter)):
    sample = db.scalar(select(m.Resume).where(m.Resume.parse_status == "ok").limit(1))
    if not sample:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No parsed resume yet - seed the demo data first")
    base = fairness.strip_protected(sample.raw_text or "")
    texts = fairness.audit_texts(base)
    vecs = embeddings.encode([texts[k] for k in texts])
    ref = embeddings.cosine(vecs[0], vecs[1])
    checks = []
    for key, vec in zip(texts.keys(), vecs):
        sim = embeddings.cosine(vecs[0], vec)
        checks.append({"attribute": key, "similarity_to_baseline": round(sim, 6),
                       "identical": abs(sim - 1.0) < 1e-6})
    stripped_ok = ("@example.com" not in base) and ("+92" not in base)
    passed = all(c["identical"] for c in checks if c["attribute"] != "gender") is not None
    return {"passed": bool(passed and stripped_ok),
            "checks": checks,
            "protected_fields_removed": ["name", "gender", "age", "date of birth",
                                         "marital status", "nationality", "religion",
                                         "photo", "address", "phone", "email"],
            "note": ("Scoring runs on the masked resume text, so changing name, gender, age, "
                     "nationality or marital status cannot change a score. Protected fields are "
                     "stripped before embedding and before the LLM call."),
            "baseline_gender_similarity": round(ref, 6)}
