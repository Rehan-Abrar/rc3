"""Masking: header names must leave the scoring text without moving a single offset.

The regression: PDFs that put "Name | Lahore, PK" on one line were not masked, so a
candidate's first name reached the embedding gate and the LLM prompt.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import fairness, pdf  # noqa: E402

LAYOUTS = [
    ("plain", "Ayesha Khan\nayesha.khan@example.com\n\nEXPERIENCE\nPython, Docker", "Ayesha"),
    ("pipe", "Ayesha Khan | Lahore, PK\n\nEXPERIENCE\nPython, Docker", "Ayesha"),
    ("dash", "Muhammad Ali Khan - Backend Engineer\nKarachi\n\nPython", "Muhammad"),
    ("middle-dot", "Sana Iqbal \u00b7 Karachi\nDjango, PostgreSQL", "Sana"),
    ("all-caps", "REHAN ABRAR | +92 300 1234567\nReact, TypeScript", "REHAN"),
    ("comma-age", "Rehan Abrar, 24\nLahore\n\nReact", "Rehan"),
    ("cv-header", "Curriculum Vitae\nUbaid Ur Rehmaan Dar | Lahore\nReact, Git", "Ubaid"),
]


@pytest.mark.parametrize("label,text,first_name", LAYOUTS)
def test_header_name_never_reaches_scoring_text(label, text, first_name):
    view = fairness.scoring_view(text)
    assert first_name.lower() not in view.lower(), f"{label}: name survived masking -> {view!r}"


@pytest.mark.parametrize("label,text,first_name", LAYOUTS)
def test_masking_keeps_lengths_so_offsets_stay_valid(label, text, first_name):
    masked = fairness.mask_same_length(text)
    assert len(masked) == len(text), f"{label}: masking changed the length, offsets would shift"
    # everything after the header must be untouched
    assert masked.endswith(text.splitlines()[-1])


def test_job_titles_are_not_mistaken_for_names():
    text = "Senior Backend Engineer | Lahore, PK\nPython and Docker"
    assert fairness.scoring_view(text).startswith("Senior Backend Engineer")
    assert fairness.mask_same_length(text) == text


def test_labelled_and_contact_fields_are_removed():
    text = ("Name: Ayesha Khan\nGender: Female\nAge: 24\nCNIC: 35202-1234567-1\n"
            "ayesha@example.com | +92 300 1234567 | https://linkedin.com/in/ayesha\n"
            "Python, Docker")
    view = fairness.scoring_view(text)
    for forbidden in ("Ayesha", "Female", "24", "35202", "@example.com", "+92", "linkedin"):
        assert forbidden not in view, f"{forbidden!r} survived masking -> {view!r}"
    assert "Python" in view and "Docker" in view


def test_real_cv_names_are_masked_and_content_is_kept():
    path = Path(__file__).resolve().parents[2] / "CVs" / "Rehan_Abrar_CV.pdf"
    if not path.exists():
        pytest.skip("real CV not present")
    raw, _pages = pdf.extract_any(path)
    masked = fairness.mask_same_length(raw)
    view = fairness.scoring_view(raw)
    assert len(masked) == len(raw)
    assert "rehan abrar" not in view.lower()
    # real content must survive: function names / technologies the CV claims
    assert any(token in view for token in ("React", "TypeScript", "Python", "Git"))


def test_audit_variants_score_identically_after_masking():
    base = "Ayesha Khan | Lahore, PK\n\nEXPERIENCE\nBuilt REST services in Python with Docker."
    views = {k: " ".join(fairness.scoring_view(v).split())
             for k, v in fairness.audit_texts(base).items()}
    baseline = views.pop("baseline")
    for key, view in views.items():
        assert view == baseline, f"{key} changed the text scoring sees"
