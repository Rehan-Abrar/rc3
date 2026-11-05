"""Explicit response shapes. Must match contracts/types.ts field-for-field."""
import json
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models as m


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def user(u: m.User) -> dict:
    return {"id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "created_at": iso(u.created_at)}


def auth(token: str, u: m.User) -> dict:
    return {"token": token, "user": user(u)}


def requirement(r: m.JobRequirement) -> dict:
    return {"id": r.id, "kind": r.kind, "label": r.label, "canonical": r.canonical,
            "importance": r.importance, "weight": r.weight,
            "min_years": r.min_years, "evidence_hint": r.evidence_hint}


def job_summary(db: Session, j: m.Job) -> dict:
    apps = db.scalar(select(func.count(m.Application.id)).where(m.Application.job_id == j.id)) or 0
    short = db.scalar(select(func.count(m.Application.id)).where(
        m.Application.job_id == j.id, m.Application.stage == "shortlisted")) or 0
    inter = db.scalar(select(func.count(m.Interview.id)).join(m.Application).where(
        m.Application.job_id == j.id)) or 0
    return {"id": j.id, "title": j.title, "department": j.department, "location": j.location,
            "employment_type": j.employment_type, "salary_min": j.salary_min,
            "salary_max": j.salary_max, "status": j.status,
            "created_at": iso(j.created_at), "updated_at": iso(j.updated_at),
            "applicant_count": apps, "shortlisted_count": short, "interview_count": inter}


def job_detail(db: Session, j: m.Job) -> dict:
    d = job_summary(db, j)
    d.update({"description": j.description, "recruiter_id": j.recruiter_id,
              "requirements": [requirement(r) for r in sorted(j.requirements, key=lambda x: x.id)]})
    return d


def resume(r: m.Resume) -> dict:
    return {"id": r.id, "candidate_id": r.candidate_id, "filename": r.filename, "mime": r.mime,
            "size_bytes": r.size_bytes, "page_count": r.page_count,
            "parse_status": r.parse_status, "parse_error": r.parse_error,
            "raw_text": r.raw_text, "created_at": iso(r.created_at),
            "extracted": json.loads(r.extracted_json) if r.extracted_json else None}


def resume_lite(r: m.Resume) -> dict:
    d = resume(r)
    return d


def application(a: m.Application) -> dict:
    return {"id": a.id, "job_id": a.job_id, "candidate_id": a.candidate_id,
            "resume_id": a.resume_id, "stage": a.stage, "created_at": iso(a.created_at),
            "updated_at": iso(a.updated_at), "override_score": a.override_score,
            "override_reason": a.override_reason}


def _raw_payload(a: m.Assessment) -> dict:
    payload = getattr(a, "_payload_cache", None)
    if payload is None:
        try:
            payload = json.loads(a.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        a._payload_cache = payload
    return payload


def score_block(a: m.Assessment | None, ai_mode: str, emb_mode: str) -> dict | None:
    if a is None:
        return None
    payload = _raw_payload(a)
    return {"overall": a.overall, "skills": a.skills_score, "experience": a.experience_score,
            "projects": a.projects_score, "qualifications": a.qualifications_score,
            "confidence": a.confidence, "insufficient_evidence": a.insufficient_evidence,
            "ai_mode": a.ai_mode or ai_mode, "embedding_mode": a.embedding_mode or emb_mode,
            "model": a.model,
            # A dimension listed here was not scored, so its 0.0 is "not applicable", not a fail.
            "not_measured": payload.get("not_measured", []),
            "effective_weights": payload.get("effective_weights", {})}


def skill_row(s: m.AssessmentSkill) -> dict:
    ev = None
    if s.evidence_quote:
        ev = {"quote": s.evidence_quote, "start": s.evidence_start, "end": s.evidence_end}
    return {"requirement_id": s.requirement_id, "label": s.label, "importance": s.importance,
            "weight": s.weight, "status": s.status, "score": s.score,
            "similarity": s.similarity, "evidence": ev, "support": s.support,
            "reason": s.reason}


def assessment(a: m.Assessment, ai_mode: str, emb_mode: str) -> dict:
    base = score_block(a, ai_mode, emb_mode) or {}
    payload = _raw_payload(a)
    base.update({"id": a.id, "application_id": a.application_id,
                 "summary": a.summary, "explanation": a.explanation,
                 "skills_detail": [skill_row(s) for s in a.skills_detail],
                 "gaps": payload.get("gaps", []),
                 "learning_suggestions": payload.get("learning_suggestions", []),
                 "created_at": iso(a.created_at)})
    return base


def event(e: m.StatusEvent, actor_name: str) -> dict:
    return {"id": e.id, "application_id": e.application_id, "actor_id": e.actor_id,
            "actor_name": actor_name, "from_stage": e.from_stage, "to_stage": e.to_stage,
            "reason": e.reason, "created_at": iso(e.created_at)}


def note(n: m.Note, author_name: str) -> dict:
    return {"id": n.id, "application_id": n.application_id, "author_name": author_name,
            "body": n.body, "created_at": iso(n.created_at)}


def question(q: m.InterviewQuestion) -> dict:
    return {"id": q.id, "application_id": q.application_id, "text": q.text,
            "difficulty": q.difficulty, "category": q.category, "guideline": q.guideline,
            "source": q.source, "created_at": iso(q.created_at)}


def interview(i: m.Interview, candidate_name: str, job_title: str, interviewer_name: str) -> dict:
    return {"id": i.id, "application_id": i.application_id, "candidate_name": candidate_name,
            "job_title": job_title, "scheduled_at": iso(i.scheduled_at),
            "duration_min": i.duration_min, "interviewer_id": i.interviewer_id,
            "interviewer_name": interviewer_name, "interview_type": i.interview_type,
            "location": i.location, "status": i.status, "conflict_flag": i.conflict_flag}


def feedback(f: m.Feedback, interviewer_name: str) -> dict:
    return {"id": f.id, "interview_id": f.interview_id, "interviewer_name": interviewer_name,
            "rating": f.rating, "strengths": f.strengths, "concerns": f.concerns,
            "recommendation": f.recommendation, "created_at": iso(f.created_at)}
