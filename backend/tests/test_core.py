"""Deterministic core tests. The LLM is stubbed out so runs are fast and offline-safe."""
import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models as m  # noqa: E402
from db import Base, SessionLocal, engine  # noqa: E402
from main import app  # noqa: E402
from services import extract, fairness, llm, matching, pdf, skills  # noqa: E402

SAMPLE = """Ayesha Khan
ayesha.khan@example.com | +92 300 1234567

EDUCATION
BS Computer Science, UET Lahore, 2019

EXPERIENCE
Backend Engineer, Nordvale Systems, 2021 - 2025
Built and maintained Django REST services in Python for 4 years.
Designed PostgreSQL schemas and optimised slow queries.
Containerised all services with Docker and GitHub Actions pipelines.

SKILLS
Python, Django, PostgreSQL, Docker, REST APIs
"""


@pytest.fixture(scope="session", autouse=True)
def _db():
    assert "rc3_test" in str(engine.url), f"refusing to drop tables in {engine.url}"
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(monkeypatch):
    def _no_llm(*a, **k):
        raise llm.AIUnavailable("stubbed in tests")
    monkeypatch.setattr(llm, "chat_json", _no_llm)
    monkeypatch.setattr("services.matching.llm.chat_json", _no_llm)
    monkeypatch.setattr("services.extract.llm.chat_json", _no_llm)
    return TestClient(app)


def make_user(client, email, role, name="Test User"):
    r = client.post("/api/auth/register", json={
        "email": email, "password": "Password123", "full_name": name, "role": role})
    assert r.status_code == 201, r.text
    return r.json()


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["embedding_mode"] in ("dense", "lexical")


def test_auth_role_and_ownership(client):
    rec = make_user(client, "r1@test.dev", "recruiter", "Rec One")
    cand = make_user(client, "c1@test.dev", "candidate", "Cand One")
    assert client.post("/api/auth/login", json={
        "email": "r1@test.dev", "password": "wrongpass"}).status_code == 401
    assert client.get("/api/jobs").status_code == 401
    # candidate cannot list recruiters' analytics
    assert client.get("/api/analytics/overview", headers=auth(cand["token"])).status_code == 403
    # no password ever returned
    assert "password" not in rec["user"]


def test_job_crud_close_reopen(client):
    rec = make_user(client, "r2@test.dev", "recruiter", "Rec Two")
    h = auth(rec["token"])
    body = {"title": "Backend Developer", "department": "Eng", "location": "Lahore",
            "employment_type": "full_time", "salary_min": 100, "salary_max": 200,
            "description": "Python and Django", "requirements": [
                {"label": "Python", "importance": "required", "min_years": 3},
                {"label": "Django", "importance": "required"},
                {"label": "REST API", "importance": "preferred"}]}
    job = client.post("/api/jobs", headers=h, json=body)
    assert job.status_code == 201, job.text
    jid = job.json()["id"]
    assert len(job.json()["requirements"]) == 3
    assert client.post(f"/api/jobs/{jid}/close", headers=h).json()["status"] == "closed"
    assert client.post(f"/api/jobs/{jid}/reopen", headers=h).json()["status"] == "open"
    # salary validation
    bad = dict(body, salary_min=500, salary_max=100)
    assert client.post("/api/jobs", headers=h, json=bad).status_code == 422


def test_upload_rejects_non_pdf(client):
    cand = make_user(client, "c2@test.dev", "candidate", "Cand Two")
    r = client.post("/api/resumes", headers=auth(cand["token"]),
                    files={"file": ("resume.txt", b"hello", "text/plain")})
    assert r.status_code == 415
