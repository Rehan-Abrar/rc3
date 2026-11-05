"""Idempotent demo dataset: 1 recruiter, real + synthetic candidates, 2 jobs, assessments.

Run:  python seed.py --reset
"""
import argparse
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import fitz

import models as m
from config import BASE_DIR, DATA_DIR
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

# Real CVs shipped in the repo (../CVs). Seeded onto a second job so the demo shows both a
# synthetic backend pipeline and real PDF/DOCX documents with verifiable quotes.
CV_DIR = Path(BASE_DIR).resolve().parent / "CVs"
REAL_CVS = [
    ("rehan@rc3.dev", "demo1234", "Rehan Abrar", "Rehan_Abrar_CV.pdf"),
    ("ubaid@rc3.dev", "demo1234", "Ubaid Ur Rehmaan Dar", "Ubaid_Ur_Rehmaan_CV.docx"),
    ("mustafa@rc3.dev", "demo1234", "Muhammad Mustafa", "Mustafa_CV.pdf"),
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


def build_product_job(db, recruiter):
    """Second job, tuned to the real CVs in ../CVs (React/TypeScript/UI)."""
    job = db.query(m.Job).filter_by(title="Product Engineer (React + TypeScript)").one_or_none()
    if job:
        return job
    job = m.Job(
        recruiter_id=recruiter.id, title="Product Engineer (React + TypeScript)",
        department="Product Engineering", location="Lahore, PK", employment_type="full_time",
        salary_min=120000, salary_max=220000, status="open",
        description=("We are hiring a Product Engineer to build responsive, accessible product UI. "
                     "You will work in React and TypeScript with Tailwind CSS, consume REST APIs, "
                     "and collaborate with design on Figma handoffs. Experience with Git-based "
                     "collaboration is required; Python and SQL are a plus. "
                     "Bachelor's degree in Computer Science required."))
    db.add(job)
    db.commit()
    db.refresh(job)
    reqs = [("React", "skill", "required", 1.0, None),
            ("TypeScript", "skill", "required", 1.0, None),
            ("Tailwind CSS", "skill", "required", 1.0, None),
            ("REST API", "skill", "required", 1.0, None),
            ("Git", "skill", "required", 1.0, None),
            ("Figma", "skill", "preferred", 0.4, None),
            ("Python", "skill", "preferred", 0.4, None),
            ("SQL", "skill", "preferred", 0.4, None),
            ("BS Computer Science", "qualification", "required", 1.0, None)]
    for label, kind, imp, weight, years in reqs:
        db.add(m.JobRequirement(job_id=job.id, kind=kind, label=label,
                                canonical=skills.canonical(label), importance=imp,
                                weight=weight, min_years=years,
                                evidence_hint="product UI" if label == "React" else None))
    db.commit()
    db.refresh(job)
    return job


def seed_real_cvs(db, job) -> None:
    """Attach the real PDFs/DOCX from ../CVs to fresh candidate accounts and assess them."""
    for email, pwd, name, cv_name in REAL_CVS:
        source = CV_DIR / cv_name
        if not source.exists():
            print(f"  skip {name}: {source} not found")
            continue
        cand = get_or_create_user(db, email, pwd, name, role="candidate")
        existing = db.query(m.Resume).filter_by(candidate_id=cand.id).first()
        if existing:
            continue
        suffix = source.suffix.lower()
        target_name = f"real_{cand.id}{suffix}"
        target = DATA_DIR / "resumes" / target_name
        (DATA_DIR / "resumes").mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        raw, pages = pdf.extract_any(target)
        status, err = pdf.classify(raw)
        profile, mode = None, "heuristic"
        if status == "ok":
            for _attempt in range(3):  # a transient 429 must not leave demo data in fallback mode
                profile, mode = extract.extract(raw)
                if mode == "groq":
                    break
                time.sleep(4)
        r = m.Resume(candidate_id=cand.id, filename=cv_name, stored_path=target_name,
                     mime="application/pdf" if suffix == ".pdf" else
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     size_bytes=target.stat().st_size, page_count=pages, raw_text=raw,
                     parse_status=status, parse_error=err,
                     extracted_json=extract.dumps(profile) if profile else None)
        db.add(r)
        db.commit()
        db.refresh(r)
        print(f"  parsed {name} ({suffix[1:]}): status={status} extract={mode} "
              f"skills={len((profile or {}).get('skills') or [])}")
        if status != "ok":
            continue
        app = m.Application(job_id=job.id, candidate_id=cand.id, resume_id=r.id, stage="submitted")
        db.add(app)
        db.flush()
        db.add(m.StatusEvent(application_id=app.id, actor_id=cand.id, from_stage=None,
                             to_stage="submitted", reason="Candidate applied"))
        db.commit()
        db.refresh(app)
        a = None
        for _attempt in range(3):
            a = assess_svc.run_assessment(db, app, cand.id)
            if a.ai_mode == "groq":
                break
            time.sleep(4)
        print(f"  assessed {name}: overall={a.overall} skills={a.skills_score} "
              f"ai={a.ai_mode} confidence={a.confidence}")


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
            profile, mode = None, "heuristic"
            if status == "ok":
                for _attempt in range(3):  # a transient 429 must not leave demo data in fallback mode
                    profile, mode = extract.extract(raw)
                    if mode == "groq":
                        break
                    time.sleep(4)
            r = m.Resume(candidate_id=cand.id, filename=filename, stored_path=filename,
                         mime="application/pdf", size_bytes=path.stat().st_size,
                         page_count=pages, raw_text=raw, parse_status=status, parse_error=err,
                         extracted_json=extract.dumps(profile) if profile else None)
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
            a = None
            for _attempt in range(3):
                a = assess_svc.run_assessment(db, app, cand.id)
                if a.ai_mode == "groq":
                    break
                time.sleep(4)
            print(f"  assessed {name}: overall={a.overall} skills={a.skills_score} "
                  f"ai={a.ai_mode} confidence={a.confidence}")
        print("seed complete")
        print(f"recruiter: {RECRUITER[0]} / {RECRUITER[1]}")
        for email, pwd, name, _k in CANDIDATES:
            print(f"candidate: {email} / {pwd}")
        product_job = build_product_job(db, rec)
        seed_real_cvs(db, product_job)
        print(f"jobs: {job.title} (id {job.id}) | {product_job.title} (id {product_job.id})")
        for email, pwd, name, _cv in REAL_CVS:
            print(f"real CV candidate: {email} / {pwd}")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop and rebuild all tables")
    main(ap.parse_args().reset)
