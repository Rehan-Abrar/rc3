from datetime import datetime, timezone

from sqlalchemy import (Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(20), index=True)  # recruiter | candidate
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    department: Mapped[str] = mapped_column(String(120), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    employment_type: Mapped[str] = mapped_column(String(40), default="full_time")
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    requirements: Mapped[list["JobRequirement"]] = relationship(
        back_populates="job", cascade="all, delete-orphan")


class JobRequirement(Base):
    __tablename__ = "job_requirements"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="skill")  # skill | qualification
    label: Mapped[str] = mapped_column(String(120))
    canonical: Mapped[str] = mapped_column(String(120), index=True)
    importance: Mapped[str] = mapped_column(String(20), default="required")
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    min_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped[Job] = relationship(back_populates="requirements")


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str | None] = mapped_column(String(255), nullable=True)  # file on disk under data/resumes/
    mime: Mapped[str] = mapped_column(String(120), default="application/pdf")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    parse_status: Mapped[str] = mapped_column(String(20), default="ok")  # ok | empty | failed
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ResumeChunk(Base):
    __tablename__ = "resume_chunks"
    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), index=True)
    section: Mapped[str] = mapped_column(String(40), default="other")
    text: Mapped[str] = mapped_column(Text)
    char_start: Mapped[int] = mapped_column(Integer, default=0)
    char_end: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)  # json list of floats


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_application"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"))
    stage: Mapped[str] = mapped_column(String(30), default="submitted", index=True)
    override_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True, index=True)
    overall: Mapped[float] = mapped_column(Float, default=0.0)
    skills_score: Mapped[float] = mapped_column(Float, default=0.0)
    experience_score: Mapped[float] = mapped_column(Float, default=0.0)
    projects_score: Mapped[float] = mapped_column(Float, default=0.0)
    qualifications_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[str] = mapped_column(String(20), default="low")
    insufficient_evidence: Mapped[bool] = mapped_column(Boolean, default=True)
    ai_mode: Mapped[str] = mapped_column(String(20), default="heuristic")
    embedding_mode: Mapped[str] = mapped_column(String(20), default="dense")
    model: Mapped[str] = mapped_column(String(120), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")  # skills_detail, gaps, learning
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    skills_detail: Mapped[list["AssessmentSkill"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan")


class AssessmentSkill(Base):
    __tablename__ = "assessment_skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(120))
    importance: Mapped[str] = mapped_column(String(20), default="required")
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(30), default="not_evidenced")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    similarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    support: Mapped[str] = mapped_column(String(30), default="flagged_unverified")
    reason: Mapped[str] = mapped_column(Text, default="")

    assessment: Mapped[Assessment] = relationship(back_populates="skills_detail")


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StatusEvent(Base):
    __tablename__ = "status_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_stage: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(20), default="intermediate")
    category: Mapped[str] = mapped_column(String(20), default="skill")
    guideline: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(20), default="ai")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_min: Mapped[int] = mapped_column(Integer, default=45)
    interviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    interview_type: Mapped[str] = mapped_column(String(30), default="technical")
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    conflict_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    interview_id: Mapped[int] = mapped_column(ForeignKey("interviews.id"), index=True)
    interviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer, default=3)
    strengths: Mapped[str] = mapped_column(Text, default="")
    concerns: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(String(20), default="yes")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinalDecision(Base):
    __tablename__ = "final_decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(20))
    rationale: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
