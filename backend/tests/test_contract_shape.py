"""Every response field declared in contracts/types.ts must actually be returned.

Expected field sets mirror contracts/types.ts (source of truth). Keep them in sync; a
mismatch here means the frontend would read `undefined`.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from db import Base, engine
from main import app

CONTRACT = {
    "User": {"id", "email", "full_name", "role", "created_at"},
    "AuthResponse": {"token", "user"},
    "JobSummary": {"id", "title", "department", "location", "employment_type", "salary_min",
                   "salary_max", "status", "created_at", "updated_at", "applicant_count",
                   "shortlisted_count", "interview_count"},
    "JobDetail": {"id", "title", "department", "location", "employment_type", "salary_min",
                  "salary_max", "status", "created_at", "updated_at", "applicant_count",
                  "shortlisted_count", "interview_count", "description", "recruiter_id",
                  "requirements"},
    "Requirement": {"id", "kind", "label", "canonical", "importance", "weight", "min_years",
                    "evidence_hint"},
    "Score": {"overall", "skills", "experience", "projects", "qualifications", "confidence",
              "insufficient_evidence", "ai_mode", "embedding_mode", "model"},
    "ApplicantRow": {"application_id", "job_id", "stage", "candidate", "resume_id",
                     "resume_filename", "score", "matched", "missing", "has_notes"},
    "AnalyticsOverview": {"active_jobs", "applications", "shortlisted", "pending_reviews",
                          "interviews", "shortlist_rate", "avg_processing_hours", "by_job",
                          "by_stage", "common_gaps"},
    "TalentSearchResult": {"query", "mode", "hits", "parsed_requirements"},
    "TalentHit": {"candidate_id", "name", "email", "score", "evidence", "matched", "missing"},
    "FairnessAudit": {"passed", "baseline", "perturbed", "delta", "checks", "note"},
    "Health": {"status", "ai_mode", "embedding_mode", "db", "model"},
    "Assessment": {"id", "application_id", "overall", "skills", "experience", "projects",
                   "qualifications", "confidence", "insufficient_evidence", "ai_mode",
                   "embedding_mode", "model", "summary", "explanation", "skills_detail", "gaps",
                   "learning_suggestions", "created_at"},
    "SkillRow": {"requirement_id", "label", "importance", "weight", "status", "score",
                 "similarity", "evidence", "support", "reason"},
    "Application": {"id", "job_id", "candidate_id", "resume_id", "stage", "created_at",
                    "updated_at", "override_score", "override_reason"},
}


def check(obj: dict, name: str) -> None:
    missing = CONTRACT[name] - set(obj)
    assert not missing, f"{name}: response is missing contract fields {sorted(missing)}"


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture(scope="module")
def recruiter(client):
    body = {"email": "shape2@test.dev", "password": "Password123",
            "full_name": "Shape Test", "role": "recruiter"}
    r = client.post("/api/auth/register", json=body)
    data = r.json() if r.status_code == 201 else client.post(
        "/api/auth/login", json={"email": body["email"], "password": body["password"]}).json()
    return {"Authorization": f"Bearer {data['token']}"}


def test_auth_user_job_health_shapes(client, recruiter):
    me = client.get("/api/auth/me", headers=recruiter).json()
    check(me, "User")
    job = client.post("/api/jobs", headers=recruiter, json={
        "title": "Shape Job", "description": "python django",
        "requirements": [{"label": "Python", "importance": "required", "min_years": 2},
                         {"label": "REST APIs", "importance": "preferred"}]}).json()
    check(job, "JobDetail")
    check(job["requirements"][0], "Requirement")
    check(client.get("/api/jobs", headers=recruiter).json()[0], "JobSummary")
    check(client.get("/api/health").json(), "Health")


def test_analytics_talent_shapes(client, recruiter):
    ov = client.get("/api/analytics/overview", headers=recruiter).json()
    check(ov, "AnalyticsOverview")
    assert set(ov["by_job"][0]) >= {"job_id", "title", "applications", "shortlisted", "interviews"}
    assert set(ov["by_stage"][0]) == {"stage", "count"}
    assert isinstance(client.get("/api/talent/duplicates", headers=recruiter).json(), list)
    search = client.get("/api/talent/search?q=python", headers=recruiter).json()
    check(search, "TalentSearchResult")


def test_applicant_and_application_shapes(client, recruiter):
    job_id = client.get("/api/jobs", headers=recruiter).json()[0]["id"]
    for row in client.get(f"/api/jobs/{job_id}/applicants", headers=recruiter).json():
        check(row, "ApplicantRow")
        assert {"id", "name", "email"} <= set(row["candidate"])
        if row["score"]:
            check(row["score"], "Score")
