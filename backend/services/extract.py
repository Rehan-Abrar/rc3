"""Structured resume extraction from real text, with quote -> offset verification."""
import json
import re

from services import fairness, llm, skills

SYSTEM = """You extract structured data from resume text for a recruitment system.
Return JSON only, matching this shape:
{"name": str|null, "email": str|null, "phone": str|null, "links": [str], "summary": str|null,
 "skills": [{"label": str, "quote": str}],
 "experience": [{"company": str, "title": str, "start": str|null, "end": str|null,
                 "months": int|null, "summary": str, "quote": str}],
 "education": [{"institution": str, "degree": str, "field": str|null, "quote": str}],
 "projects": [{"name": str, "description": str, "tech": [str], "quote": str}],
 "certifications": [{"name": str, "quote": str}]}

RULES:
- Every "quote" MUST be copied verbatim from the supplied resume text. Never paraphrase a quote.
- Extract only what the text supports. Do not invent skills, employers, dates or degrees.
- Months = total months of that role computed from the stated dates when available, else null.
- Exclude gender, age, marital status, nationality, religion, photo and address entirely."""

_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": ["string", "null"]},
        "email": {"type": ["string", "null"]},
        "phone": {"type": ["string", "null"]},
        "links": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": ["string", "null"]},
        "skills": {"type": "array", "items": {
            "type": "object",
            "properties": {"label": {"type": "string"}, "quote": {"type": "string"}},
            "required": ["label", "quote"], "additionalProperties": False}},
        "experience": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "company": {"type": "string"}, "title": {"type": "string"},
                "start": {"type": ["string", "null"]}, "end": {"type": ["string", "null"]},
                "months": {"type": ["integer", "null"]}, "summary": {"type": "string"},
                "quote": {"type": "string"}},
            "required": ["company", "title", "start", "end", "months", "summary", "quote"],
            "additionalProperties": False}},
        "education": {"type": "array", "items": {
            "type": "object",
            "properties": {"institution": {"type": "string"}, "degree": {"type": "string"},
                           "field": {"type": ["string", "null"]}, "quote": {"type": "string"}},
            "required": ["institution", "degree", "field", "quote"], "additionalProperties": False}},
        "projects": {"type": "array", "items": {
            "type": "object",
            "properties": {"name": {"type": "string"}, "description": {"type": "string"},
                           "tech": {"type": "array", "items": {"type": "string"}},
                           "quote": {"type": "string"}},
            "required": ["name", "description", "tech", "quote"], "additionalProperties": False}},
        "certifications": {"type": "array", "items": {
            "type": "object",
            "properties": {"name": {"type": "string"}, "quote": {"type": "string"}},
            "required": ["name", "quote"], "additionalProperties": False}},
    },
    "required": ["name", "email", "phone", "links", "summary", "skills", "experience",
                 "education", "projects", "certifications"],
    "additionalProperties": False,
}
_FALLBACK_SKILLS = [
    "python", "django", "flask", "fastapi", "postgresql", "postgres", "mysql", "sql",
    "docker", "kubernetes", "react", "node", "typescript", "javascript", "git", "aws",
    "redis", "pytest", "java", "c++", "go", "rest", "restful", "ci/cd", "linux", "mongodb",
]


def _normalized_with_map(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace to single spaces, remembering each char's index in `text`."""
    out: list[str] = []
    index: list[int] = []
    previous_space = False
    for i, ch in enumerate(text):
        if ch.isspace():
            if not previous_space:
                out.append(" ")
                index.append(i)
                previous_space = True
            continue
        out.append(ch.lower())
        index.append(i)
        previous_space = False
    return "".join(out), index


def _find_quote(text: str, quote: str | None) -> tuple[str | None, int | None, int | None, str]:
    """Locate a quote in the resume. Returns (quote, start, end, support).

    Invariant: whenever support is "verified", text[start:end] == quote exactly. A quote the
    model paraphrased or elided is located on a whitespace-normalised copy, and the ORIGINAL
    slice is returned so offsets and quotes can never disagree.
    """
    q = (quote or "").strip().strip('\u201c\u201d"')
    if not q or not text:
        return None, None, None, "flagged_unverified"
    idx = text.find(q)
    if idx >= 0:
        return text[idx: idx + len(q)], idx, idx + len(q), "verified"
    flat, index = _normalized_with_map(text)
    norm_q = re.sub(r"\s+", " ", q).lower().strip()
    pos = flat.find(norm_q)
    if pos >= 0 and norm_q:
        start = index[pos]
        end = index[pos + len(norm_q) - 1] + 1
        return text[start:end], start, end, "verified"
    # Last resort: the model elided text with an ellipsis - anchor on the longest segment.
    for part in sorted((p.strip() for p in re.split(r"\.\.\.|\u2026", q) if p.strip()),
                       key=len, reverse=True)[:1]:
        flat_part = re.sub(r"\s+", " ", part).lower()
        pos = flat.find(flat_part)
        if pos >= 0 and len(flat_part) >= 12:
            start = index[pos]
            end = index[pos + len(flat_part) - 1] + 1
            return text[start:end], start, end, "verified"
    return q, None, None, "flagged_unverified"


def _heuristic(text: str) -> dict:
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)
    phone = re.search(r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{3,4}", text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    low = text.lower()
    found, seen = [], set()
    for term in _FALLBACK_SKILLS + list(skills.SYNONYMS):
        if re.search(rf"(?<![a-z0-9+#.]){re.escape(term)}(?![a-z0-9+#])", low):
            canon = skills.canonical(term)
            if canon not in seen:
                seen.add(canon)
                found.append({"label": skills.display(canon), "canonical": canon,
                              "quote": None, "start": None, "end": None,
                              "support": "flagged_unverified"})
    return {
        "name": lines[0] if lines else None,
        "email": email.group(0) if email else None,
        "phone": phone.group(0) if phone else None,
        "links": re.findall(r"(?:https?://|www\.)\S+", text)[:5],
        "summary": None,
        "skills": found, "experience": [], "education": [], "projects": [], "certifications": [],
    }


def extract(raw_text: str) -> tuple[dict, str]:
    """(profile, ai_mode). ai_mode is 'groq' only when the LLM actually produced the data."""
    masked = fairness.strip_protected(raw_text)
    if not masked.strip():
        return _heuristic(raw_text), "heuristic"
    try:
        data = llm.chat_json(SYSTEM, masked[:12000], tier="quality",
                             schema=_EXTRACT_SCHEMA, schema_name="resume_profile",
                             max_tokens=3200)
    except llm.AIUnavailable:
        return _heuristic(raw_text), "heuristic"

    out = {"name": data.get("name"), "email": data.get("email"), "phone": data.get("phone"),
           "links": data.get("links") or [], "summary": data.get("summary"),
           "skills": [], "experience": [], "education": [], "projects": [], "certifications": []}
    for s in data.get("skills") or []:
        label = (s.get("label") or "").strip()
        if not label:
            continue
        q, a, b, sup = _find_quote(raw_text, s.get("quote"))
        out["skills"].append({"label": label, "canonical": skills.canonical(label),
                              "quote": q, "start": a, "end": b, "support": sup})
    for e in data.get("experience") or []:
        q, a, b, sup = _find_quote(raw_text, e.get("quote"))
        out["experience"].append({
            "company": e.get("company") or "", "title": e.get("title") or "",
            "start": e.get("start"), "end": e.get("end"),
            "months": e.get("months") if isinstance(e.get("months"), int) else None,
            "summary": e.get("summary") or "", "quote": q, "start": a, "end": b, "support": sup})
    for ed in data.get("education") or []:
        q, a, b, sup = _find_quote(raw_text, ed.get("quote"))
        out["education"].append({"institution": ed.get("institution") or "",
                                 "degree": ed.get("degree") or "", "field": ed.get("field"),
                                 "quote": q, "start": a, "end": b, "support": sup})
    for p in data.get("projects") or []:
        q, a, b, sup = _find_quote(raw_text, p.get("quote"))
        out["projects"].append({"name": p.get("name") or "", "description": p.get("description") or "",
                                "tech": p.get("tech") or [], "quote": q,
                                "start": a, "end": b, "support": sup})
    for c in data.get("certifications") or []:
        q, a, b, sup = _find_quote(raw_text, c.get("quote"))
        out["certifications"].append({"name": c.get("name") or "", "quote": q, "support": sup})
    # Contact details are needed on the profile, but they must never influence scoring,
    # so they are recovered from the RAW text (masked text has them removed).
    if not out["email"]:
        m = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", raw_text)
        out["email"] = m.group(0) if m else None
    if not out["phone"]:
        m = re.search(r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{3,4}", raw_text)
        out["phone"] = m.group(0).strip() if m else None
    if not out["links"]:
        out["links"] = re.findall(r"(?:https?://|www\.)\S+", raw_text)[:5]
    return out, "groq"


def dumps(profile: dict) -> str:
    return json.dumps(profile, ensure_ascii=False)


def loads(blob: str | None) -> dict | None:
    if not blob:
        return None
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        return None
