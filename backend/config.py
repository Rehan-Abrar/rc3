import os
from pathlib import Path


def _load_env() -> None:
    """Minimal .env loader (no dependency). First value wins; process env wins over file."""
    here = Path(__file__).resolve().parent
    for candidate in (here / ".env", here.parent / ".env"):
        if not candidate.exists():
            continue
        for raw in candidate.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


_load_env()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
(DATA_DIR / "resumes").mkdir(exist_ok=True)

DB_PATH = Path(os.environ.get("RC3_TEST_DB") or (DATA_DIR / "app.db"))
DATABASE_URL = f"sqlite:///{DB_PATH}"

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me-comp-secret")
JWT_ALG = "HS256"
JWT_TTL_MIN = 60 * 8

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MODEL_QUALITY = os.getenv("GROQ_MODEL_QUALITY", "openai/gpt-oss-120b")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")
# llama-3.3-70b-versatile was retired; these are the models this account can actually list.
GROQ_FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
# Tier -> model + reasoning effort. 120B for extraction/evidence/explanation (quality),
# 20B for requirement extraction, question generation and query parsing (latency).
GROQ_TIERS = {
    "quality": {"model": GROQ_MODEL_QUALITY, "reasoning_effort": "medium"},
    "fast": {"model": GROQ_MODEL_FAST, "reasoning_effort": "low"},
}
EMBED_MODEL = os.getenv("EMBED_MODEL", "minishlab/potion-base-8M")
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

MAX_UPLOAD_BYTES = 8 * 1024 * 1024

_KEYS = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ1"), os.getenv("GROQ2")]


def groq_keys() -> list[str]:
    """Groq credentials from backend/.env: GROQ1 then GROQ2 (GROQ_API_KEY first if set).

    Order is preference only. A 429 is treated as a rate limit and surfaced,
    never a reason to hammer the next key.
    """
    seen, out = set(), []
    for k in _KEYS:
        k = (k or "").strip()
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def env_file() -> Path:
    return BASE_DIR / ".env"
