from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models as m
from db import get_db
from security import require_recruiter

router = APIRouter(prefix="/analytics", tags=["analytics"])

STAGES = ["submitted", "parsed", "assessed", "recruiter_review", "shortlisted",
          "rejected", "interview", "selected"]


@router.get("/overview")
def overview(db: Session = Depends(get_db), recruiter: m.User = Depends(require_recruiter)):
    job_ids = [j.id for j in db.scalars(
        select(m.Job).where(m.Job.recruiter_id == recruiter.id)).all()]
    apps = db.scalars(select(m.Application).where(
        m.Application.job_id.in_(job_ids) if job_ids else False)).all()
    app_ids = [a.id for a in apps]

    shortlisted = sum(1 for a in apps if a.stage in ("shortlisted", "interview", "selected"))
    pending = sum(1 for a in apps if a.stage in ("assessed", "recruiter_review", "submitted",
                                                 "parsed"))
    interviews = db.scalar(select(func.count(m.Interview.id)).where(
        m.Interview.application_id.in_(app_ids) if app_ids else False)) or 0
    active_jobs = sum(1 for j in db.scalars(
        select(m.Job).where(m.Job.recruiter_id == recruiter.id)).all() if j.status == "open")

    by_job = []
    for jid in job_ids:
        job = db.get(m.Job, jid)
        japps = [a for a in apps if a.job_id == jid]
        by_job.append({"job_id": jid, "title": job.title, "applications": len(japps),
                       "shortlisted": sum(1 for a in japps
                                          if a.stage in ("shortlisted", "interview", "selected")),
                       "interviews": db.scalar(select(func.count(m.Interview.id)).where(
                           m.Interview.application_id.in_([a.id for a in japps])
                           if japps else False)) or 0})

    by_stage = {s: 0 for s in STAGES}
    for a in apps:
        by_stage[a.stage] = by_stage.get(a.stage, 0) + 1

    now = datetime.utcnow()
    hours = [(now - a.created_at).total_seconds() / 3600.0 for a in apps]
    avg_processing = round(sum(hours) / len(hours), 1) if hours else 0.0

    gaps: dict[str, int] = {}
    for aid in app_ids:
        for s in db.scalars(select(m.AssessmentSkill).join(
                m.Assessment, m.Assessment.id == m.AssessmentSkill.assessment_id).where(
                m.Assessment.application_id == aid,
                m.AssessmentSkill.status.in_(["not_evidenced", "confirmed_absent"]))).all():
            gaps[s.label] = gaps.get(s.label, 0) + 1

    return {
        "active_jobs": active_jobs, "applications": len(apps), "shortlisted": shortlisted,
        "pending_reviews": pending, "interviews": interviews,
        "shortlist_rate": round(100.0 * shortlisted / len(apps), 1) if apps else 0.0,
        "avg_processing_hours": avg_processing,
        "by_job": by_job,
        "by_stage": [{"stage": s, "count": c} for s, c in by_stage.items()],
        "common_gaps": [{"skill": k, "count": v}
                        for k, v in sorted(gaps.items(), key=lambda x: -x[1])[:8]],
    }
