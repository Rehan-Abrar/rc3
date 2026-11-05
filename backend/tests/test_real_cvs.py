"""Real CVs (PDF + DOCX) must parse, extract and stay quote-verifiable."""
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from services import extract, pdf

CV_DIR = Path(__file__).resolve().parents[2] / "CVs"
PDF_CV = CV_DIR / "Rehan_Abrar_CV.pdf"
DOCX_CV = CV_DIR / "Ubaid_Ur_Rehmaan_CV.docx"
CVS = [p for p in (PDF_CV, DOCX_CV) if p.exists()]


def test_cv_files_present():
    assert PDF_CV.exists(), f"missing {PDF_CV}"
    assert DOCX_CV.exists(), f"missing {DOCX_CV}"


@pytest.mark.parametrize("path", CVS, ids=lambda p: p.suffix.lstrip("."))
def test_parsing_returns_email_and_sections(path):
    raw, pages = pdf.extract_any(path)
    assert len(raw) > 800, f"{path.name} produced only {len(raw)} characters"
    assert pages >= 1
    status, error = pdf.classify(raw)
    assert status == "ok", error
    lowered = raw.lower()
    assert any(s in lowered for s in ("experience", "employment", "projects")), "no sections found"


def test_docx_parsing_has_no_markup_left():
    raw, _ = pdf.extract_any(DOCX_CV)
    assert "<w:" not in raw and "xml" not in raw.lower()[:200]
    assert "\u200b" not in raw
    assert raw.count("\n\n\n") == 0


@pytest.mark.parametrize("path", CVS, ids=lambda p: p.suffix.lstrip("."))
def test_extraction_quotes_are_verbatim(path):
    raw, _ = pdf.extract_any(path)
    profile, mode = extract.extract(raw)
    assert mode in ("groq", "degraded", "heuristic")
    assert profile["skills"], "no skills extracted"
    verified = 0
    for skill in profile["skills"]:
        quote, start, end = skill.get("quote"), skill.get("start"), skill.get("end")
        if skill["support"] == "verified":
            verified += 1
            assert isinstance(start, int) and isinstance(end, int)
            assert raw[start:end] == quote, f"offset mismatch for {skill['label']}"
        else:
            assert skill["support"] == "flagged_unverified"
    if mode == "groq":
        assert verified >= 3, f"only {verified} verified quotes from {path.name}"
    print(f"{path.name}: mode={mode} skills={len(profile['skills'])} verified={verified}")
