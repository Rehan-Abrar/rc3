from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import current_user, require_candidate, require_recruiter
from services import assess as assess_svc

router = APIRouter(prefix="/applications", tags=["applications"])

RECRUITER_STAGES = {"recruiter_review", "shortlisted", "rejected", "interview", "selected"}
ALLOWED = {
    "submitted": {"parsed", "assessed", "recruiter_review", "rejected"},
    "parsed": {"assessed", "recruiter_review", "rejected"},
    "assessed": {"recruiter_review", "shortlisted", "rejected"},
    "recruiter_review": {"shortlisted", "rejected", "interview"},
    "shortlisted": {"interview", "rejected", "recruiter_review"},
    "interview": {"selected", "rejected", "shortlisted"},
    "rejected": {"recruiter_review"},
    "selected": {"interview"},
}


def _app_or_404(db: Session, app_id: int) -> m.Application:
    a = db.get(m.Application, app_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return a


def _recruiter_app(db: Session, app_id: int, recruiter: m.User) -> m.Application:
    a = _app_or_404(db, app_id)
    job = db.get(m.Job, a.job_id)
    if not job or job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This application belongs to another recruiter")
    return a


@router.post("", status_code=201)
def apply(body: schemas.ApplyIn, db: Session = Depends(get_db),
          user: m.User = Depends(require_candidate)):
    job = db.get(m.Job, body.job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT, "This vacancy is closed")
    resume = db.get(m.Resume, body.resume_id)
    if not resume or resume.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Upload your own resume before applying")
    if resume.parse_status != "ok":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Your resume could not be parsed. Fix the PDF or correct details first.")
    dup = db.scalar(select(m.Application).where(m.Application.job_id == job.id,
                                                m.Application.candidate_id == user.id))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already applied to this vacancy")
    a = m.Application(job_id=job.id, candidate_id=user.id, resume_id=resume.id, stage="submitted")
    db.add(a)
    db.flush()
    db.add(m.StatusEvent(application_id=a.id, actor_id=user.id, from_stage=None,
                         to_stage="submitted", reason="Candidate applied"))
    db.commit()
    db.refresh(a)
    try:
        assess_svc.run_assessment(db, a, user.id)
    except Exception:  # noqa: BLE001 - assessment failure must not lose the application
        db.rollback()
    db.refresh(a)
    return S.application(a)


@router.get("/mine")
def my_applications(db: Session = Depends(get_db), user: m.User = Depends(require_candidate)):
    rows = db.scalars(select(m.Application).where(m.Application.candidate_id == user.id)
                      .order_by(m.Application.created_at.desc())).all()
    out = []
    for a in rows:
        job = db.get(m.Job, a.job_id)
        item = S.application(a)
        item["job"] = S.job_summary(db, job)
        item["assessment"] = assess_svc.assessment_payload(db, a)
        out.append(item)
    return out


@router.get("/{app_id}")
def application_detail(app_id: int, db: Session = Depends(get_db),
                       user: m.User = Depends(current_user)):
    a = _app_or_404(db, app_id)
    job = db.get(m.Job, a.job_id)
    if user.role == "candidate":
        if a.candidate_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your application")
        events = db.scalars(select(m.StatusEvent).where(m.StatusEvent.application_id == a.id)
                            .order_by(m.StatusEvent.id)).all()
        item = S.application(a)
        item.update({"job": S.job_summary(db, job),
                     "assessment": assess_svc.assessment_payload(db, a),
                     "questions": [], "interviews": [], "notes": [],
                     "events": [S.event(e, (db.get(m.User, e.actor_id).full_name
                                            if db.get(m.User, e.actor_id) else "system"))
                                for e in events],
                     "resume": S.resume(db.get(m.Resume, a.resume_id)),
                     "candidate": S.user(user)})
        return item
    if job.recruiter_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    cand = db.get(m.User, a.candidate_id)
    resume = db.get(m.Resume, a.resume_id)
    events = db.scalars(select(m.StatusEvent).where(m.StatusEvent.application_id == a.id)
                        .order_by(m.StatusEvent.id)).all()
    notes = db.scalars(select(m.Note).where(m.Note.application_id == a.id)
                       .order_by(m.Note.id)).all()
    qs = db.scalars(select(m.InterviewQuestion).where(
        m.InterviewQuestion.application_id == a.id).order_by(m.InterviewQuestion.id)).all()
    ivs = db.scalars(select(m.Interview).where(m.Interview.application_id == a.id)
                     .order_by(m.Interview.scheduled_at)).all()
    item = S.application(a)
    item.update({
        "job": S.job_summary(db, job), "candidate": S.user(cand),
        "resume": S.resume(resume) if resume else None,
        "assessment": assess_svc.assessment_payload(db, a),
        "events": [S.event(e, (db.get(m.User, e.actor_id).full_name if db.get(m.User, e.actor_id)
                               else "system")) for e in events],
        "notes": [S.note(n, (db.get(m.User, n.author_id).full_name if db.get(m.User, n.author_id)
                             else "system")) for n in notes],
        "questions": [S.question(q) for q in qs],
        "interviews": [S.interview(i, cand.full_name, job.title,
                                   db.get(m.User, i.interviewer_id).full_name)
                       for i in ivs],
    })
    return item


@router.get("/job/{job_id}/applicants")
def applicants(job_id: int, db: Session = Depends(get_db),
               recruiter: m.User = Depends(require_recruiter)):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    rows = db.execute(
        select(m.Application, m.User, m.Assessment)
        .join(m.User, m.User.id == m.Application.candidate_id)
        .outerjoin(m.Assessment, m.Assessment.application_id == m.Application.id)
        .where(m.Application.job_id == job_id)).all()
    out = []
    for a, cand, ass in rows:
        score = S.score_block(ass, "", "dense")
        if a.override_score is not None and score:
            score = {**score, "overall": a.override_score}
        detail = []
        if ass:
            detail = [S.skill_row(s) for s in ass.skills_detail]
        out.append({
            "application_id": a.id, "job_id": a.job_id, "stage": a.stage,
            "candidate": {"id": cand.id, "name": cand.full_name, "email": cand.email},
            "resume_id": a.resume_id,
            "resume_filename": (db.get(m.Resume, a.resume_id).filename
                                if db.get(m.Resume, a.resume_id) else ""),
            "score": score,
            "matched": [d["label"] for d in detail if d["status"] == "matched"],
            "missing": [d["label"] for d in detail if d["status"] in ("not_evidenced",
                                                                     "confirmed_absent")],
            "has_notes": bool(db.scalar(select(m.Note.id).where(
                m.Note.application_id == a.id).limit(1))),
        })
    out.sort(key=lambda x: (x["score"]["overall"] if x["score"] else -1), reverse=True)
    return out


@router.patch("/{app_id}/stage")
def change_stage(app_id: int, body: schemas.StageIn, db: Session = Depends(get_db),
                 recruiter: m.User = Depends(require_recruiter)):
    a = _recruiter_app(db, app_id, recruiter)
    if body.to_stage == a.stage:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Application is already in that stage")
    if body.to_stage not in ALLOWED.get(a.stage, set()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Cannot move from {a.stage} to {body.to_stage}")
    assess_svc.log_stage(db, a, recruiter.id, body.to_stage, body.reason or "Recruiter action")
    db.commit()
    db.refresh(a)
    return S.application(a)


@router.post("/{app_id}/override")
def override_score(app_id: int, body: schemas.OverrideIn, db: Session = Depends(get_db),
                   recruiter: m.User = Depends(require_recruiter)):
    a = _recruiter_app(db, app_id, recruiter)
    a.override_score = body.score
    a.override_reason = body.reason
    db.commit()
    db.refresh(a)
    return S.application(a)


@router.post("/{app_id}/notes", status_code=201)
def add_note(app_id: int, body: schemas.NoteIn, db: Session = Depends(get_db),
             recruiter: m.User = Depends(require_recruiter)):
    a = _recruiter_app(db, app_id, recruiter)
    n = m.Note(application_id=a.id, author_id=recruiter.id, body=body.body.strip())
    db.add(n)
    db.commit()
    db.refresh(n)
    return S.note(n, recruiter.full_name)


@router.post("/{app_id}/assess")
def assess(app_id: int, force: bool = False, db: Session = Depends(get_db),
           user: m.User = Depends(current_user)):
    a = _app_or_404(db, app_id)
    if user.role == "candidate":
        if a.candidate_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your application")
    else:
        job = db.get(m.Job, a.job_id)
        if not job or job.recruiter_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    # Cached by default: an assessment costs two model calls, so only recompute on request.
    existing = db.scalar(select(m.Assessment).where(m.Assessment.application_id == a.id))
    if existing is not None and not force:
        return assess_svc.assessment_payload(db, a)
    assess_svc.run_assessment(db, a, user.id)
    return assess_svc.assessment_payload(db, a)


@router.get("/{app_id}/assessment")
def get_assessment(app_id: int, db: Session = Depends(get_db),
                  user: m.User = Depends(current_user)):
    a = _app_or_404(db, app_id)
    if user.role == "candidate" and a.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your application")
    if user.role == "recruiter" and db.get(m.Job, a.job_id).recruiter_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    payload = assess_svc.assessment_payload(db, a)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No assessment yet")
    return payload


@router.post("/{app_id}/reassess")
def reassess_alias(app_id: int, force: bool = True, db: Session = Depends(get_db),
                   user: m.User = Depends(current_user)):
    """Alias of /applications/{id}/assess (frontend path)."""
    return assess(app_id, force, db, user)
