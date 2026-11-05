"""Recruiter-configurable weights and the What-If simulator.

These tests exist because a configurable score can go wrong in ways that are invisible in the
UI: weights that do not sum, a cached total that survives a config change, a simulation that
silently writes, or unmeasured dimensions weighted as zeros. Every check below is about the
number a recruiter will read out loud in a demo.
"""
import json
import os
import sys
import uuid

import fitz
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402
from services import llm, scoring  # noqa: E402

SAMPLE = """Config Tester
config.tester@example.com | Lahore

EXPERIENCE
Backend engineer for four years building Django REST services in Python.
Ran everything in Docker on GitHub Actions with PostgreSQL.

PROJECTS
Billing API: a REST service in Python that reconciles invoices with Docker cron jobs.
"""

DEFAULT = {"skills": 50, "experience": 25, "projects": 15, "qualifications": 10}
SENIOR = {"skills": 30, "experience": 45, "projects": 15, "qualifications": 10}
SKILLS_FIRST = {"skills": 65, "experience": 15, "projects": 15, "qualifications": 5}


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def _pdf(text: str = SAMPLE) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(56, 56, 540, 780), text, fontsize=11, fontname="helv")
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture(scope="module")
def world():
    """Two recruiters (one with a job and a scored applicant), plus one candidate."""
    llm.chat_json = lambda *a, **k: (_ for _ in ()).throw(llm.AIUnavailable("stubbed"))
    client = TestClient(app)
    tag = uuid.uuid4().hex[:8]

    def user(email, role, name):
        r = client.post("/api/auth/register", json={
            "email": email, "password": "Password123", "full_name": name, "role": role})
        assert r.status_code == 201, r.text
        return r.json()

    rec = user(f"cfg.rec.{tag}@test.dev", "recruiter", "Config Recruiter")
    other = user(f"cfg.other.{tag}@test.dev", "recruiter", "Other Recruiter")
    cand = user(f"cfg.cand.{tag}@test.dev", "candidate", "Config Candidate")
    rh = _auth(rec["token"])
    job = client.post("/api/jobs", headers=rh, json={
        "title": f"Config Job {tag}", "description": "Python, Docker, PostgreSQL and REST APIs.",
        "requirements": [{"label": "Python", "importance": "required"},
                         {"label": "Docker", "importance": "required"}]})
    assert job.status_code == 201, job.text
    jid = job.json()["id"]
    up = client.post("/api/resumes", headers=_auth(cand["token"]),
                     files={"file": (f"cfg-{tag}.pdf", _pdf(), "application/pdf")})
    assert up.status_code == 201, up.text
    app_row = client.post("/api/applications", headers=_auth(cand["token"]),
                          json={"job_id": jid, "resume_id": up.json()["resume"]["id"]})
    assert app_row.status_code == 201, app_row.text
    aid = app_row.json()["id"]
    scored = client.post(f"/api/applications/{aid}/assess", headers=rh)
    assert scored.status_code == 200, scored.text
    return {"client": client, "rec": rec, "other": other, "cand": cand,
            "rh": rh, "job": jid, "app": aid, "tag": tag}


# --------------------------------------------------------------------------- contract maths
def test_validate_accepts_the_documented_presets():
    for preset in (DEFAULT, SENIOR, SKILLS_FIRST,
                   {"skills": 35, "experience": 10, "projects": 45, "qualifications": 10}):
        assert scoring.validate(preset) == {k: float(v) for k, v in preset.items()}


@pytest.mark.parametrize("bad,reason", [
    ({"skills": 50, "experience": 25, "projects": 15, "qualifications": 5}, "sum to 100"),
    ({"skills": 60, "experience": 25, "projects": 15, "qualifications": 10}, "sum to 100"),
    ({"skills": -1, "experience": 46, "projects": 30, "qualifications": 25}, "between 0 and 100"),
    ({"skills": 120, "experience": 0, "projects": 0, "qualifications": -20}, "between 0 and 100"),
    ({"skills": 50, "experience": 25, "projects": 15}, "Missing weight"),
    ({"skills": 50, "experience": 25, "projects": 15, "qualifications": 10, "age": 0}, "Unknown dimension"),
    ({"skills": 33.333, "experience": 33.333, "projects": 33.334, "qualifications": 0}, "two decimals"),
])
def test_validate_rejects_bad_configurations_with_a_clear_reason(bad, reason):
    with pytest.raises(scoring.WeightsError) as err:
        scoring.validate(bad)
    assert reason in str(err.value)


def test_validate_accepts_decimals_that_add_to_exactly_100():
    assert scoring.validate({"skills": 33.33, "experience": 33.33,
                             "projects": 33.34, "qualifications": 0})["projects"] == 33.34


def test_effective_weights_sum_to_one_and_reproduce_the_overall():
    dims = {"skills": 88.0, "experience": 61.5, "projects": 74.0, "qualifications": 40.0}
    for weights in (DEFAULT, SENIOR, SKILLS_FIRST):
        out = scoring.combine_dimensions(dims, weights)
        assert abs(sum(out["effective_weights"].values()) - 1.0) < 1e-6
        rebuilt = sum(out["effective_weights"][d] * dims[d] for d in scoring.DIMENSIONS)
        assert abs(rebuilt - out["overall"]) < 0.01


def test_custom_weights_change_the_total_in_the_expected_direction():
    dims = {"skills": 40.0, "experience": 95.0, "projects": 50.0, "qualifications": 50.0}
    default = scoring.combine_dimensions(dims, DEFAULT)["overall"]
    senior = scoring.combine_dimensions(dims, SENIOR)["overall"]
    assert senior > default, "weighting experience more must raise an experienced candidate"


def test_unmeasured_dimension_is_excluded_and_its_weight_redistributed():
    dims = {"skills": 80.0, "experience": None, "projects": 60.0, "qualifications": 100.0}
    out = scoring.combine_dimensions(dims, SENIOR)
    assert out["not_measured"] == ["experience"]
    assert out["effective_weights"]["experience"] == 0.0
    total = out["effective_weights"]["skills"] + out["effective_weights"]["projects"] + \
        out["effective_weights"]["qualifications"]
    assert abs(total - 1.0) < 1e-6
    assert abs(out["effective_weights"]["skills"] - 30 / 55) < 0.001
    rebuilt = sum(out["effective_weights"][d] * dims[d] for d in ("skills", "projects", "qualifications"))
    assert abs(rebuilt - out["overall"]) < 0.01


def test_measured_zero_stays_zero():
    dims = {"skills": 0.0, "experience": 0.0, "projects": 0.0, "qualifications": 0.0}
    out = scoring.combine_dimensions(dims, DEFAULT)
    assert out["overall"] == 0.0
    assert out["not_measured"] == []
    assert sum(out["effective_weights"].values()) == pytest.approx(1.0)


def test_all_weight_on_an_unmeasured_dimension_is_reported_not_invented():
    out = scoring.combine_dimensions({"skills": 90.0, "experience": None, "projects": None,
                                      "qualifications": None},
                                     {"skills": 0, "experience": 100, "projects": 0, "qualifications": 0})
    assert out["exhausted"] is True
    assert out["overall"] == 0.0
    assert "nothing to weigh" in out["note"]


def test_contributions_sum_to_the_change_in_overall():
    dims = {"skills": 70.0, "experience": 30.0, "projects": 90.0, "qualifications": 10.0}
    before = scoring.combine_dimensions(dims, DEFAULT)
    after = scoring.combine_dimensions(dims, SENIOR)
    parts = scoring.contributions(dims, before, after)
    assert sum(parts.values()) == pytest.approx(after["overall"] - before["overall"], abs=0.02)
    assert parts["experience"] > 0 and parts["skills"] < 0


# --------------------------------------------------------------------------- API: configuration
def test_new_jobs_default_to_the_documented_weights(world):
    body = world["client"].get(f"/api/jobs/{world['job']}", headers=world["rh"]).json()
    assert body["weights"] == {k: float(v) for k, v in DEFAULT.items()}
    assert body["weights_version"] == 1 and body["default_weights"]["skills"] == 50


def test_get_weights_requires_ownership(world):
    c = world["client"]
    assert c.get(f"/api/jobs/{world['job']}/weights", headers=_auth(world["other"]["token"])).status_code == 403
    assert c.get(f"/api/jobs/{world['job']}/weights", headers=_auth(world["cand"]["token"])).status_code == 403


def test_put_weights_persists_bumps_version_and_audits(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    before = c.get(f"/api/jobs/{jid}/weights", headers=rh).json()
    r = c.put(f"/api/jobs/{jid}/weights", headers=rh,
              json={**SENIOR, "reason": "Senior role: experience first"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["configured"] == {k: float(v) for k, v in SENIOR.items()}
    assert body["version"] == before["version"] + 1
    assert body["history"][0]["reason"] == "Senior role: experience first"
    assert body["history"][0]["previous"] == before["configured"]
    assert c.get(f"/api/jobs/{jid}", headers=rh).json()["weights"]["experience"] == 45.0


def test_put_weights_rejects_bad_totals_with_422(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    for bad in ({**DEFAULT, "skills": 51}, {**DEFAULT, "experience": -5}, {"skills": 100}):
        r = c.put(f"/api/jobs/{jid}/weights", headers=rh, json=bad)
        assert r.status_code == 422, (bad, r.status_code, r.text)


def test_put_weights_requires_ownership(world):
    c = world["client"]
    r = c.put(f"/api/jobs/{world['job']}/weights", headers=_auth(world["other"]["token"]), json=SENIOR)
    assert r.status_code == 403


def test_weights_survive_an_unrelated_job_edit_and_close(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=SKILLS_FIRST)
    c.patch(f"/api/jobs/{jid}", headers=rh, json={"location": "Karachi"})
    assert c.get(f"/api/jobs/{jid}/weights", headers=rh).json()["configured"]["skills"] == 65.0
    c.post(f"/api/jobs/{jid}/close", headers=rh)
    assert c.get(f"/api/jobs/{jid}/weights", headers=rh).json()["configured"]["projects"] == 15.0
    c.post(f"/api/jobs/{jid}/reopen", headers=rh)
    assert c.get(f"/api/jobs/{jid}", headers=rh).json()["weights"]["qualifications"] == 5.0


def test_job_creation_accepts_weights_and_validates_them(world):
    c, rh = world["client"], world["rh"]
    ok = c.post("/api/jobs", headers=rh, json={"title": f"Preset job {uuid.uuid4().hex[:6]}",
                                                "description": "Python", "weights": SENIOR})
    assert ok.status_code == 201, ok.text
    assert ok.json()["weights"] == {k: float(v) for k, v in SENIOR.items()}
    bad = c.post("/api/jobs", headers=rh, json={"title": "Bad weights job", "description": "Python",
                                                "weights": {**DEFAULT, "skills": 90}})
    assert bad.status_code == 422


# --------------------------------------------------------------------------- API: scoring
def test_saved_weights_change_stored_scores_and_reproduce_from_the_breakdown(world):
    c, rh, jid, aid = world["client"], world["rh"], world["job"], world["app"]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=DEFAULT)
    base = c.get(f"/api/applications/{aid}", headers=rh).json()["assessment"]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=SENIOR)
    after = c.get(f"/api/applications/{aid}", headers=rh).json()["assessment"]
    assert after["weights_version"] == base["weights_version"] + 1
    assert after["configured_weights"].get("experience") == 45.0
    rebuilt = sum(after["effective_weights"][d] * after[d] for d in scoring.DIMENSIONS
                  if d not in after["not_measured"])
    assert abs(rebuilt - after["overall"]) < 0.05
    # dimension scores and evidence are untouched by a weights change
    assert [r["status"] for r in after["skills_detail"]] == [r["status"] for r in base["skills_detail"]]
    assert [r["support"] for r in after["skills_detail"]] == [r["support"] for r in base["skills_detail"]]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=DEFAULT)
    restored = c.get(f"/api/applications/{aid}", headers=rh).json()["assessment"]
    assert restored["overall"] == pytest.approx(base["overall"], abs=0.01)


def test_no_stale_score_is_served_after_a_configuration_change(world):
    """Simulates an out-of-date cache: bump the job version behind the assessment's back."""
    c, rh, jid, aid = world["client"], world["rh"], world["job"], world["app"]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=DEFAULT)
    version = c.get(f"/api/jobs/{jid}/weights", headers=rh).json()["version"]
    # bump the job's version without recalculating anything, as an old cache would leave it
    import models as m
    from db import SessionLocal
    db = SessionLocal()
    job = db.get(m.Job, jid)
    job.scoring_version = version + 1
    db.commit()
    db.close()
    served = c.get(f"/api/applications/{aid}/assessment", headers=rh).json()
    assert served["weights_version"] == version + 1, "a stale cached score was served"


# --------------------------------------------------------------------------- API: simulator
def _db_snapshot(job_id: int) -> dict:
    import models as m
    from db import SessionLocal
    from sqlalchemy import select
    db = SessionLocal()
    try:
        apps = db.scalars(select(m.Application).where(m.Application.job_id == job_id)).all()
        assessments = {a.application_id: (a.overall, a.weights_version, a.payload_json)
                       for a in db.scalars(select(m.Assessment)).all()}
        job = db.get(m.Job, job_id)
        return {"apps": [(a.id, a.stage, a.override_score) for a in apps],
                "assessments": assessments,
                "job": (job.weight_skills, job.weight_experience, job.weight_projects,
                        job.weight_qualifications, job.scoring_version),
                "notes": db.scalar(select(m.Note.id).count()) if False else None}
    finally:
        db.close()


def test_what_if_returns_ranks_and_contributions_without_writing(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    before = _db_snapshot(jid)
    r = c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SENIOR)
    assert r.status_code == 200, r.text
    sim = r.json()
    assert sim["rows"] and sim["note"].lower().startswith("simulation only")
    for row in sim["rows"]:
        assert row["current_rank"] >= 1 and row["simulated_rank"] >= 1
        assert row["movement"] == row["current_rank"] - row["simulated_rank"]
        assert set(row["contributions"]) == set(scoring.DIMENSIONS)
    assert _db_snapshot(jid) == before, "the simulator mutated the database"


def test_what_if_is_deterministic(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    first = c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SKILLS_FIRST).json()
    second = c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SKILLS_FIRST).json()
    assert [(r["application_id"], r["simulated_score"], r["simulated_rank"]) for r in first["rows"]] == \
           [(r["application_id"], r["simulated_score"], r["simulated_rank"]) for r in second["rows"]]


def test_what_if_does_not_call_the_model(world, monkeypatch):
    c, rh, jid = world["client"], world["rh"], world["job"]
    calls = []
    original = llm.chat_json

    def spy(*args, **kwargs):
        calls.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(llm, "chat_json", spy)
    assert c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SENIOR).status_code == 200
    assert calls == [], "the simulator called the LLM"


def test_what_if_rejects_bad_weights_and_wrong_users(world):
    c = world["client"]
    assert c.post(f"/api/jobs/{world['job']}/what-if", headers=world["rh"],
                  json={**DEFAULT, "skills": 51}).status_code == 422
    assert c.post(f"/api/jobs/{world['job']}/what-if", headers=_auth(world["other"]["token"]),
                  json=SENIOR).status_code == 403
    assert c.post(f"/api/jobs/{world['job']}/what-if", headers=_auth(world["cand"]["token"]),
                  json=SENIOR).status_code == 403
    assert c.post("/api/jobs/999999/what-if", headers=world["rh"], json=SENIOR).status_code == 404


def test_apply_requires_confirmation_and_then_audits(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    no_confirm = c.post(f"/api/jobs/{jid}/what-if/apply", headers=rh, json=SENIOR)
    assert no_confirm.status_code == 400
    ok = c.post(f"/api/jobs/{jid}/what-if/apply", headers=rh,
                json={**SKILLS_FIRST, "confirm": True, "reason": "Applied from the simulator"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["configured"]["skills"] == 65.0
    history = c.get(f"/api/jobs/{jid}/weights", headers=rh).json()["history"]
    assert history[0]["reason"] == "Applied from the simulator"
    assert history[0]["recruiter_id"] == world["rec"]["user"]["id"]


def test_override_is_labelled_and_left_alone_by_the_simulator(world):
    """A human override is not an AI score: the simulation must show both, not replace either."""
    import models as m
    from db import SessionLocal
    c, rh, jid, aid = world["client"], world["rh"], world["job"], world["app"]
    db = SessionLocal()
    app_row = db.get(m.Application, aid)
    app_row.override_score = 12.5
    app_row.override_reason = "Recruiter set this by hand"
    db.commit()
    db.close()
    try:
        sim = c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SENIOR).json()
        row = next(r for r in sim["rows"] if r["application_id"] == aid)
        assert row["override_score"] == 12.5
        assert row["override_reason"] == "Recruiter set this by hand"
        assert row["simulated_score"] is not None  # the AI number is still shown
        # the override, not the arithmetic, decides the simulated position
        assert row["ranking_score"] == 12.5
    finally:
        db = SessionLocal()
        app_row = db.get(m.Application, aid)
        app_row.override_score = None
        app_row.override_reason = None
        db.commit()
        db.close()


def test_simulation_reports_incomplete_assessments_instead_of_inventing_scores(world):
    from db import SessionLocal
    import models as m
    c, rh, jid = world["client"], world["rh"], world["job"]
    db = SessionLocal()
    row = db.query(m.Assessment).filter(m.Assessment.application_id == world["app"]).one()
    saved = row.payload_json
    payload = json.loads(saved)
    payload.pop("not_measured", None)  # simulate a row that predates the bookkeeping
    row.payload_json = json.dumps(payload)
    db.commit()
    db.close()
    try:
        sim = c.post(f"/api/jobs/{jid}/what-if", headers=rh, json=SENIOR).json()
        assert sim["incomplete"] >= 1
        incomplete = [r for r in sim["rows"] if r["simulated_score"] is None]
        assert incomplete and incomplete[0]["warnings"] == ["incomplete_assessment"]
    finally:
        db = SessionLocal()
        row = db.query(m.Assessment).filter(m.Assessment.application_id == world["app"]).one()
        row.payload_json = saved
        db.commit()
        db.close()


def test_reset_returns_to_the_documented_default(world):
    c, rh, jid = world["client"], world["rh"], world["job"]
    c.put(f"/api/jobs/{jid}/weights", headers=rh, json=SENIOR)
    r = c.post(f"/api/jobs/{jid}/weights/reset", headers=rh)
    assert r.status_code == 200, r.text
    assert r.json()["configured"] == {k: float(v) for k, v in DEFAULT.items()}
    assert r.json()["is_default"] is True
