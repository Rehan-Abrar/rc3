"""Evidence offsets must always be real positions in the résumé text.

The regression that motivated this file: PDF/DOCX text wraps mid-sentence, the model quoted
the sentence with spaces, and the old verifier matched a whitespace-collapsed copy while
returning no offsets - so a row could claim `verified` with nothing to point at.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import matching, pdf  # noqa: E402

CV_DIR = Path(__file__).resolve().parents[2] / "CVs"


def _norm(text: str) -> str:
    return " ".join((text or "").split()).lower()


def _wrapped_sentence(raw: str) -> str:
    """A quote the way a model writes it: the sentence, but with the wrap removed."""
    for line in raw.splitlines():
        if len(line) > 60 and not line.startswith(" "):
            return line.strip()
    return ""


def _documents():
    """(label, raw text) for the real CVs in the repo plus a synthetic wrapped résumé."""
    docs = []
    for name in ("Rehan_Abrar_CV.pdf", "Mustafa_CV.pdf", "Ubaid_Ur_Rehmaan_CV.docx"):
        path = CV_DIR / name
        if path.exists():
            raw, _pages = pdf.extract_any(path)
            docs.append((name, raw))
    docs.append(("synthetic-wrapped", SYNTHETIC))
    return docs


SYNTHETIC = """Sana Iqbal
sana@example.com

EXPERIENCE
Built and maintained Django REST services in Python for four
years, then led the migration of the billing platform to
PostgreSQL with zero downtime.
"""


@pytest.mark.parametrize("label,raw", _documents())
def test_wrapped_quote_gets_real_offsets(label, raw):
    """A quote that only differs from the source by a line wrap keeps true offsets."""
    assert raw.strip(), f"{label} produced no text"
    # build a quote by taking a source span and flattening its whitespace
    start = raw.find(" ")
    span_end = min(len(raw), start + 120)
    source = raw[start:span_end]
    quote = " ".join(source.split())
    if len(quote) < 25:
        pytest.skip(f"{label} has no usable span")

    verified_quote, qstart, qend, support = matching._verify(raw, quote)
    assert support == "verified", f"{label}: wrapped quote was not verified"
    assert qstart is not None and qend is not None, f"{label}: verified without offsets"
    # the offsets must point at the words of the quote inside the original text
    assert _norm(raw[qstart:qend]) == _norm(quote), f"{label}: offsets do not contain the quote"
    # and the reported quote is the model's quote, not a rewritten one
    assert _norm(verified_quote) == _norm(quote)


@pytest.mark.parametrize("label,raw", _documents())
def test_exact_quote_offsets_are_exact(label, raw):
    source = raw.find("EXPERIENCE")
    if source < 0:
        pytest.skip(f"{label} has no EXPERIENCE section")
    idx = raw.find(" ", source)
    quote = raw[idx + 1:idx + 60].strip()
    if not quote:
        pytest.skip("empty span")
    _q, start, end, support = matching._verify(raw, quote)
    if support == "verified":
        assert raw[start:end] == quote


def test_unverifiable_quote_is_flagged_without_invented_offsets():
    raw = "Python, Docker, PostgreSQL"
    q, start, end, support = matching._verify(raw, "Kubernetes and Terraform at scale")
    assert support == "flagged_unverified"
    assert start is None and end is None


def test_offsets_never_point_at_other_words():
    """Sweep every word boundary: if we report a span, its words are the quote's words."""
    raw = "Alpha beta\nGamma delta\nEpsilon zeta eta theta"
    words = raw.split()
    for size in range(1, 4):
        for i in range(len(words) - size + 1):
            quote = " ".join(words[i:i + size])
            _q, start, end, support = matching._verify(raw, quote)
            if support == "verified":
                assert _norm(raw[start:end]) == _norm(quote), quote


def test_physics_of_the_fix_on_the_real_cvs():
    """The three CVs that used to fail now verify quotes that span a line wrap."""
    expected = {"Rehan_Abrar_CV.pdf": True, "Mustafa_CV.pdf": True, "Ubaid_Ur_Rehmaan_CV.docx": True}
    checked = 0
    for name, raw in _documents():
        if name not in expected:
            continue
        # a two-line quote: last words of one line plus the first of the next
        lines = [ln.strip() for ln in raw.splitlines() if len(ln.strip()) > 30]
        if len(lines) < 2:
            continue
        quote = " ".join((lines[0].split()[-4:] + lines[1].split()[:4]))
        _q, start, end, support = matching._verify(raw, quote)
        if support == "verified":
            assert _norm(raw[start:end]) == _norm(quote), name
            checked += 1
    assert checked >= 1, "no multi-line quote could be verified at all"
