from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import require_recruiter

router = APIRouter(tags=["interviews"])


def _parse_dt(raw: str) -> datetime:
    txt = (raw or "").strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(txt)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "scheduled_at must be an ISO 8601 date-time")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _owned_app(db: Session, app_id: int, recruiter: m.User) -> m.Application:
    a = db.get(m.Application, app_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    job = db.get(m.Job, a.job_id)
    if not job or job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    return a


def _owned_interview(db: Session, interview_id: int, recruiter: m.User) -> m.Interview:
    i = db.get(m.Interview, interview_id)
    if not i:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found")
    _owned_app(db, i.application_id, recruiter)
    return i


def _payload(db: Session, i: m.Interview) -> dict:
    a = db.get(m.Application, i.application_id)
    cand = db.get(m.User, a.candidate_id) if a else None
    job = db.get(m.Job, a.job_id) if a else None
    interviewer = db.get(m.User, i.interviewer_id)
    return S.interview(i, cand.full_name if cand else "", job.title if job else "",
                       interviewer.full_name if interviewer else "")


@router.post("/interviews", status_code=201)
def schedule(body: schemas.InterviewIn, db: Session = Depends(get_db),
             recruiter: m.User = Depends(require_recruiter)):
    a = _owned_app(db, body.application_id, recruiter)
    interviewer = db.get(m.User, body.interviewer_id)
    if not interviewer or interviewer.role != "recruiter":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "interviewer_id must be an existing recruiter")
    start = _parse_dt(body.scheduled_at)
    end = start + timedelta(minutes=body.duration_min)

    existing = db.scalars(select(m.Interview).where(
        m.Interview.interviewer_id == body.interviewer_id,
        m.Interview.status == "scheduled")).all()
    for other in existing:
        o_start = other.scheduled_at
        o_end = o_start + timedelta(minutes=other.duration_min)
        if start < o_end and o_start < end:
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "detail": (f"{interviewer.full_name} already has an interview "
                           f"{S.iso(o_start)} to {S.iso(o_end)}"),
                "conflict_with": _payload(db, other)})

    i = m.Interview(application_id=a.id, scheduled_at=start, duration_min=body.duration_min,
                    interviewer_id=body.interviewer_id, interview_type=body.interview_type,
                    location=body.location)
    db.add(i)
    db.flush()
    db.add(m.StatusEvent(application_id=a.id, actor_id=recruiter.id, from_stage=a.stage,
                         to_stage="interview",
                         reason=f"Interview scheduled {S.iso(start)} ({body.interview_type})"))
    a.stage = "interview"
    db.commit()
    db.refresh(i)
    return _payload(db, i)


@router.get("/interviews")
def list_interviews(job_id: int | None = None, db: Session = Depends(get_db),
                    recruiter: m.User = Depends(require_recruiter)):
    stmt = select(m.Interview).order_by(m.Interview.scheduled_at)
    if job_id:
        stmt = stmt.join(m.Application, m.Application.id == m.Interview.application_id).where(
            m.Application.job_id == job_id)
    rows = db.scalars(stmt).all()
    mine = []
    for i in rows:
        a = db.get(m.Application, i.application_id)
        job = db.get(m.Job, a.job_id) if a else None
        if job and job.recruiter_id == recruiter.id:
            mine.append(_payload(db, i))
    return mine


@router.post("/interviews/{interview_id}/feedback", status_code=201)
def add_feedback(interview_id: int, body: schemas.FeedbackIn, db: Session = Depends(get_db),
                 recruiter: m.User = Depends(require_recruiter)):
    i = _owned_interview(db, interview_id, recruiter)
    f = m.Feedback(interview_id=i.id, interviewer_id=recruiter.id, rating=body.rating,
                   strengths=body.strengths, concerns=body.concerns,
                   recommendation=body.recommendation)
    db.add(f)
    i.status = "completed"
    db.commit()
    db.refresh(f)
    return S.feedback(f, recruiter.full_name)


@router.get("/interviews/{interview_id}/feedback")
def list_feedback(interview_id: int, db: Session = Depends(get_db),
                  recruiter: m.User = Depends(require_recruiter)):
    _owned_interview(db, interview_id, recruiter)
    rows = db.scalars(select(m.Feedback).where(m.Feedback.interview_id == interview_id)).all()
    out = []
    for f in rows:
        u = db.get(m.User, f.interviewer_id)
        out.append(S.feedback(f, u.full_name if u else ""))
    return out


@router.post("/interviews/{interview_id}/decision", status_code=201)
def record_decision(interview_id: int, body: schemas.DecisionIn, db: Session = Depends(get_db),
                    recruiter: m.User = Depends(require_recruiter)):
    i = db.get(m.Interview, interview_id)
    if not i:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found")
    a = _owned_app(db, i.application_id, recruiter)
    d = m.FinalDecision(application_id=a.id, recruiter_id=recruiter.id,
                        decision=body.decision, rationale=body.rationale)
    db.add(d)
    target = "selected" if body.decision == "selected" else "rejected"
    db.add(m.StatusEvent(application_id=a.id, actor_id=recruiter.id, from_stage=a.stage,
                         to_stage=target, reason=body.rationale or "Recruiter final decision"))
    a.stage = target
    db.commit()
    return {"id": d.id, "application_id": a.id, "decision": body.decision,
            "rationale": body.rationale, "stage": a.stage}
