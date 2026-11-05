"""Recruitment & Talent Intelligence Platform - FastAPI entrypoint."""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import CORS_ORIGINS, DATABASE_URL
from db import Base, engine, ensure_columns
from routers import (analytics, applications, auth, interviews, jobs, questions,
                      resumes, scoring, talent)
from services import embeddings, llm

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Recruitment & Talent Intelligence Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
ensure_columns()

API = "/api"
for r in (auth.router, jobs.router, resumes.router, applications.router,
          questions.router, interviews.router, analytics.router, scoring.router, talent.router):
    app.include_router(r, prefix=API)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health():
    h = llm.health()
    db_ok = "ok"
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("select 1")
    except Exception as exc:  # noqa: BLE001
        db_ok = f"error: {type(exc).__name__}"
    return {"status": "ok" if db_ok == "ok" else "degraded",
            "ai_mode": "groq" if h.get("ok") else "degraded",
            "embedding_mode": embeddings.mode(),
            "db": f"sqlite {DATABASE_URL.split('///')[-1]} ({db_ok})",
            "model": llm.model_name(),
            "ai_detail": h.get("detail"),
            "last_error": llm._last_error}


@app.get("/")
def root():
    return {"name": "Recruitment & Talent Intelligence Platform", "docs": "/docs",
            "api": API}
