"""Idempotent demo dataset: 1 recruiter, 3 candidates, real PDFs, 1 job, assessments.

Run:  python seed.py --reset
"""
import argparse
import json
import sys
from datetime import datetime, timedelta

import fitz

import models as m
from config import DATA_DIR
from db import Base, SessionLocal, engine
from security import hash_password
from services import assess as assess_svc
from services import extract, pdf, skills

# Emails/passwords match the frontend's demo buttons (DEMO_PASSWORD = demo1234),
# so one click on the login page signs you into the seeded demo account.
RECRUITER = ("recruiter@hire.dev", "demo1234", "Rehan Abrar")
CANDIDATES = [
    ("candidate@hire.dev", "demo1234", "Ayesha Khan", "strong"),
    ("bilal@rc3.dev", "CandidatePass123", "Bilal Ahmed", "partial"),
    ("sana@rc3.dev", "CandidatePass123", "Sana Iqbal", "adjacent"),
]

RESUMES = {
    "strong": """Ayesha Khan
ayesha.khan@example.com | +92 300 1234567 | github.com/ayeshak

SUMMARY
Backend engineer with 4 years building production web services and APIs.

EDUCATION
BS Computer Science, University of Engineering and Technology, Lahore, 2019

EXPERIENCE
Backend Engineer, Nordvale Systems, 2021 - 2025
Built and maintained Django REST services in Python for 4 years at Nordvale Systems.
Designed PostgreSQL schemas and optimised slow queries, cutting p95 latency from 900ms to 180ms.
Containerised all services with Docker and GitHub Actions pipelines.
Owned the public REST API used by three partner integrations.

PROJECTS
Recruitment analytics dashboard - FastAPI and PostgreSQL service that ranks applicants.
Migrated a monolith to Django services with zero-downtime database migrations.

SKILLS
Python, Django, PostgreSQL, Docker, REST APIs, Git, pytest
""",
    "partial": """Bilal Ahmed
bilal.ahmed@example.com | +92 321 5550199

SUMMARY
Software engineer focused on Python data services, two years of experience.

EDUCATION
BS Software Engineering, FAST NUCES, Lahore, 2022

EXPERIENCE
Junior Developer, Lumen Data, 2022 - 2024
Wrote Python scripts and Flask endpoints for internal reporting.
Queried PostgreSQL for nightly reporting jobs and built dashboards for the ops team.

PROJECTS
Inventory tracker - Flask app storing records in PostgreSQL, deployed with a shell script.
Log parser - Python tool that summarised nginx logs.

SKILLS
Python, Flask, PostgreSQL, Git, Linux
""",
    "adjacent": """Sana Iqbal
sana.iqbal@example.com | +92 333 7770011

SUMMARY
Frontend developer moving into backend work, strong JavaScript background.

EDUCATION
BS Information Technology, Punjab University, 2021

EXPERIENCE
Frontend Developer, Orbit Studio, 2021 - 2025
Built React dashboards consuming REST APIs and documented endpoint contracts with backend teams.
Set up Docker Compose for local development of the frontend stack.

PROJECTS
Design system library - React component package used by three products.

SKILLS
JavaScript, React, TypeScript, Git, Docker
""",
}


def make_pdf(kind: str, text: str) -> str:
    path = DATA_DIR / "resumes" / f"{kind}.pdf"
    doc = fitz.open()
    page = doc.new_page()
    rect = fitz.Rect(56, 56, 540, 780)
    page.insert_textbox(rect, text, fontsize=10.5, fontname="helv")
    doc.save(path)
    doc.close()
    return path.name


def get_or_create_user(db, email, password, name, role):
    u = db.query(m.User).filter_by(email=email).one_or_none()
    if u:
        return u
    u = m.User(email=email, password_hash=hash_password(password), full_name=name, role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def build_job(db, recruiter):
    job = db.query(m.Job).filter_by(title="Backend Developer").one_or_none()
    if job:
        return job
    job = m.Job(
        recruiter_id=recruiter.id, title="Backend Developer", department="Engineering",
        location="Lahore, PK", employment_type="full_time", salary_min=150000,
        salary_max=250000, status="open",
        description=("We are hiring a Backend Developer to build and scale our APIs. "
                     "Must have strong Python and Django experience, PostgreSQL, and Docker, "
                     "with at least 3 years of professional backend work. "
                     "Experience with REST API design and CI/CD is preferred. "
                     "Bachelor's degree in Computer Science required."))
    db.add(job)
    db.commit()
    db.refresh(job)
    reqs = [("Python", "skill", "required", 1.0, 3), ("Django", "skill", "required", 1.0, None),
            ("PostgreSQL", "skill", "required", 1.0, None), ("Docker", "skill", "required", 1.0, None),
            ("REST API", "skill", "preferred", 0.4, None),
            ("BS Computer Science", "qualification", "required", 1.0, None)]
    for label, kind, imp, weight, years in reqs:
        db.add(m.JobRequirement(job_id=job.id, kind=kind, label=label,
                                canonical=skills.canonical(label), importance=imp,
                                weight=weight, min_years=years,
                                evidence_hint="backend services" if label == "Python" else None))
    db.commit()
    db.refresh(job)
    return job


def main(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        rec = get_or_create_user(db, *RECRUITER, role="recruiter")
        job = build_job(db, rec)
        for email, pwd, name, kind in CANDIDATES:
            cand = get_or_create_user(db, email, pwd, name, role="candidate")
            if db.query(m.Resume).filter_by(candidate_id=cand.id).first():
                continue
            filename = make_pdf(kind, RESUMES[kind])
            path = DATA_DIR / "resumes" / filename
            raw, pages = pdf.extract_text(path)
            status, err = pdf.classify(raw)
            profile, mode = extract.extract(raw) if status == "ok" else (None, "heuristic")
            r = m.Resume(candidate_id=cand.id, filename=filename, size_bytes=path.stat().st_size,
                         page_count=pages, raw_text=raw, parse_status=status, parse_error=err,
                         extracted_json=extract.dumps(profile) if profile else None)
            db.add(r)
            db.add(r)
            db.commit()
            db.refresh(r)
            print(f"  parsed {name}: status={status} extract={mode} "
                  f"skills={len((profile or {}).get('skills') or [])}")
            if status != "ok":
                continue
            app = m.Application(job_id=job.id, candidate_id=cand.id, resume_id=r.id,
                                stage="submitted")
            db.add(app)
            db.flush()
            db.add(m.StatusEvent(application_id=app.id, actor_id=cand.id, from_stage=None,
                                 to_stage="submitted", reason="Candidate applied"))
            db.commit()
            db.refresh(app)
            a = assess_svc.run_assessment(db, app, cand.id)
            print(f"  assessed {name}: overall={a.overall} skills={a.skills_score} "
                  f"ai={a.ai_mode} confidence={a.confidence}")
        print("seed complete")
        print(f"recruiter: {RECRUITER[0]} / {RECRUITER[1]}")
        for email, pwd, name, _k in CANDIDATES:
            print(f"candidate: {email} / {pwd}")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop and rebuild all tables")
    main(ap.parse_args().reset)
