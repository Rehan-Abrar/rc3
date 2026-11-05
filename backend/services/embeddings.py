"""Embedding providers. NEVER mislabel the fallback: lexical != semantic."""
import json
import math
import re

import numpy as np

from config import EMBED_MODEL

_STATE: dict[str, object] = {"mode": None, "model": None, "vec": None}


def _load_dense():
    if _STATE["mode"] is not None:
        return
    try:
        from model2vec import StaticModel

        _STATE["model"] = StaticModel.from_pretrained(EMBED_MODEL)
        _STATE["mode"] = "dense"
    except Exception:
        _STATE["mode"] = "lexical"
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer

            _STATE["vec"] = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)
        except Exception:
            _STATE["vec"] = None


def mode() -> str:
    _load_dense()
    return _STATE["mode"]  # type: ignore[return-value]


def _norm(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n else v


def encode(texts: list[str]) -> list[list[float]]:
    _load_dense()
    texts = [t or "" for t in texts]
    if _STATE["mode"] == "dense":
        vecs = _STATE["model"].encode(texts)  # type: ignore[union-attr]
        return [_norm(np.asarray(v, dtype=float)).tolist() for v in vecs]
    vec = _STATE["vec"]
    if vec is None:
        # last-resort hashing bag of words (still real, but not semantic)
        out = []
        for t in texts:
            v = np.zeros(256)
            for tok in re.findall(r"[a-z0-9]+", t.lower()):
                v[hash(tok) % 256] += 1.0
            out.append(_norm(v).tolist())
        return out
    try:
        mat = vec.fit_transform(texts).toarray()  # type: ignore[union-attr]
        return [_norm(np.asarray(row, dtype=float)).tolist() for row in mat]
    except Exception:
        return [[1.0, 0.0] for _ in texts]


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if not na or not nb:
        return 0.0
    return max(-1.0, min(1.0, dot / (na * nb)))


def to_json(v: list[float]) -> str:
    return json.dumps([round(float(x), 6) for x in v])


def from_json(s: str | None) -> list[float] | None:
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None
