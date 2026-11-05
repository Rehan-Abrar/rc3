from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import models as m
import schemas
import serializers as S
from db import get_db
from security import require_recruiter
from services import llm

router = APIRouter(tags=["questions"])

Q_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["beginner", "intermediate", "advanced"]},
            "category": {"type": "string", "enum": ["skill", "project", "experience", "behavioral"]},
            "guideline": {"type": "string"},
        },
        "required": ["text", "difficulty", "category", "guideline"],
        "additionalProperties": False}}},
    "required": ["questions"],
    "additionalProperties": False,
}

SYSTEM = """You write interview questions for a specific candidate and job.
Rules:
- Use ONLY evidence present in the candidate material. Quote the specific resume line you build on.
- Ask about their real projects and the exact technologies they claim.
- Include what a weak answer looks like and what a strong answer must contain in "guideline".
- Never ask about age, gender, marital status, nationality, religion, disability or family plans."""


def _owned_app(db: Session, app_id: int, recruiter: m.User) -> m.Application:
    a = db.get(m.Application, app_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    job = db.get(m.Job, a.job_id)
    if not job or job.recruiter_id != recruiter.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your vacancy")
    return a


@router.post("/applications/{app_id}/questions/generate", status_code=201)
def generate(app_id: int, body: schemas.GenerateQuestionsIn, db: Session = Depends(get_db),
             recruiter: m.User = Depends(require_recruiter)):
    a = _owned_app(db, app_id, recruiter)
    job = db.get(m.Job, a.job_id)
    cand = db.get(m.User, a.candidate_id)
    resume = db.get(m.Resume, a.resume_id)
    ass = db.scalar(select(m.Assessment).where(m.Assessment.application_id == a.id))
    evidence = []
    if ass:
        evidence = [f"- {s.label}: {s.evidence_quote}" for s in ass.skills_detail
                    if s.evidence_quote and s.support == "verified"][:12]
    user = (f"JOB: {job.title}\nREQUIREMENTS: {', '.join(r.label for r in job.requirements)}\n"
            f"CANDIDATE: {cand.full_name}\nEVIDENCE FROM RESUME:\n" + "\n".join(evidence) +
            f"\n\nRESUME EXCERPTS:\n{(resume.raw_text or '')[:4000]}\n\n"
            f"Generate {body.per_difficulty} questions per difficulty "
            f"(beginner, intermediate, advanced), mixing skill and project categories.")
    try:
        data = llm.chat_json(SYSTEM, user, tier="fast", schema=Q_SCHEMA,
                             schema_name="questions", max_tokens=2400)
    except llm.AIUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            f"Question generation unavailable: {exc}")
    created = []
    for q in data.get("questions") or []:
        row = m.InterviewQuestion(application_id=a.id, text=q["text"][:1200],
                                  difficulty=q["difficulty"], category=q["category"],
                                  guideline=q["guideline"][:2000], source="ai")
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return [S.question(q) for q in created]


@router.post("/applications/{app_id}/questions/regenerate/{qid}", status_code=201)
def regenerate(app_id: int, qid: int, db: Session = Depends(get_db),
               recruiter: m.User = Depends(require_recruiter)):
    _owned_app(db, app_id, recruiter)
    old = db.get(m.InterviewQuestion, qid)
    if not old or old.application_id != app_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    db.delete(old)
    db.commit()
    return generate(app_id, schemas.GenerateQuestionsIn(per_difficulty=1), db, recruiter)


@router.get("/applications/{app_id}/questions")
def list_questions(app_id: int, db: Session = Depends(get_db),
                   recruiter: m.User = Depends(require_recruiter)):
    _owned_app(db, app_id, recruiter)
    rows = db.scalars(select(m.InterviewQuestion).where(
        m.InterviewQuestion.application_id == app_id).order_by(m.InterviewQuestion.id)).all()
    return [S.question(q) for q in rows]


@router.patch("/questions/{qid}")
def update_question(qid: int, body: schemas.QuestionPatch, db: Session = Depends(get_db),
                    recruiter: m.User = Depends(require_recruiter)):
    q = db.get(m.InterviewQuestion, qid)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    _owned_app(db, q.application_id, recruiter)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(q, key, value)
    q.source = "human"
    db.commit()
    db.refresh(q)
    return S.question(q)


@router.delete("/questions/{qid}", status_code=204)
def delete_question(qid: int, db: Session = Depends(get_db),
                    recruiter: m.User = Depends(require_recruiter)):
    q = db.get(m.InterviewQuestion, qid)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    _owned_app(db, q.application_id, recruiter)
    db.execute(delete(m.InterviewQuestion).where(m.InterviewQuestion.id == qid))
    db.commit()
    return None
