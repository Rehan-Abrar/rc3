"""Regression tests for the failure modes found while stress-testing the API.

Each test pins a behaviour that, if it regresses, would either score a candidate wrongly or
leak internal recruiter reasoning. The LLM is stubbed, so these run offline and fast.
"""
import os
import sys
import uuid
from datetime import timedelta

import fitz
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models as m  # noqa: E402
from db import SessionLocal  # noqa: E402
from main import app  # noqa: E402
from models import utcnow  # noqa: E402
from services import llm, matching  # noqa: E402

SAMPLE = """Ayesha Khan
ayesha.khan@example.com

EXPERIENCE
Built and maintained Django REST services in Python for four years.
Containerised all services with Docker and GitHub Actions.

EDUCATION
BS Computer Science, UET Lahore.
"""


def _pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(56, 56, 540, 780), text, fontsize=11, fontname="helv")
    data = doc.tobytes()
    doc.close()
    return data


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def _requirements(app_id):
    db = SessionLocal()
    job_id = db.get(m.Application, app_id).job_id
    rows = db.query(m.JobRequirement).filter_by(job_id=job_id).all()
    out = [{"id": r.id, "label": r.label, "kind": r.kind, "importance": r.importance,
            "weight": r.weight} for r in rows]
    db.close()
    return out


def _verdicts(reqs, status):
    return ({r["id"]: {"status": status, "reason": "stub verdict", "quote": None,
                       "start": None, "end": None, "support": "flagged_unverified"}
             for r in reqs}, "stub summary")


@pytest.fixture()
def stack(monkeypatch):
    """A recruiter, a candidate with a parsed resume, and an application awaiting assessment."""
    def _no_llm(*a, **k):
        raise llm.AIUnavailable("stubbed in tests")

    monkeypatch.setattr(llm, "chat_json", _no_llm)
    monkeypatch.setattr("services.matching.llm.chat_json", _no_llm)
    monkeypatch.setattr("services.extract.llm.chat_json", _no_llm)
    client = TestClient(app)

    def user(email, role, name):
        r = client.post("/api/auth/register", json={
            "email": email, "password": "Password123", "full_name": name, "role": role})
        assert r.status_code == 201, r.text
        return r.json()

    tag = uuid.uuid4().hex[:8]  # the test DB is shared across tests, so emails must be unique
    rec = user(f"guard.rec.{tag}@test.dev", "recruiter", "Guard Recruiter")
    cand = user(f"guard.cand.{tag}@test.dev", "candidate", "Guard Candidate")
    rh, ch = _auth(rec["token"]), _auth(cand["token"])
    job = client.post("/api/jobs", headers=rh, json={
        "title": f"Guard Engineer {tag}", "description": "Python and Docker",
        "requirements": [{"label": "Python", "importance": "required"},
                         {"label": "Docker", "importance": "required"}]})
    assert job.status_code == 201, job.text
    jid = job.json()["id"]
    up = client.post("/api/resumes", headers=ch,
                     files={"file": ("guard.pdf", _pdf_bytes(SAMPLE), "application/pdf")})
    assert up.status_code == 201, up.text
    rid = up.json()["resume"]["id"]
    app_row = client.post("/api/applications", headers=ch, json={"job_id": jid, "resume_id": rid})
    assert app_row.status_code == 201, app_row.text
    return {"client": client, "rh": rh, "ch": ch, "job": jid,
            "app": app_row.json()["id"], "resume": rid}


def test_all_empty_adjudication_is_degraded_not_zero(stack, monkeypatch):
    """A model that answers 'nothing evidenced' for every requirement must not produce a
    confident 0: the assessment degrades and says why."""
    reqs = _requirements(stack["app"])
    monkeypatch.setattr(matching, "adjudicate",
                        lambda *_a, **_k: _verdicts(reqs, "not_evidenced"))
    r = stack["client"].post(f"/api/applications/{stack['app']}/assess?force=true",
                             headers=stack["rh"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ai_mode"] == "degraded", body
    assert "no evidence" in (body.get("summary") or "").lower()
    # No requirement may be claimed as matched on a degraded run.
    assert not [s for s in body["skills_detail"] if s["status"] == "matched"]


def test_candidate_never_sees_recruiter_override(stack):
    h = stack["rh"]
    assert stack["client"].post(f"/api/applications/{stack['app']}/override", headers=h,
                                json={"score": 91, "reason": "internal gut call"}).status_code == 200
    mine = stack["client"].get(f"/api/applications/{stack['app']}", headers=stack["ch"])
    assert mine.status_code == 200, mine.text
    assert mine.json()["override_score"] is None
    assert mine.json()["override_reason"] is None
    # ...while the owning recruiter still sees it
    theirs = stack["client"].get(f"/api/applications/{stack['app']}", headers=h)
    assert theirs.json()["override_score"] == 91


def test_degraded_assessment_retries_itself(stack, monkeypatch):
    """A degraded row left over from an AI outage is recomputed on the next read."""
    h = stack["rh"]
    first = stack["client"].post(f"/api/applications/{stack['app']}/assess", headers=h)
    assert first.json()["ai_mode"] != "groq"

    db = SessionLocal()
    row = db.query(m.Assessment).filter_by(application_id=stack["app"]).one()
    row.created_at = utcnow() - timedelta(minutes=5)
    db.commit()
    db.close()

    reqs = _requirements(stack["app"])
    monkeypatch.setattr(matching, "adjudicate",
                        lambda *_a, **_k: _verdicts(reqs, "matched"))
    again = stack["client"].post(f"/api/applications/{stack['app']}/assess", headers=h)
    assert again.json()["ai_mode"] == "groq", again.json()
    assert again.json()["skills"] == 100.0


def test_regenerate_keeps_the_old_question_when_ai_is_down(stack, monkeypatch):
    h = stack["rh"]
    real = lambda reqs, *_a, **_k: ({"questions": [  # noqa: E731
        {"text": "Explain Python GIL", "difficulty": "intermediate", "category": "skill",
         "guideline": "needs to mention CPython"}]}, "")
    import routers.questions as qrouter
    monkeypatch.setattr(qrouter.llm, "chat_json",
                        lambda *_a, **_k: {"questions": [
                            {"text": "Explain Python GIL", "difficulty": "intermediate",
                             "category": "skill", "guideline": "mentions CPython"}]})
    created = stack["client"].post(f"/api/applications/{stack['app']}/questions/generate",
                                   headers=h, json={"per_difficulty": 1})
    assert created.status_code == 201, created.text
    qid = created.json()[0]["id"]

    monkeypatch.setattr(qrouter.llm, "chat_json",
                        lambda *_a, **_k: (_ for _ in ()).throw(llm.AIUnavailable("outage")))
    failed = stack["client"].post(
        f"/api/applications/{stack['app']}/questions/regenerate/{qid}", headers=h)
    assert failed.status_code == 503
    still_there = stack["client"].get(f"/api/applications/{stack['app']}/questions", headers=h)
    assert [q["id"] for q in still_there.json()] == [qid], "the question was destroyed by a 503"


def test_genuinely_unrelated_resume_keeps_groq_mode():
    """A CV that really has none of the required skills is a legitimate 'no evidence' answer.

    The degradation guard must not fire there - otherwise honest zeros would look like outages.
    """
    tag = uuid.uuid4().hex[:8]
    client = TestClient(app)
    rec = client.post("/api/auth/register", json={
        "email": f"unrelated.rec.{tag}@test.dev", "password": "Password123",
        "full_name": "Unrelated Rec", "role": "recruiter"}).json()
    cand = client.post("/api/auth/register", json={
        "email": f"unrelated.cand.{tag}@test.dev", "password": "Password123",
        "full_name": "Unrelated Cand", "role": "candidate"}).json()
    rh, ch = _auth(rec["token"]), _auth(cand["token"])
    job = client.post("/api/jobs", headers=rh, json={
        "title": f"Kubernetes Platform Engineer {tag}",
        "description": "Own our Kubernetes clusters.",
        "requirements": [{"label": "Kubernetes", "importance": "required"},
                         {"label": "Terraform", "importance": "required"}]}).json()
    up = client.post("/api/resumes", headers=ch,
                     files={"file": ("adjacent.pdf", _pdf_bytes(SAMPLE), "application/pdf")})
    rid = up.json()["resume"]["id"]
    app_id = client.post("/api/applications", headers=ch,
                         json={"job_id": job["id"], "resume_id": rid}).json()["id"]

    reqs = _requirements(app_id)
    import services.matching as matching_mod
    original = matching_mod.adjudicate
    matching_mod.adjudicate = lambda *_a, **_k: _verdicts(reqs, "not_evidenced")
    try:
        body = client.post(f"/api/applications/{app_id}/assess?force=true", headers=rh).json()
    finally:
        matching_mod.adjudicate = original
    assert body["ai_mode"] == "groq", body
    assert body["skills"] == 0.0
    assert body["insufficient_evidence"] is True


def test_candidate_sees_own_interview_but_not_recruiter_prep():
    """The candidate portal needs the booked slot; it must never show notes or prep questions."""
    tag = uuid.uuid4().hex[:8]
    client = TestClient(app)
    rec = client.post("/api/auth/register", json={
        "email": f"slot.rec.{tag}@test.dev", "password": "Password123",
        "full_name": "Slot Rec", "role": "recruiter"}).json()
    cand = client.post("/api/auth/register", json={
        "email": f"slot.cand.{tag}@test.dev", "password": "Password123",
        "full_name": "Slot Cand", "role": "candidate"}).json()
    rh, ch = _auth(rec["token"]), _auth(cand["token"])
    job = client.post("/api/jobs", headers=rh, json={
        "title": f"Slot Job {tag}", "description": "Python",
        "requirements": [{"label": "Python", "importance": "required"}]}).json()
    up = client.post("/api/resumes", headers=ch,
                     files={"file": ("slot.pdf", _pdf_bytes(SAMPLE), "application/pdf")}).json()
    app_id = client.post("/api/applications", headers=ch,
                         json={"job_id": job["id"], "resume_id": up["resume"]["id"]}).json()["id"]
    client.post(f"/api/applications/{app_id}/stage", headers=rh,
                json={"to_stage": "shortlisted", "reason": "test"})
    booked = client.post("/api/interviews", headers=rh, json={
        "application_id": app_id, "interviewer_id": rec["user"]["id"],
        "scheduled_at": "2030-05-01T09:00:00", "duration_min": 45,
        "interview_type": "technical", "location": "Google Meet"})
    assert booked.status_code == 201, booked.text
    client.post(f"/api/applications/{app_id}/notes", headers=rh, json={"body": "internal note"})

    mine = client.get(f"/api/applications/{app_id}", headers=ch).json()
    assert [i["location"] for i in mine["interviews"]] == ["Google Meet"]
    assert mine["notes"] == []
    assert mine["questions"] == []
