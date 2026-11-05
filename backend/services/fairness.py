"""Protected/irrelevant attribute stripping, offset-preserving masking, swap audit (R33)."""
import re

PROTECTED_ATTRS = [
    "name", "gender", "sex", "age", "date of birth", "dob", "marital status",
    "nationality", "religion", "caste", "sect", "photo", "address", "cnic", "passport",
]

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE = re.compile(r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{3,4}")
_URL = re.compile(r"(?:https?://|www\.)\S+")
_LABELLED = re.compile(
    r"(?im)^[ \t]*(?:name|gender|sex|age|d\.o\.b\.?|date of birth|dob|marital status|"
    r"nationality|religion|caste|sect|address|cnic|passport(?: no\.?| number)?)[ \t]*[:\-].*$"
)
_INLINE = re.compile(
    r"(?i)\b(?:\d{1,2}\s*(?:years?|yrs?)\s*old|married|single|divorced|male|female)\b"
)
_NAME_LINE = re.compile(r"^[ \t]*[A-Z][A-Za-z'\-]+(?:[ \t]+[A-Z][A-Za-z'.\-]+){1,3}[ \t]*$")

# Words that mean a header line is a job title, not a person's name. Without this guard
# "Senior Backend Engineer | Lahore" would be masked as if "Senior Backend" were a name,
# which would delete real evidence from the text we score.
_TITLE_WORDS = {
    "engineer", "developer", "designer", "manager", "analyst", "intern", "scientist",
    "architect", "consultant", "lead", "specialist", "officer", "student", "researcher",
    "administrator", "programmer", "associate", "director", "head", "principal", "senior",
    "junior", "trainee", "freelancer", "teacher", "lecturer", "professor",
}
_NAME_HEAD = re.compile(
    r"^[ \t]*([A-Z][A-Za-z'\u2019.\-]+(?:[ \t]+[A-Z][A-Za-z'\u2019.\-]+){1,3})")
_SEPARATOR_AFTER_NAME = re.compile(r"^[ \t]*(?:[|\u2022\u00b7,;:@+()/\u2013\u2014-]|$)")
# "Ayesha Khan, 24" - a bare two-digit number glued to a name is almost always the age.
_AGE_AFTER_NAME = re.compile(r"^([ \t]*[,\-|]\s*)(\d{1,2})(?=\s*(?:$|[,\-|]))")


def name_span(line: str) -> tuple[int, int] | None:
    """Offsets of a leading personal name inside a header line, or None.

    Handles the layouts that actually occur: "Ayesha Khan", "Ayesha Khan | Lahore, PK",
    "Ayesha Khan - Backend Engineer", "AYESHA KHAN", "Ayesha Khan, 24".
    """
    if not line.strip():
        return None
    m = _NAME_HEAD.match(line)
    if not m:
        return None
    span = m.group(1)
    tokens = [t.strip(".,;").lower() for t in span.split()]
    if len(tokens) < 2 or len(tokens) > 4:
        return None
    if any(t in _TITLE_WORDS for t in tokens):
        return None
    if any(ch.isdigit() for ch in span):
        return None
    return m.start(1), m.end(1)


def _derived_tokens(text: str) -> list[str]:
    """Name/email fragments that identify the person, e.g. "Rehan" or "rehanabrar36".

    Profiles appear all over a CV as bare domains ("GitHub: github.com/Rehan-Abrar"), which the
    URL pattern does not catch; scrubbing these tokens removes them without touching skills.
    """
    tokens: set[str] = set()
    emails = {e.lower() for e in _EMAIL.findall(text)}
    for email in emails:
        local = email.split("@")[0]
        for piece in re.split(r"[^a-z0-9]+", local):
            if len(piece) >= 4 and not piece.isdigit():
                tokens.add(piece)
    for line in text.splitlines()[:3]:
        span = name_span(line)
        if span:
            for word in line[span[0]:span[1]].split():
                clean = word.strip(".,;:()").lower()
                if len(clean) >= 3:
                    tokens.add(clean)
    return sorted(tokens, key=len, reverse=True)


def _scrub(text: str, tokens: list[str], filler: str = "") -> str:
    for token in tokens:
        text = re.sub(re.escape(token), lambda m, f=filler: f * len(m.group(0))
                      if f else "", text, flags=re.IGNORECASE)
    return text


def strip_protected(text: str) -> str:
    """Remove personal/protected identifiers before any scoring or LLM call."""
    if not text:
        return ""
    # Header names first: "Ayesha Khan | Lahore" must lose the name but keep the location,
    # because location is not protected and the rest of the line may be a real detail.
    tokens = _derived_tokens(text)
    lines = text.splitlines()
    for i, line in enumerate(lines[:3]):
        span = name_span(line)
        if not span:
            continue
        rest = line[span[1]:]
        if i == 0 or _SEPARATOR_AFTER_NAME.match(rest):
            tail = rest
            age = _AGE_AFTER_NAME.match(tail)
            if age:
                tail = tail[:age.start(2)] + "X" * len(age.group(2)) + tail[age.end(2):]
            lines[i] = line[:span[0]] + tail
    out = "\n".join(lines)
    out = _LABELLED.sub("", out)
    out = _EMAIL.sub("[email removed]", out)
    out = _URL.sub("[link removed]", out)
    out = _PHONE.sub("[phone removed]", out)
    out = _INLINE.sub("[attribute removed]", out)
    # name/email fragments last, so the structured patterns above still match first
    return _scrub(out, tokens)


def _mask_name_line(text: str) -> list[str]:
    """X-fill the header name in place, so evidence offsets stay valid after masking."""
    out = list(text)
    cursor = 0
    for index, line in enumerate(text.splitlines()[:3]):
        start = cursor
        cursor += len(line) + 1
        if re.search(r"(?i)resume|curriculum|vitae|summary", line):
            continue
        span = name_span(line)
        if not span:
            continue
        rest = line[span[1]:]
        if index != 0 and not _SEPARATOR_AFTER_NAME.match(rest):
            continue
        for i in range(start + span[0], start + span[1]):
            if out[i] not in "\n\r":
                out[i] = "X"
        age = _AGE_AFTER_NAME.match(rest)
        if age:
            first = start + span[1] + age.start(2)
            for i in range(first, first + len(age.group(2))):
                out[i] = "X"
        break
    return out


def mask_same_length(text: str) -> str:
    """Mask protected identifiers with equal-length filler so char offsets stay valid."""
    if not text:
        return ""
    out = _mask_name_line(text)
    tokens = _derived_tokens(text)
    for pat in (_EMAIL, _URL, _PHONE, _LABELLED, _INLINE):
        snapshot = "".join(out)
        for m in pat.finditer(snapshot):
            for i in range(m.start(), m.end()):
                if out[i] not in "\n\r":
                    out[i] = "X"
    return "".join(out)


def audit_texts(base: str) -> dict[str, str]:
    """Deterministic perturbations used by /audit/fairness."""
    return {
        "baseline": base,
        "gender": base + "\nGender: Male",
        "name": "Muhammad Ali Khan\n" + base,
        "age": base + "\nAge: 24",
        "marital": base + "\nMarital status: Married",
        "nationality": base + "\nNationality: Pakistani",
    }


def scoring_view(text: str) -> str:
    """The exact view scoring is allowed to see: no protected lines, no bare name line."""
    out = strip_protected(text or "")
    lines = [ln for ln in out.splitlines() if not _NAME_LINE.match(ln)]
    return re.sub(r"[ \t]+", " ", "\n".join(lines)).strip()
