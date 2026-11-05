"""Real document parsing (PDF via PyMuPDF, DOCX via the OOXML zip) with offset-keeping chunks."""
import html
import re
import zipfile
from pathlib import Path

MAX_CHUNK = 900

SECTION_HINTS = [
    ("education", ("education", "academic", "qualification")),
    ("experience", ("experience", "employment", "work history", "professional")),
    ("projects", ("project",)),
    ("certification", ("certification", "certificate", "licence", "license")),
    ("skills", ("skill", "technologies", "tech stack", "technical")),
    ("summary", ("summary", "profile", "objective", "about")),
]


class ParseFailure(ValueError):
    pass


def extract_text(path: Path) -> tuple[str, int]:
    """Return (raw_text, page_count). Raises ParseFailure for unusable documents."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise ParseFailure("PDF engine unavailable on the server") from exc
    try:
        doc = fitz.open(path)
    except Exception as exc:  # noqa: BLE001
        raise ParseFailure(f"Could not open PDF ({type(exc).__name__})") from exc
    try:
        pages = [page.get_text("text") or "" for page in doc]
        page_count = doc.page_count
    finally:
        doc.close()
    text = "\n".join(pages)
    text = text.replace("\r\n", "\n").replace("\xa0", " ")
    return text, page_count


def extract_docx(path: Path) -> tuple[str, int]:
    """Return (raw_text, page_count) for a .docx by reading word/document.xml directly.

    No extra dependency: a .docx is a zip of XML, paragraphs are <w:p>, line breaks <w:br/>.
    """
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", "ignore")
    except (KeyError, zipfile.BadZipFile, OSError) as exc:
        raise ParseFailure(f"Could not open DOCX ({type(exc).__name__})") from exc
    nl = chr(10)
    xml = xml.replace("</w:p>", nl)
    xml = re.sub(r"<w:br[^>]*/>", nl, xml)
    xml = re.sub(r"<w:tab[^>]*/>", "  ", xml)
    text = html.unescape(re.sub(r"<[^>]+>", "", xml))
    text = text.replace(chr(13) + nl, nl).replace(chr(160), " ").replace(chr(0x200B), "")
    lines = [line.rstrip(" \t") for line in text.split(nl)]
    while "" in lines[1:] and any(a == "" and b == "" for a, b in zip(lines, lines[1:])):
        lines = [lines[i] for i in range(len(lines)) if not (lines[i] == "" and i and lines[i - 1] == "")]
    text = nl.join(lines).strip()
    if not text:
        raise ParseFailure("No text found in the DOCX (it may be images only).")
    return text, max(1, len(text) // 3000 + 1)


def extract_any(path: Path) -> tuple[str, int]:
    """Dispatch on the file extension. Raises ParseFailure for unsupported types."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text(path)
    if suffix == ".docx":
        return extract_docx(path)
    if suffix == ".doc":
        raise ParseFailure("Legacy .doc is not supported - save it as .docx or PDF.")
    raise ParseFailure("Unsupported file type '" + suffix + "'. Upload a PDF or DOCX.")


def classify(text: str) -> tuple[str, str | None]:
    """(status, error). Scanned/image-only PDFs have no text layer."""
    printable = sum(1 for ch in text if ch.isprintable() and not ch.isspace())
    if printable == 0:
        return "empty", "No text layer found (looks scanned). Upload a text-based PDF or enter details manually."
    if printable < 80:
        return "empty", "The PDF contains almost no readable text. Enter your details manually or re-export the resume."
    if len(re.findall(r"[A-Za-z]{2,}", text)) < 20:
        return "failed", "Could not find readable words in this PDF."
    return "ok", None


def _section_for(line: str) -> str | None:
    low = line.strip().lower().strip(":")
    if len(low) > 40:
        return None
    for section, hints in SECTION_HINTS:
        if any(low.startswith(h) for h in hints):
            return section
    return None


def chunks(text: str) -> list[dict]:
    """Split text into chunks that remember their exact char range in `text`."""
    out: list[dict] = []
    section = "other"
    cursor = 0
    line_starts = []
    for m in re.finditer(r".*(?:\n|$)", text):
        if m.group(0) == "":
            break
        line_starts.append((m.start(), m.group(0)))
    buf: list[str] = []
    buf_start: int | None = None
    for start, line in line_starts:
        sec = _section_for(line)
        if sec:
            if buf and buf_start is not None:
                out.append(_mk(section, text, buf_start, start))
            buf, buf_start = [], None
            section = sec
            continue
        if buf_start is None:
            buf_start = start
        buf.append(line)
        if sum(len(b) for b in buf) >= MAX_CHUNK:
            out.append(_mk(section, text, buf_start, start + len(line)))
            buf, buf_start = [], None
    if buf and buf_start is not None:
        out.append(_mk(section, text, buf_start, len(text)))
    if not out and text.strip():
        out.append(_mk("other", text, 0, len(text)))
    cursor = 0
    return [c for c in out if c["text"].strip()][:40]


def _mk(section: str, text: str, start: int, end: int) -> dict:
    end = min(end, len(text))
    # Keep the exact slice so char_start/char_end always round-trip to this text.
    return {"section": section, "text": text[start:end], "char_start": start, "char_end": end}
