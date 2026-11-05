"""Tenant isolation: one recruiter/candidate must never reach another's records.

Table-driven so adding an endpoint is one line, and every expectation is a status code that
would only be wrong if a guard were missing.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import fitz
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402
from services import llm  # noqa: E402

SAMPLE = """Isolation Tester
isolation@example.com

EXPERIENCE
Built Django REST services in Python for four years.
Ran everything in Docker on GitHub Actions.
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


@pytest.fixture(scope="module")
def world():
    """Two recruiters, two candidates, each recruiter owning one job with one applicant."""
    llm.chat_json = lambda *a, **k: (_ for _ in ()).throw(llm.AIUnavailable("stubbed"))
    client = TestClient(app)
    tag = uuid.uuid4().hex[:8]

    def user(email, role, name):
        r = client.post("/api/auth/register", json={
            "email": email, "password": "Password123", "full_name": name, "role": role})
        assert r.status_code == 201, r.text
        return r.json()

    out = {}
    for side in ("a", "b"):
        rec = user(f"iso.rec.{side}.{tag}@test.dev", "recruiter", f"Recruiter {side.upper()}")
        cand = user(f"iso.cand.{side}.{tag}@test.dev", "candidate", f"Candidate {side.upper()}")
        rh, ch = _auth(rec["token"]), _auth(cand["token"])
        job = client.post("/api/jobs", headers=rh, json={
            "title": f"Isolation {side.upper()} {tag}", "description": "Python and Docker",
            "requirements": [{"label": "Python", "importance": "required"},
                             {"label": "Docker", "importance": "required"}]})
        assert job.status_code == 201, job.text
        jid = job.json()["id"]
        up = client.post("/api/resumes", headers=ch,
                         files={"file": (f"iso-{side}.pdf", _pdf_bytes(SAMPLE), "application/pdf")})
        assert up.status_code == 201, up.text
        rid = up.json()["resume"]["id"]
        app_row = client.post("/api/applications", headers=ch, json={"job_id": jid, "resume_id": rid})
        assert app_row.status_code == 201, app_row.text
        iv = client.post("/api/interviews", headers=rh, json={
            "application_id": app_row.json()["id"], "interviewer_id": rec["user"]["id"],
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%S"),
            "duration_min": 45, "interview_type": "technical", "location": "Meet"})
        assert iv.status_code == 201, iv.text
        out[side] = {"rec": rec, "cand": cand, "rh": rh, "ch": ch, "job": jid,
                     "resume": rid, "app": app_row.json()["id"], "interview": iv.json()["id"]}
    out["client"] = client
    return out


def test_recruiter_cannot_touch_another_recruiters_pipeline(world):
    c, b, a = world["client"], world["b"], world["a"]
    cases = [
        ("read another's applicants", "GET", f"/api/jobs/{a['job']}/applicants", None, 403),
        ("read another's talent pool", "GET", f"/api/jobs/{a['job']}/talent-pool", None, 403),
        ("edit another's job", "PATCH", f"/api/jobs/{a['job']}", {"title": "hijacked"}, 403),
        ("close another's job", "POST", f"/api/jobs/{a['job']}/close", None, 403),
        ("read another's application", "GET", f"/api/applications/{a['app']}", None, 403),
        ("re-assess another's candidate", "POST", f"/api/applications/{a['app']}/assess", None, 403),
        ("override another's score", "POST", f"/api/applications/{a['app']}/override",
         {"score": 99, "reason": "nope"}, 403),
        ("write a note on another's application", "POST", f"/api/applications/{a['app']}/notes",
         {"body": "nope"}, 403),
        ("read another's questions", "GET", f"/api/applications/{a['app']}/questions", None, 403),
        ("generate questions for another's candidate", "POST",
         f"/api/applications/{a['app']}/questions/generate", {"per_difficulty": 1}, 403),
        ("book an interview for another's candidate", "POST", "/api/interviews",
         {"application_id": a["app"], "interviewer_id": b["rec"]["user"]["id"],
          "scheduled_at": "2030-01-01T10:00:00", "duration_min": 30,
          "interview_type": "technical"}, 403),
        ("read another's interview feedback", "GET", f"/api/interviews/{a['interview']}/feedback",
         None, 403),
        ("record another's final decision", "POST", f"/api/interviews/{a['interview']}/decision",
         {"decision": "selected", "rationale": "nope"}, 403),
        ("compare another's applications", "GET", f"/api/talent/compare?ids={a['app']}", None, 200),
    ]
    for label, method, path, body, expected in cases:
        resp = c.request(method, path, headers=b["rh"], json=body)
        assert resp.status_code == expected, f"{label}: {resp.status_code} {resp.text[:160]}"
    # compare returns an empty row set rather than another recruiter's data
    rows = c.get(f"/api/talent/compare?ids={a['app']}", headers=b["rh"]).json()["rows"]
    assert rows == [], rows


def test_candidate_cannot_touch_another_candidate(world):
    c, b, a = world["client"], world["b"], world["a"]
    cases = [
        ("read another's application", "GET", f"/api/applications/{a['app']}", None, 403),
        ("re-assess another's application", "POST", f"/api/applications/{a['app']}/assess", None, 403),
        ("read another's resume", "GET", f"/api/resumes/{a['resume']}", None, 403),
        ("download another's resume file", "GET", f"/api/resumes/{a['resume']}/file", None, 403),
        ("edit another's skills", "PATCH", f"/api/resumes/{a['resume']}/skills",
         {"skills": ["Fake"]}, 403),
    ]
    for label, method, path, body, expected in cases:
        resp = c.request(method, path, headers=b["ch"], json=body)
        assert resp.status_code == expected, f"{label}: {resp.status_code} {resp.text[:160]}"


def test_candidate_cannot_use_recruiter_surfaces(world):
    c, b = world["client"], world["b"]
    cases = [
        ("analytics", "GET", "/api/analytics/overview", None),
        ("interview list", "GET", "/api/interviews", None),
        ("talent search", "GET", "/api/talent/search?q=python", None),
        ("duplicates", "GET", "/api/talent/duplicates", None),
        ("fairness audit", "GET", "/api/audit/fairness", None),
        ("merge candidates", "POST", "/api/talent/merge", {"keep_id": 1, "merge_id": 2}),
        ("create job", "POST", "/api/jobs", {"title": "x", "description": "y"}),
    ]
    for label, method, path, body in cases:
        resp = c.request(method, path, headers=b["ch"], json=body)
        assert resp.status_code == 403, f"{label}: {resp.status_code} {resp.text[:120]}"


def test_anonymous_cannot_read_anything(world):
    c = world["client"]
    a = world["a"]
    for path in ["/api/jobs", f"/api/jobs/{a['job']}/applicants",
                 f"/api/applications/{a['app']}", f"/api/resumes/{a['resume']}",
                 f"/api/resumes/{a['resume']}/file", "/api/interviews",
                 "/api/analytics/overview", "/api/auth/me", "/api/talent/search?q=x"]:
        assert c.get(path).status_code == 401, path


def test_any_recruiter_may_read_a_talent_pool_resume(world):
    """Documented choice: recruiters browse one shared talent pool, so résumé text and the
    original file are readable across recruiters - only applications and jobs are scoped."""
    c, b, a = world["client"], world["b"], world["a"]
    assert c.get(f"/api/resumes/{a['resume']}", headers=b["rh"]).status_code == 200
    assert c.get(f"/api/resumes/{a['resume']}/file", headers=b["rh"]).status_code == 200
