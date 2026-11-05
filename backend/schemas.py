"""Request bodies. Responses are serialized explicitly in serializers.py to match
contracts/types.ts exactly (verified by tests/test_contract_shape.py)."""
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

Role = Literal["recruiter", "candidate"]
Stage = Literal["submitted", "parsed", "assessed", "recruiter_review", "shortlisted",
                "rejected", "interview", "selected"]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=160)
    role: Role


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class RequirementIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    importance: Literal["required", "preferred"] = "required"
    kind: Literal["skill", "qualification"] = "skill"
    weight: float = Field(default=1.0, ge=0.05, le=5.0)
    min_years: float | None = Field(default=None, ge=0, le=50)
    evidence_hint: str | None = None


class WeightsIn(BaseModel):
    """Assessment weights in percent. All four must be supplied and sum to 100."""
    skills: float = Field(ge=0, le=100)
    experience: float = Field(ge=0, le=100)
    projects: float = Field(ge=0, le=100)
    qualifications: float = Field(ge=0, le=100)

    def dimensions(self) -> dict:
        """Just the four weights, ignoring apply-time extras like reason or recalculate."""
        return {d: getattr(self, d) for d in ("skills", "experience", "projects", "qualifications")}

    @model_validator(mode="after")
    def check_total(self):
        # One authority: the same function the scoring engine uses, so the API cannot accept a
        # configuration the engine would reject (or vice versa).
        from services import scoring as sc
        sc.validate(self.dimensions())
        return self


class WeightsApplyIn(WeightsIn):
    reason: str | None = Field(default=None, max_length=500)
    recalculate: bool = True


class WeightsSaveIn(WeightsApplyIn):
    """Saving is a deliberate act: an explicit confirm flag is required."""
    confirm: bool = False


class JobIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    department: str = Field(default="", max_length=120)
    location: str = Field(default="", max_length=120)
    employment_type: str = Field(default="full_time", max_length=40)
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    description: str = Field(default="", max_length=8000)
    status: Literal["open", "closed"] = "open"
    requirements: list[RequirementIn] = Field(default_factory=list)
    weights: WeightsIn | None = None

    @field_validator("salary_max")
    @classmethod
    def check_range(cls, v, info):
        lo = info.data.get("salary_min")
        if v is not None and lo is not None and v < lo:
            raise ValueError("salary_max must be >= salary_min")
        return v


class JobPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    department: str | None = None
    location: str | None = None
    employment_type: str | None = None
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=8000)
    status: Literal["open", "closed"] | None = None
    requirements: list[RequirementIn] | None = None
    weights: WeightsIn | None = None


class ExtractRequirementsIn(BaseModel):
    description: str = Field(min_length=20, max_length=8000)
    title: str = Field(default="", max_length=160)


class ApplyIn(BaseModel):
    job_id: int = Field(gt=0)
    resume_id: int = Field(gt=0)


class StageIn(BaseModel):
    to_stage: Stage
    reason: str | None = Field(default=None, max_length=500)


class OverrideIn(BaseModel):
    score: float = Field(ge=0, le=100)
    reason: str = Field(min_length=3, max_length=500)


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class SkillsPatchIn(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=60)


class QuestionPatch(BaseModel):
    text: str | None = Field(default=None, min_length=5, max_length=1200)
    guideline: str | None = Field(default=None, max_length=2000)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    category: Literal["skill", "project", "experience", "behavioral"] | None = None


class GenerateQuestionsIn(BaseModel):
    per_difficulty: int = Field(default=2, ge=1, le=4)


class InterviewIn(BaseModel):
    application_id: int = Field(gt=0)
    scheduled_at: str  # ISO 8601 from the client
    duration_min: int = Field(default=45, ge=15, le=240)
    interviewer_id: int = Field(gt=0)
    interview_type: Literal["technical", "hr", "system_design", "panel"] = "technical"
    location: str | None = Field(default=None, max_length=160)


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    strengths: str = Field(default="", max_length=2000)
    concerns: str = Field(default="", max_length=2000)
    recommendation: Literal["strong_yes", "yes", "no", "strong_no"] = "yes"


class DecisionIn(BaseModel):
    decision: Literal["selected", "rejected"]
    rationale: str = Field(default="", max_length=2000)


class MergeIn(BaseModel):
    keep_id: int = Field(gt=0)
    merge_id: int = Field(gt=0)
