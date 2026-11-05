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


def strip_protected(text: str) -> str:
    """Remove personal/protected identifiers before any scoring or LLM call."""
    if not text:
        return ""
    out = _LABELLED.sub("", text)
    out = _EMAIL.sub("[email removed]", out)
    out = _URL.sub("[link removed]", out)
    out = _PHONE.sub("[phone removed]", out)
    out = _INLINE.sub("[attribute removed]", out)
    return out


def _mask_name_line(text: str) -> list[str]:
    out = list(text)
    for line in text.splitlines()[:3]:
        if _NAME_LINE.match(line) and not re.search(r"(?i)resume|curriculum|vitae|summary", line):
            start = text.find(line)
            for i in range(start, start + len(line)):
                if out[i] not in "\n\r":
                    out[i] = "X"
            break
    return out


def mask_same_length(text: str) -> str:
    """Mask protected identifiers with equal-length filler so char offsets stay valid."""
    if not text:
        return ""
    out = _mask_name_line(text)
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
