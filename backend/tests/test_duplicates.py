"""Duplicate detection and merge: the same person applying twice must be found and folded
into one record without orphaning assessments, notes, questions, interviews or decisions."""
import os
import sys
import uuid

import fitz
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models as m  # noqa: E402
from db import SessionLocal  # noqa: E402
from main import app  # noqa: E402
from services import llm  # noqa: E402

CV = """Karim Bakhtiar
karim.bakhtiar@example.com | +92 321 5556677

EXPERIENCE
Backend engineer at Nordvale, 2020-2025.
Built Django REST services in Python, deployed with Docker on GitHub Actions.
"""


def _pdf(text):
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
    llm.chat_json = lambda *a, **k: (_ for _ in ()).throw(llm.AIUnavailable("stubbed"))
    client = TestClient(app)
    tag = uuid.uuid4().hex[:8]

    def user(email, role, name):
        r = client.post("/api/auth/register", json={
            "email": email, "password": "Password123", "full_name": name, "role": role})
        assert r.status_code == 201, r.text
        return r.json()

    rec = user(f"dup.rec.{tag}@test.dev", "recruiter", "Dup Recruiter")
    rh = _auth(rec["token"])
    job = client.post("/api/jobs", headers=rh, json={
        "title": f"Dup Job {tag}", "description": "Python and Docker",
        "requirements": [{"label": "Python", "importance": "required"}]}).json()

    def candidate(suffix, email, name):
        c = user(email, "candidate", name)
        h = _auth(c["token"])
        up = client.post("/api/resumes", headers=h,
                         files={"file": ("cv.pdf", _pdf(CV), "application/pdf")})
        assert up.status_code == 201, up.text
        app_row = client.post("/api/applications", headers=h,
                              json={"job_id": job["id"], "resume_id": up.json()["resume"]["id"]})
        assert app_row.status_code == 201, app_row.text
        return c, h, up.json()["resume"]["id"], app_row.json()["id"]

    first, h1, _r1, app1 = candidate("one", f"dup.one.{tag}@test.dev", "Karim Bakhtiar")
    second, h2, _r2, app2 = candidate("two", f"dup.two.{tag}@test.dev", "Kareem Bakhtiar")
    # exercise the children that must not be orphaned when the second record is folded away
    client.post(f"/api/applications/{app2}/notes", headers=rh, json={"body": "second record note"})
    client.patch(f"/api/applications/{app2}/stage", headers=rh,
                 json={"to_stage": "shortlisted", "reason": "dup"})
    return {"client": client, "rh": rh, "job": job["id"], "first": first, "second": second,
            "app1": app1, "app2": app2}


def test_identical_resume_across_two_accounts_is_detected(world):
    c, rh = world["client"], world["rh"]
    pairs = c.get("/api/talent/duplicates", headers=rh).json()
    match = [p for p in pairs
             if {p["keep"]["id"], p["duplicate"]["id"]} == {world["first"]["user"]["id"],
                                                            world["second"]["user"]["id"]}]
    assert match, f"identical CVs under two accounts were not detected: {pairs}"
    assert match[0]["similarity"] >= 0.95
    assert "résumé" in match[0]["reason"] or "contact" in match[0]["reason"]


def test_merge_moves_applications_and_leaves_no_orphans(world):
    c, rh = world["client"], world["rh"]
    keep_id = world["first"]["user"]["id"]
    dupe_id = world["second"]["user"]["id"]
    r = c.post("/api/talent/merge", headers=rh, json={"keep_id": keep_id, "merge_id": dupe_id})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and body["kept"] == keep_id and body["merged"] == dupe_id
    # both applied to the same job, so the clash is dropped rather than double counted
    assert body["applications_moved"] == 0

    db = SessionLocal()
    app_ids = {a for (a,) in db.execute(select(m.Application.id)).all()}
    orphans = {}
    for label, model in [("assessments", m.Assessment), ("notes", m.Note),
                         ("questions", m.InterviewQuestion), ("interviews", m.Interview),
                         ("events", m.StatusEvent), ("decisions", m.FinalDecision)]:
        rows = db.execute(select(model.id, model.application_id)).all()
        orphans[label] = sum(1 for _id, aid in rows if aid not in app_ids)
    db.close()
    assert all(v == 0 for v in orphans.values()), orphans
    assert c.get(f"/api/applications/{world['app2']}", headers=rh).status_code == 404
    assert c.get(f"/api/applications/{world['app1']}", headers=rh).status_code == 200
