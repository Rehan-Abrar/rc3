"""Scoring, parsing, fairness and conflict tests. Offline: no LLM required."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import models as m
from db import Base, SessionLocal, engine
from main import app
from services import embeddings, extract, fairness, matching, skills

SAMPLE = """Ayesha Khan
ayesha.khan@example.com

EXPERIENCE
Built and maintained Django REST services in Python for 4 years.
Containerised all services with Docker.
"""


def test_skill_normalization():
    assert skills.matches("JS", "JavaScript")
    assert skills.matches("Postgres", "PostgreSQL")
    assert skills.matches("restful api", "REST API")
    assert skills.matches("K8s", "Kubernetes")
    assert not skills.matches("Java", "JavaScript")


def test_quote_verification_and_flagged_claims():
    quote, start, end, support = extract._find_quote(SAMPLE, "Containerised all services with Docker.")
    assert support == "verified"
    assert SAMPLE[start:end] == quote
    _, _, _, bad = extract._find_quote(SAMPLE, "Led a team of 20 engineers at Google.")
    assert bad == "flagged_unverified"


def test_heuristic_fallback_is_flagged_not_claimed_as_ai():
    profile = extract._heuristic(SAMPLE)
    assert profile["email"] == "ayesha.khan@example.com"
    assert profile["skills"], "dictionary scan should find skills"
    assert all(s["support"] == "flagged_unverified" for s in profile["skills"])


def test_tri_state_not_evidenced_is_not_confirmed_absent():
    reqs = [{"id": 1, "label": "Docker", "kind": "skill", "importance": "required", "weight": 1.0,
             "min_years": None, "evidence_hint": None},
            {"id": 2, "label": "Kubernetes", "kind": "skill", "importance": "required",
             "weight": 1.0, "min_years": None, "evidence_hint": None}]
    verdicts = {1: {"status": "matched", "reason": "quote", "quote": "Containerised all services with Docker.",
                    "start": 0, "end": 10, "support": "verified"}}
    rows = matching.build_rows(reqs, verdicts, {1: 0.8, 2: 0.1})
    by_label = {r["label"]: r for r in rows}
    assert by_label["Docker"]["status"] == "matched"
    assert by_label["Kubernetes"]["status"] == "not_evidenced"
    assert by_label["Kubernetes"]["status"] != "confirmed_absent"


def test_weighted_score_arithmetic_and_determinism():
    rows = [
        {"requirement_id": 1, "label": "Python", "kind": "skill", "importance": "required",
         "weight": 1.0, "status": "matched", "support": "verified"},
        {"requirement_id": 2, "label": "Docker", "kind": "skill", "importance": "required",
         "weight": 1.0, "status": "partial", "support": "verified"},
        {"requirement_id": 3, "label": "REST API", "kind": "skill", "importance": "preferred",
         "weight": 1.0, "status": "not_evidenced", "support": "flagged_unverified"},
    ]
    profile = {"experience": [{"months": 36}], "projects": [], "skills": []}
    reqs = [{"id": 1, "min_years": 3}, {"id": 2, "min_years": None}, {"id": 3, "min_years": None}]
    a = matching.combine(rows, profile, "python backend docker", [], reqs)
    b = matching.combine(rows, profile, "python backend docker", [], reqs)
    assert a == b, "scoring must be deterministic"
    # skills = (1.0*1 + 1.0*0.5 + 0.4*0) / 2.4 = 62.5
    assert a["skills"] == pytest.approx(62.5, abs=0.1)
    assert a["experience"] == pytest.approx(100.0, abs=0.1)  # 36 months vs 3 years


def test_fairness_masking_is_offset_preserving_and_invariant():
    masked = fairness.mask_same_length(SAMPLE)
    assert len(masked) == len(SAMPLE)
    assert "Docker" in masked and "Python" in masked
    views = {k: fairness.scoring_view(v) for k, v in fairness.audit_texts(SAMPLE).items()}
    assert len(set(views.values())) == 1, "protected attributes must not change the scoring input"


def test_dense_embeddings_are_semantic_not_lexical():
    if embeddings.mode() != "dense":
        pytest.skip("dense provider unavailable in this environment")
    v = embeddings.encode(["REST API design",
                           "built HTTP endpoints consumed by partner integrations",
                           "cooked pasta with tomato sauce"])
    near = embeddings.cosine(v[0], v[1])
    far = embeddings.cosine(v[0], v[2])
    assert near > far * 3, f"paraphrase {near:.3f} should clearly beat unrelated {far:.3f}"


def test_interview_conflict_returns_409():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        rec = db.query(m.User).filter_by(email="conflict@test.dev").one_or_none()
        if not rec:
            from security import hash_password
            rec = m.User(email="conflict@test.dev", password_hash=hash_password("Password123"),
                         full_name="Rec Conflicts", role="recruiter")
            db.add(rec)
            db.commit()
            db.refresh(rec)
        job = m.Job(recruiter_id=rec.id, title="Conflict Job", description="d")
        db.add(job)
        db.commit()
        db.refresh(job)
        cand = db.query(m.User).filter_by(email="conflict.c@test.dev").one_or_none()
        if not cand:
            from security import hash_password
            cand = m.User(email="conflict.c@test.dev", password_hash=hash_password("Password123"),
                          full_name="Cand Conflicts", role="candidate")
            db.add(cand)
            db.commit()
            db.refresh(cand)
        res = m.Resume(candidate_id=cand.id, filename="x.pdf", raw_text=SAMPLE,
                       parse_status="ok", page_count=1)
        db.add(res)
        db.commit()
        db.refresh(res)
        app_row = db.query(m.Application).filter_by(job_id=job.id, candidate_id=cand.id).one_or_none()
        if not app_row:
            app_row = m.Application(job_id=job.id, candidate_id=cand.id, resume_id=res.id)
            db.add(app_row)
            db.commit()
            db.refresh(app_row)
        job_id, app_id, rec_id = job.id, app_row.id, rec.id
    finally:
        db.close()

    from security import create_token
    db = SessionLocal()
    try:
        token = create_token(db.get(m.User, rec_id))
    finally:
        db.close()
    client = TestClient(app)
    h = {"Authorization": f"Bearer {token}"}
    start = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%dT%H:00:00Z")
    body = {"application_id": app_id, "scheduled_at": start, "duration_min": 60,
            "interviewer_id": rec_id, "interview_type": "technical"}
    first = client.post("/api/interviews", headers=h, json=body)
    assert first.status_code == 201, first.text
    body2 = dict(body, scheduled_at=(datetime.now(timezone.utc) + timedelta(days=3))
                 .strftime("%Y-%m-%dT%H:30:00Z"))
    second = client.post("/api/interviews", headers=h, json=body2)
    assert second.status_code == 409
    assert "conflict_with" in second.json()["detail"]


def test_degraded_mode_is_graceful_and_labelled():
    """AI down must not crash: extraction falls back and says so honestly."""
    from services import llm

    def boom(*args, **kwargs):
        raise llm.AIUnavailable("simulated outage")

    orig = llm.chat_json
    llm.chat_json = boom
    try:
        profile, ai_mode = extract.extract(SAMPLE)
        assert ai_mode in ("degraded", "heuristic"), ai_mode
        assert ai_mode != "groq"
        assert profile["email"] == "ayesha.khan@example.com"
        assert profile["skills"], "heuristic scan still finds skills"
        assert all(s["support"] != "verified" for s in profile["skills"])
    finally:
        llm.chat_json = orig
