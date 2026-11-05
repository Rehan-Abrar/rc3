"""Exercise every API endpoint and report PASS/FAIL, so feature checks are evidence, not vibes.

Usage:  python feature_sweep.py
        BASE=http://127.0.0.1:8000/api python feature_sweep.py

Creates throwaway 'SWEEP' data. Run `python seed.py --reset` afterwards to clean up.
"""
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

BASE = os.environ.get("BASE", "http://127.0.0.1:8000/api")
CV_DIR = Path(__file__).resolve().parent.parent / "CVs"
STAMP = str(random.randint(1000, 9999))

results: list[tuple[str, bool, str]] = []
server_errors: list[str] = []


def call(method, path, body=None, token=None, expect=None, raw=None, ctype=None,
         timeout=240):
    url = BASE + path
    payload = None
    headers = {}
    if raw is not None:
        payload = raw
        headers["Content-Type"] = ctype or "application/octet-stream"
    elif body is not None:
        payload = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=payload, method=method, headers=headers)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status, data = resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        status, data = exc.code, exc.read()
    except Exception as exc:  # noqa: BLE001
        status, data = 0, str(exc).encode()
    took = round((time.time() - started) * 1000)
    parsed = None
    if data:
        try:
            parsed = json.loads(data)
        except (json.JSONDecodeError, UnicodeDecodeError):
            parsed = {"_bytes": len(data)}
    return status, parsed, took


def check(label, method, path, expect=200, **kwargs):
    status, data, took = call(method, path, **kwargs)
    ok = status in (expect if isinstance(expect, (tuple, list)) else (expect,))
    if status >= 500:
        server_errors.append(f"{method} {path} -> {status} {str(data)[:200]}")
    note = f"{status} in {took}ms"
    if not ok:
        note += f" | {str(data)[:200]}"
    results.append((label, ok, note))
    print(("  PASS  " if ok else "  FAIL  ") + label + "  [" + note + "]")
    return data


def upload(path, token, filename, expect=201, blob=None):
    blob = Path(path).read_bytes() if blob is None else blob
    boundary = "----sweep" + STAMP
    body = (
        ("--" + boundary + "\r\n").encode()
        + ("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n").encode()
        + b"Content-Type: application/octet-stream\r\n\r\n"
        + blob
        + ("\r\n--" + boundary + "--\r\n").encode()
    )
    status, data, took = call("POST", "/resumes", raw=body, ctype="multipart/form-data; boundary=" + boundary,
                              token=token)
    ok = status in (expect if isinstance(expect, (tuple, list)) else (expect,))
    note = f"{status} in {took}ms"
    if not ok:
        note += " | " + str(data)[:160]
    results.append(("upload " + filename, ok, note))
    print(("  PASS  " if ok else "  FAIL  ") + "upload " + filename + "  [" + note + "]")
    return status, data


def section(title):
    print("\n" + title)


def main():
    section("health")
    health = check("GET /health", "GET", "/health")
    if not isinstance(health, dict) or health.get("status") != "ok":
        print("backend is not healthy; stopping")
        return 1

    section("auth")
    rec_email = "sweep.rec." + STAMP + "@test.dev"
    cand_email = "sweep.cand." + STAMP + "@test.dev"
    rec = check("register recruiter", "POST", "/auth/register", 201,
                body={"email": rec_email, "password": "SweepPass123", "full_name": "Sweep Recruiter", "role": "recruiter"})
    cand = check("register candidate", "POST", "/auth/register", 201,
                 body={"email": cand_email, "password": "SweepPass123", "full_name": "Sweep Candidate", "role": "candidate"})
    check("duplicate email rejected", "POST", "/auth/register", 409,
          body={"email": rec_email, "password": "SweepPass123", "full_name": "Dup", "role": "recruiter"})
    check("wrong password rejected", "POST", "/auth/login", 401,
          body={"email": rec_email, "password": "nope"})
    login = check("login", "POST", "/auth/login", 200, body={"email": rec_email, "password": "SweepPass123"})
    rt = (login or {}).get("token")
    cl = check("candidate login", "POST", "/auth/login", 200, body={"email": cand_email, "password": "SweepPass123"})
    ct = (cl or {}).get("token")
    check("GET /auth/me", "GET", "/auth/me", 200, token=rt)
    check("anon rejected", "GET", "/auth/me", 401)
    check("role guard candidate->recruiter route", "GET", "/analytics/overview", 403, token=ct)

    section("jobs")
    job = check("create job", "POST", "/jobs", 201, token=rt, body={
        "title": "Sweep Engineer " + STAMP, "description": "Python, Docker and REST APIs.",
        "location": "Lahore, PK", "employment_type": "full_time",
        "requirements": [{"label": "Python", "importance": "required", "min_years": 2},
                         {"label": "Docker", "importance": "required"}]})
    jid = job["id"]
    check("list jobs", "GET", "/jobs", 200, token=rt)
    check("get job", "GET", "/jobs/" + str(jid), 200, token=rt)
    check("update job", "PATCH", "/jobs/" + str(jid), 200, token=rt,
          body={"title": "Sweep Engineer " + STAMP + " II"})
    check("salary validation", "POST", "/jobs", 422, token=rt,
          body={"title": "Bad", "description": "x", "salary_min": 900000, "salary_max": 1})
    check("extract requirements (AI)", "POST", "/jobs/extract-requirements", 200, token=rt,
          body={"title": "Backend Engineer",
                "description": "We need Python, PostgreSQL, Docker and REST API experience."})
    check("talent pool", "GET", "/jobs/" + str(jid) + "/talent-pool", 200, token=rt)
    check("close job", "POST", "/jobs/" + str(jid) + "/close", 200, token=rt)
    check("reopen job", "POST", "/jobs/" + str(jid) + "/reopen", 200, token=rt)

    section("resumes")
    pdf_cv = CV_DIR / "Rehan_Abrar_CV.pdf"
    docx_cv = CV_DIR / "Ubaid_Ur_Rehmaan_CV.docx"
    _, up_pdf = upload(pdf_cv, ct, "SWEEP_resume.pdf")
    upload(pdf_cv, ct, "SWEEP_resume.txt", expect=415)
    upload(pdf_cv, ct, "SWEEP_empty.pdf", expect=400, blob=b"")
    rid = up_pdf["resume"]["id"] if isinstance(up_pdf, dict) else 0
    check("list my resumes", "GET", "/resumes/mine", 200, token=ct)
    check("get resume", "GET", "/resumes/" + str(rid), 200, token=rt)
    check("resume file streams", "GET", "/resumes/" + str(rid) + "/file?token=" + str(rt), 200)
    check("patch skills", "PATCH", "/resumes/" + str(rid) + "/skills", 200, token=ct,
          body={"skills": ["Python", "Docker", "Kubernetes"]})
    _, up_docx = upload(docx_cv, ct, "SWEEP_resume.docx")
    docx_ok = isinstance(up_docx, dict) and (up_docx.get("resume") or {}).get("parse_status") == "ok"
    results.append(("DOCX parsed", docx_ok, str((up_docx or {}).get("resume", {}).get("parse_status"))))
    print(("  PASS  " if docx_ok else "  FAIL  ") + "DOCX parsed")

    section("applications")
    app = check("apply", "POST", "/applications", 201, token=ct, body={"job_id": jid, "resume_id": rid})
    app_id = app["id"]
    check("duplicate application rejected", "POST", "/applications", 409, token=ct,
          body={"job_id": jid, "resume_id": rid})
    check("my applications", "GET", "/applications/mine", 200, token=ct)
    detail = check("application detail", "GET", "/applications/" + str(app_id), 200, token=rt)
    check("applicants for job", "GET", "/jobs/" + str(jid) + "/applicants", 200, token=rt)
    own = check("candidate sees own application", "GET", "/applications/" + str(app_id), 200, token=ct)
    check("get assessment", "GET", "/applications/" + str(app_id) + "/assessment", 200, token=rt)
    check("assess (cached)", "POST", "/applications/" + str(app_id) + "/assess", 200, token=rt)
    check("override score", "POST", "/applications/" + str(app_id) + "/override", 200, token=rt,
          body={"score": 77, "reason": "sweep override"})
    check("invalid stage transition", "PATCH", "/applications/" + str(app_id) + "/stage", 400, token=rt,
          body={"to_stage": "selected"})
    check("stage -> shortlisted", "PATCH", "/applications/" + str(app_id) + "/stage", 200, token=rt,
          body={"to_stage": "shortlisted", "reason": "sweep"})
    check("private note", "POST", "/applications/" + str(app_id) + "/notes", 201, token=rt,
           body={"body": "Sweep private note"})
    cand_detail = check("candidate detail still works", "GET", "/applications/" + str(app_id), 200, token=ct)
    hidden = "Sweep private note" not in json.dumps((cand_detail or {}).get("notes") or [])
    results.append(("candidate cannot see recruiter notes", hidden, "notes hidden" if hidden else "LEAKED"))
    print(("  PASS  " if hidden else "  FAIL  ") + "candidate cannot see recruiter notes")

    section("questions")
    qs = check("generate questions", "POST", "/applications/" + str(app_id) + "/questions/generate", 201,
               token=rt, body={"per_difficulty": 1})
    qlist = qs if isinstance(qs, list) else (qs or {}).get("questions") or []
    results.append(("questions returned", bool(qlist), str(len(qlist)) + " questions"))
    print(("  PASS  " if qlist else "  FAIL  ") + "questions returned")
    check("list questions", "GET", "/applications/" + str(app_id) + "/questions", 200, token=rt)
    if qlist:
        qid = qlist[0]["id"]
        check("patch question", "PATCH", "/questions/" + str(qid), 200, token=rt,
              body={"text": qlist[0]["text"] + " (edited)"})
        fresh = check("regenerate question", "POST",
                      "/applications/" + str(app_id) + "/questions/regenerate/" + str(qid), 201, token=rt)
        new_ids = [q["id"] for q in (fresh or []) if isinstance(q, dict)]
        if new_ids:
            check("delete question", "DELETE", "/questions/" + str(new_ids[0]), (200, 204), token=rt)

    section("interviews")
    me = check("interviewer identity", "GET", "/auth/me", 200, token=rt)
    start = (datetime.now() + timedelta(days=3)).replace(minute=0, second=0, microsecond=0)
    body = {"application_id": app_id, "interviewer_id": (me or {}).get("id"),
            "scheduled_at": start.strftime("%Y-%m-%dT%H:%M:%S"), "duration_min": 60,
            "interview_type": "technical", "location": "Google Meet"}
    iv = check("schedule interview", "POST", "/interviews", 201, token=rt, body=body)
    check("list interviews", "GET", "/interviews", 200, token=rt)
    clash = dict(body, scheduled_at=(start + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S"))
    check("conflict blocked with 409", "POST", "/interviews", 409, token=rt, body=clash)
    iv_id = (iv or {}).get("id")
    if iv_id:
        check("record feedback", "POST", "/interviews/" + str(iv_id) + "/feedback", 201, token=rt,
              body={"rating": 4, "strengths": "strong evidence", "concerns": "none",
                    "recommendation": "strong_yes"})
        check("read feedback", "GET", "/interviews/" + str(iv_id) + "/feedback", 200, token=rt)
        check("feedback validation", "POST", "/interviews/" + str(iv_id) + "/feedback", 422, token=rt,
              body={"rating": 99})
        check("final decision", "POST", "/interviews/" + str(iv_id) + "/decision", 201, token=rt,
              body={"decision": "selected", "rationale": "sweep"})

    section("analytics + talent")
    check("analytics overview", "GET", "/analytics/overview", 200, token=rt)
    check("talent search", "GET", "/talent/search?q=python%20docker", 200, token=rt)
    check("talent compare", "GET", "/talent/compare?ids=" + str(app_id), 200, token=rt)
    check("talent duplicates", "GET", "/talent/duplicates", 200, token=rt)
    check("recommended jobs (candidate)", "GET", "/candidates/jobs/recommended", 200, token=ct)
    audit = check("fairness audit", "GET", "/audit/fairness", 200, token=rt)
    if isinstance(audit, dict):
        fair_ok = (audit.get("delta") == 0 and audit.get("passed") is True
                   and audit.get("candidate") and audit.get("job")
                   and all(c.get("identical") for c in audit.get("checks") or []))
        results.append(("fairness audit is self-describing and stable", fair_ok,
                        f"baseline {audit.get('baseline')} delta {audit.get('delta')}"))
        print(("  PASS  " if fair_ok else "  FAIL  ")
              + f"fairness audit is self-describing and stable  [baseline {audit.get('baseline')}]")
    check("audit merge alias requires ids", "POST", "/audit/merge", 422, token=rt, body={})

    print("\n" + "=" * 68)
    passed = sum(1 for _l, ok, _n in results if ok)
    failed = [(l, n) for l, ok, n in results if not ok]
    print(str(passed) + " passed, " + str(len(failed)) + " failed, " + str(len(results)) + " checks")
    for label, note in failed:
        print("  FAILED: " + label + "  [" + note + "]")
    if server_errors:
        print("\nSERVER ERRORS (5xx):")
        for err in server_errors:
            print("  " + err)
    return 0 if not failed and not server_errors else 1


if __name__ == "__main__":
    sys.exit(main())
