"""The number on screen must be reproducible from the breakdown beside it.

Regression: Experience showed 0 (with a 25% weight label) while the overall had actually
excluded that dimension. Judges read that as broken maths, and it was.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import matching  # noqa: E402

PROFILE = {"experience": [{"company": "Nordvale", "title": "Backend Engineer",
                           "months": 48, "summary": "", "quote": None}],
           "projects": [{"name": "Billing", "summary": "REST service", "quote": None, "stack": []}]}
ROWS = [
    {"requirement_id": 1, "label": "Python", "kind": "skill", "importance": "required",
     "weight": 1.0, "status": "matched", "score": 1.0, "similarity": 0.8,
     "quote": "Python", "start": 0, "end": 6, "support": "verified", "reason": ""},
    {"requirement_id": 2, "label": "Docker", "kind": "skill", "importance": "required",
     "weight": 1.0, "status": "matched", "score": 1.0, "similarity": 0.7,
     "quote": "Docker", "start": 7, "end": 13, "support": "verified", "reason": ""},
]


def _combine(reqs, rows=ROWS):
    return matching.combine(rows, PROFILE, "REST API work", [{"text": "built a REST service"}], reqs)


def test_no_year_bar_means_experience_is_not_measured_not_zero():
    reqs = [{"id": 1, "label": "Python", "importance": "required", "min_years": None},
            {"id": 2, "label": "Docker", "importance": "required", "min_years": None}]
    out = _combine(reqs)
    assert "experience" in out["not_measured"], out["not_measured"]
    assert out["effective_weights"]["experience"] == 0.0
    # what is displayed must multiply out to the overall we report
    total = 0.0
    for key, weight in out["effective_weights"].items():
        if key in out["not_measured"]:
            continue
        total += weight * out[key]
    assert abs(total - out["overall"]) < 0.6, (total, out["overall"])
    assert abs(sum(out["effective_weights"].values()) - 1.0) < 1e-3


def test_year_bar_means_experience_counts():
    reqs = [{"id": 1, "label": "Python", "importance": "required", "min_years": 4},
            {"id": 2, "label": "Docker", "importance": "required", "min_years": 4}]
    out = _combine(reqs)
    assert "experience" not in out["not_measured"]
    # no qualification requirement exists in this fixture, so the remaining weights are
    # renormalised over 0.50 + 0.25 + 0.15 = 0.90 and experience carries 0.25/0.90.
    assert "qualifications" in out["not_measured"]
    assert abs(out["effective_weights"]["experience"] - 0.25 / 0.90) < 1e-3
    assert out["experience"] > 0
    total = sum(w * out[k] for k, w in out["effective_weights"].items()
                if k not in out["not_measured"])
    assert abs(total - out["overall"]) < 0.6


def test_measured_dimension_that_scores_zero_is_not_confused_with_not_applicable():
    """No evidence at all is a real zero and stays in the weights."""
    reqs = [{"id": 1, "label": "Kubernetes", "importance": "required", "min_years": None}]
    rows = [{"requirement_id": 1, "label": "Kubernetes", "kind": "skill",
             "importance": "required", "weight": 1.0, "status": "not_evidenced", "score": 0.0,
             "similarity": 0.1, "quote": None, "start": None, "end": None,
             "support": "flagged_unverified", "reason": "absent"}]
    out = _combine(reqs, rows)
    assert "skills" not in out["not_measured"]
    assert out["skills"] == 0.0
    assert out["effective_weights"]["skills"] > 0
