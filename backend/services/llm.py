"""Groq client: strict structured outputs, two model tiers, org-wide rate-limit respect.

- GROQ1 / GROQ2 are CREDENTIALS, never model selectors.
- A 429 is an organisation-wide limit: surface it, never rotate keys to bypass it.
- 401/403 means that credential is bad: try the next key, then degrade explicitly.
- No LLM call ever replaces embedding + cosine similarity; this only produces structured data.
"""
import hashlib
import json
import logging
from typing import Any

from config import GROQ_BASE_URL, GROQ_FALLBACK_MODELS, GROQ_TIERS, groq_keys

log = logging.getLogger("llm")
_clients: dict[str, Any] = {}
_health: dict[str, Any] = {"checked": False, "ok": False, "detail": "not checked"}
_last_error: str | None = None
_cache: dict[str, dict] = {}
_CACHE_MAX = 400
_tier_model: dict[str, str] = {}


class AIUnavailable(RuntimeError):
    """No LLM call could be made. Callers must degrade, and say so - never fake output."""


class RateLimited(AIUnavailable):
    pass


def _client(key: str):
    if key not in _clients:
        from openai import OpenAI

        _clients[key] = OpenAI(api_key=key, base_url=GROQ_BASE_URL, timeout=60.0, max_retries=0)
    return _clients[key]


def keys() -> list[str]:
    return groq_keys()


def model_for(tier: str = "quality") -> str:
    return _tier_model.get(tier, GROQ_TIERS.get(tier, GROQ_TIERS["quality"])["model"])


def model_name() -> str:
    return f"{model_for('quality')} (quality) / {model_for('fast')} (fast)"


def health(force: bool = False) -> dict[str, Any]:
    """Validate every credential and the model list without exposing secrets."""
    if _health["checked"] and not force:
        return _health
    ks = keys()
    if not ks:
        _health.update(checked=True, ok=False, detail="no GROQ1/GROQ2 in backend/.env")
        return _health
    wanted = {GROQ_TIERS["quality"]["model"], GROQ_TIERS["fast"]["model"]}
    details, available = [], set()
    for i, key in enumerate(ks):
        try:
            ids = {m.id for m in _client(key).models.list().data}
            available |= ids
            missing = wanted - ids
            details.append(f"key{i + 1}: authenticated, {len(ids)} models, "
                           + ("quality+fast available" if not missing else f"missing {sorted(missing)}"))
        except Exception as exc:  # noqa: BLE001
            details.append(f"key{i + 1}: {type(exc).__name__}: {str(exc)[:100]}")
    ok = wanted <= available
    if not ok:
        for tier, cfg in GROQ_TIERS.items():
            if cfg["model"] not in available:
                alt = [m for m in GROQ_FALLBACK_MODELS if m in available]
                if alt:
                    _tier_model[tier] = alt[0]
        ok = all(model_for(t) in available for t in GROQ_TIERS) if available else False
    _health.update(checked=True, ok=ok, detail="; ".join(details))
    return _health


def _key_of(system: str, user: str, tier: str) -> str:
    h = hashlib.sha256(f"{tier}|{system[:200]}|{user}".encode("utf-8"))
    return h.hexdigest()


def clear_cache() -> None:
    _cache.clear()


def chat_json(
    system: str,
    user: str,
    *,
    tier: str = "quality",
    schema: dict | None = None,
    schema_name: str = "result",
    max_tokens: int = 2400,
    temperature: float = 0.0,
    use_cache: bool = True,
) -> dict:
    """One strict-JSON completion. Raises AIUnavailable/RateLimited on failure."""
    global _last_error
    ck = _key_of(system, user, tier)
    if use_cache and ck in _cache:
        return _cache[ck]
    ks = keys()
    if not ks:
        raise AIUnavailable("no Groq key configured")
    effort = GROQ_TIERS.get(tier, GROQ_TIERS["quality"])["reasoning_effort"]
    last: Exception | None = None
    for idx, key in enumerate(ks):
        payload: dict[str, Any] = {
            "model": model_for(tier),
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            }
        else:
            payload["response_format"] = {"type": "json_object"}
        try:
            try:
                resp = _client(key).chat.completions.create(**payload, reasoning_effort=effort)
            except Exception as exc:  # noqa: BLE001
                msg = f"{type(exc).__name__}: {exc}"
                if "reasoning_effort" in msg:
                    resp = _client(key).chat.completions.create(**payload)
                else:
                    raise
            raw = resp.choices[0].message.content or ""
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise json.JSONDecodeError("not an object", raw[:80], 0)
            if len(_cache) > _CACHE_MAX:
                _cache.clear()
            if use_cache:
                _cache[ck] = data
            return data
        except json.JSONDecodeError as exc:
            last = exc
            log.warning("llm(%s): invalid JSON from key%d", tier, idx + 1)
            continue
        except Exception as exc:  # noqa: BLE001
            text = f"{type(exc).__name__}: {exc}"
            if "429" in text or "rate_limit" in text.lower():
                _last_error = f"rate limited (organisation-wide): {text[:140]}"
                raise RateLimited(_last_error) from exc
            if "model_not_found" in text or "does not support" in text.lower():
                alt = [m for m in GROQ_FALLBACK_MODELS if m != model_for(tier)]
                if alt:
                    _tier_model[tier] = alt[0]
                    log.warning("llm: %s unavailable, tier %s -> %s", payload["model"], tier, alt[0])
                    last = exc
                    continue
            if "401" in text or "403" in text or "invalid_api_key" in text.lower():
                log.warning("llm: key%d rejected", idx + 1)
                last = exc
                continue
            _last_error = text[:200]
            raise AIUnavailable(_last_error) from exc
    _last_error = str(last)[:200] if last else "unknown"
    raise AIUnavailable(_last_error)


def status() -> dict[str, Any]:
    h = health()
    return {"ai_mode": "groq" if h.get("ok") else "degraded",
            "model": model_name(), "last_error": _last_error, "detail": h.get("detail")}
