import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import current_user, require_recruiter
from services import llm, scoring, skills

router = APIRouter(prefix="/jobs", tags=["jobs"])

REQ_SCHEMA = {
    "type": "object",
    "properties": {"requirements": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "label": {"type": "string"},
            "importance": {"type": "string", "enum": ["required", "preferred"]},
            "kind": {"type": "string", "enum": ["skill", "qualification"]},
            "min_years": {"type": ["number", "null"]},
            "evidence_hint": {"type": ["string", "null"]},
        },
        "required": ["label", "importance", "kind", "min_years", "evidence_hint"],
        "additionalProperties": False}}},
    "required": ["requirements"],
    "additionalProperties": False,
}

REQ_SYSTEM = """You extract hiring requirements from a job description.
Return the technical skills and qualifications a candidate is judged on.
- "importance" is "required" only when the text treats it as mandatory, otherwise "preferred".
- "kind" is "qualification" for degrees/certifications, "skill" for everything else.
- "min_years" only when the text states a number of years, else null.
- Do not invent requirements that the description does not support."""


def _get_job(db: Session, job_id: int) -> m.Job:
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job


def _owned_job(db: Session, job_id: int, recruiter: m.User) -> m.Job:
    """A job may only be modified by the recruiter who created it."""
    job = _get_job(db, job_id)
    if job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    return job


def _apply_requirements(db: Session, job: m.Job, reqs: list[schemas.RequirementIn]) -> None:
    for old in list(job.requirements):
        db.delete(old)
    db.flush()
    for r in reqs:
        db.add(m.JobRequirement(job_id=job.id, kind=r.kind, label=r.label.strip(),
                                canonical=skills.canonical(r.label), importance=r.importance,
                                weight=r.weight, min_years=r.min_years,
                                evidence_hint=(r.evidence_hint or None)))


@router.get("")
def list_jobs(status_filter: str | None = Query(default=None, alias="status"),
              q: str | None = None, db: Session = Depends(get_db),
              user: m.User = Depends(current_user)):
    stmt = select(m.Job).order_by(m.Job.created_at.desc())
    if status_filter in ("open", "closed"):
        stmt = stmt.where(m.Job.status == status_filter)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(m.Job.title.ilike(like) | m.Job.description.ilike(like))
    if user.role == "candidate":
        stmt = stmt.where(m.Job.status == "open")
    else:
        # A recruiter's job list is their own: every job route is ownership-checked, so listing
        # someone else's job only offers a link that 403s.
        stmt = stmt.where(m.Job.recruiter_id == user.id)
    return [S.job_summary(db, j) for j in db.scalars(stmt).all()]


@router.post("", status_code=201)
def create_job(body: schemas.JobIn, db: Session = Depends(get_db),
               recruiter: m.User = Depends(require_recruiter)):
    job = m.Job(recruiter_id=recruiter.id, title=body.title.strip(), department=body.department,
                location=body.location, employment_type=body.employment_type,
                salary_min=body.salary_min, salary_max=body.salary_max,
                description=body.description, status=body.status)
    if body.weights is not None:  # omitted -> the 50/25/15/10 default stands
        for dim, value in scoring.validate(body.weights.dimensions()).items():
            setattr(job, f"weight_{dim}", value)
    db.add(job)
    db.flush()
    _apply_requirements(db, job, body.requirements)
    db.commit()
    db.refresh(job)
    return S.job_detail(db, job)


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    return S.job_detail(db, _get_job(db, job_id))


@router.patch("/{job_id}")
def update_job(job_id: int, body: schemas.JobPatch, db: Session = Depends(get_db),
               recruiter: m.User = Depends(require_recruiter)):
    job = _owned_job(db, job_id, recruiter)
    data = body.model_dump(exclude_unset=True)
    reqs = data.pop("requirements", None)
    weights = data.pop("weights", None)
    for key, value in data.items():
        setattr(job, key, value)
    if reqs is not None:
        _apply_requirements(db, job, [schemas.RequirementIn(**r) for r in reqs])
    if weights is not None:
        # Editing a job keeps its weights unless the weights are part of the edit; a change
        # here goes through the same validation and version bump as the weights endpoint.
        clean = scoring.validate(schemas.WeightsIn(**weights).dimensions())
        if any(abs(scoring.to_percent(scoring.from_job(job))[d] - clean[d]) > 0.001
               for d in scoring.DIMENSIONS):
            for dim, value in clean.items():
                setattr(job, f"weight_{dim}", value)
            job.scoring_version = int(getattr(job, "scoring_version", 1) or 1) + 1
            db.flush()
            scoring.recalculate_job(db, job, commit=False)
    db.commit()
    db.refresh(job)
    return S.job_detail(db, job)


@router.post("/{job_id}/close")
def close_job(job_id: int, db: Session = Depends(get_db),
              recruiter: m.User = Depends(require_recruiter)):
    job = _owned_job(db, job_id, recruiter)
    job.status = "closed"
    db.commit()
    return S.job_detail(db, job)


@router.post("/{job_id}/reopen")
def reopen_job(job_id: int, db: Session = Depends(get_db),
               recruiter: m.User = Depends(require_recruiter)):
    job = _owned_job(db, job_id, recruiter)
    job.status = "open"
    db.commit()
    return S.job_detail(db, job)


@router.post("/extract-requirements")
def extract_requirements(body: schemas.ExtractRequirementsIn,
                         recruiter: m.User = Depends(require_recruiter)):
    """AI-assisted requirement extraction (fast tier). Never invents: returns nothing on failure."""
    try:
        data = llm.chat_json(REQ_SYSTEM, f"TITLE: {body.title}\n\nDESCRIPTION:\n{body.description}",
                             tier="fast", schema=REQ_SCHEMA, schema_name="requirements",
                             max_tokens=1200)
    except llm.AIUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            f"AI requirement extraction unavailable: {exc}")
    out = []
    seen = set()
    for r in data.get("requirements") or []:
        label = (r.get("label") or "").strip()
        canon = skills.canonical(label)
        if not label or canon in seen:
            continue
        seen.add(canon)
        out.append({"label": skills.display(canon), "importance": r.get("importance", "required"),
                    "kind": r.get("kind", "skill"), "weight": 1.0,
                    "min_years": r.get("min_years"), "evidence_hint": r.get("evidence_hint")})
    return {"requirements": out}


@router.get("/{job_id}/talent-pool")
def talent_pool(job_id: int, db: Session = Depends(get_db),
                recruiter: m.User = Depends(require_recruiter)):
    """Previously reviewed candidates not yet applied to this job (R31)."""
    _owned_job(db, job_id, recruiter)
    applied = {a.candidate_id for a in db.scalars(
        select(m.Application).where(m.Application.job_id == job_id)).all()}
    rows = db.execute(
        select(m.Application.candidate_id, m.Assessment.overall, m.User.full_name, m.User.email)
        .join(m.Assessment, m.Assessment.application_id == m.Application.id)
        .join(m.User, m.User.id == m.Application.candidate_id)
    ).all()
    best: dict[int, dict] = {}
    for cid, overall, name, email in rows:
        if cid in applied:
            continue
        if cid not in best or overall > best[cid]["score"]:
            best[cid] = {"candidate_id": cid, "name": name, "email": email,
                         "score": overall, "evidence": [], "matched": [], "missing": []}
    return {"job_id": job_id,
            "candidates": sorted(best.values(), key=lambda x: -x["score"])}


@router.get("/{job_id}/applicants")
def job_applicants(job_id: int, db: Session = Depends(get_db),
                   recruiter: m.User = Depends(require_recruiter)):
    """Contract path from contracts/types.ts (kept here so the path matches the frontend)."""
    from routers.applications import applicants

    return applicants(job_id=job_id, db=db, recruiter=recruiter)
