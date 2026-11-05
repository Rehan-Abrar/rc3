"""Recruiter-configurable assessment weights and the What-If ranking simulator.

Extends the existing /jobs/{id}/... surface rather than inventing a parallel one:
  GET  /jobs/{id}/weights          current configuration + change history
  PUT  /jobs/{id}/weights          save a configuration (validated, audited, re-scored)
  POST /jobs/{id}/what-if          simulate weights without touching the database
  POST /jobs/{id}/what-if/apply    save the configuration that was simulated

The simulator is pure arithmetic over stored dimension scores: it never calls the LLM, never
writes, and never changes a stage, note, interview or override.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import require_recruiter
from services import scoring

router = APIRouter(prefix="/jobs", tags=["scoring"])


def _owned_job(db: Session, job_id: int, recruiter: m.User) -> m.Job:
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    return job


def _history(db: Session, job_id: int, limit: int = 20) -> list[dict]:
    rows = db.scalars(select(m.ScoringConfig).where(m.ScoringConfig.job_id == job_id)
                      .order_by(m.ScoringConfig.id.desc()).limit(limit)).all()
    out = []
    for r in rows:
        actor = db.get(m.User, r.recruiter_id)
        out.append({"id": r.id, "version": r.version,
                    "recruiter_id": r.recruiter_id,
                    "recruiter_name": actor.full_name if actor else "",
                    "previous": json.loads(r.previous_json or "{}"),
                    "new": json.loads(r.new_json or "{}"),
                    "reason": r.reason or "",
                    "assessments_updated": r.assessments_updated,
                    "created_at": S.iso(r.created_at)})
    return out


def _config(db: Session, job: m.Job) -> dict:
    configured = scoring.to_percent(scoring.from_job(job))
    is_default = all(abs(configured[d] - scoring.DEFAULT_WEIGHTS[d]) < 0.001 for d in scoring.DIMENSIONS)
    return {"job_id": job.id, "configured": configured,
            "default": dict(scoring.DEFAULT_WEIGHTS),
            "is_default": is_default,
            "version": int(getattr(job, "scoring_version", 1) or 1),
            "updated_at": S.iso(job.updated_at),
            "history": _history(db, job.id)}


@router.get("/{job_id}/weights")
def get_weights(job_id: int, db: Session = Depends(get_db),
                recruiter: m.User = Depends(require_recruiter)):
    return _config(db, _owned_job(db, job_id, recruiter))


def _apply(db: Session, job: m.Job, recruiter: m.User, body: schemas.WeightsApplyIn) -> dict:
    """Persist a configuration, re-derive stored totals, and write one audit row."""
    try:
        clean = scoring.validate(body.dimensions())
    except scoring.WeightsError as exc:  # pydantic already checked; belt and braces
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    previous = scoring.to_percent(scoring.from_job(job))
    unchanged = all(abs(previous[d] - clean[d]) < 0.001 for d in scoring.DIMENSIONS)
    for d in scoring.DIMENSIONS:
        setattr(job, f"weight_{d}", clean[d])
    if not unchanged:
        job.scoring_version = int(getattr(job, "scoring_version", 1) or 1) + 1
    db.flush()

    recalculation = (scoring.recalculate_job(db, job, commit=False)
                     if body.recalculate else
                     {"assessments": 0, "updated": 0, "score_changed": 0, "skipped": 0,
                      "skipped_rows": [], "note": "recalculate=false: scores left untouched"})

    audit = m.ScoringConfig(job_id=job.id, recruiter_id=recruiter.id,
                            version=job.scoring_version,
                            previous_json=json.dumps(previous), new_json=json.dumps(clean),
                            reason=(body.reason or "").strip(),
                            assessments_updated=recalculation.get("updated", 0))
    db.add(audit)
    db.commit()
    db.refresh(job)
    out = _config(db, job)
    out.update({"ok": True, "audit_id": audit.id, "unchanged": unchanged,
                "recalculations": recalculation})
    return out


@router.put("/{job_id}/weights")
def put_weights(job_id: int, body: schemas.WeightsApplyIn, db: Session = Depends(get_db),
                recruiter: m.User = Depends(require_recruiter)):
    job = _owned_job(db, job_id, recruiter)
    return _apply(db, job, recruiter, body)


def _applicant_rows(db: Session, job: m.Job) -> list[dict]:
    """Dimensions from stored assessments, ready for simulation. No AI, no writes."""
    rows = db.execute(
        select(m.Application, m.User, m.Assessment)
        .join(m.User, m.User.id == m.Application.candidate_id)
        .outerjoin(m.Assessment, m.Assessment.application_id == m.Application.id)
        .where(m.Application.job_id == job.id)).all()
    job_weights = scoring.from_job(job)
    out = []
    for app_row, cand, ass in rows:
        payload = {}
        try:
            payload = json.loads(getattr(ass, "payload_json", "") or "{}") if ass else {}
        except json.JSONDecodeError:
            payload = {}
        out.append({
            "application_id": app_row.id,
            "candidate": {"id": cand.id, "name": cand.full_name},
            "stage": app_row.stage,
            "dims": scoring.assess_dims(ass) if ass else None,
            "current_overall": (ass.overall if ass else None),
            "configured": payload.get("configured_weights") or job_weights,
            "override_score": app_row.override_score,
            "override_reason": app_row.override_reason,
            "not_measured": payload.get("not_measured", []),
            "confidence": ass.confidence if ass else None,
            "insufficient_evidence": ass.insufficient_evidence if ass else None,
        })
    return out


@router.post("/{job_id}/what-if")
def what_if(job_id: int, body: schemas.WeightsApplyIn, db: Session = Depends(get_db),
            recruiter: m.User = Depends(require_recruiter)):
    """Rank the job's applicants under proposed weights. Read-only by construction."""
    job = _owned_job(db, job_id, recruiter)
    try:
        clean = scoring.validate(body.dimensions())
    except scoring.WeightsError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    result = scoring.simulate(_applicant_rows(db, job), clean)
    result.update({"job_id": job.id, "job_title": job.title,
                   "current_weights": scoring.to_percent(scoring.from_job(job)),
                   "version": int(getattr(job, "scoring_version", 1) or 1),
                   "is_default": all(abs(clean[d] - scoring.DEFAULT_WEIGHTS[d]) < 0.001
                                     for d in scoring.DIMENSIONS)})
    return result


@router.post("/{job_id}/what-if/apply")
def what_if_apply(job_id: int, body: schemas.WeightsSaveIn, db: Session = Depends(get_db),
                  recruiter: m.User = Depends(require_recruiter)):
    """Save the configuration that was simulated. Requires explicit confirm=true."""
    if not body.confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Saving weights requires explicit confirmation")
    job = _owned_job(db, job_id, recruiter)
    return _apply(db, job, recruiter, body)


@router.post("/{job_id}/weights/reset")
def reset_weights(job_id: int, db: Session = Depends(get_db),
                  recruiter: m.User = Depends(require_recruiter)):
    job = _owned_job(db, job_id, recruiter)
    body = schemas.WeightsApplyIn(reason="Reset to default 50/25/15/10",
                                  **scoring.DEFAULT_WEIGHTS)
    return _apply(db, job, recruiter, body)
