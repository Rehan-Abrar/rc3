"""Walk the mandatory demo journey against the running API, printing PASS/FAIL per step.

Usage:  python demo_preflight.py
        BASE=http://host/api python demo_preflight.py

It mutates demo data (shortlist, note, questions, interviews, decision), so run
`python seed.py --reset` afterwards if you want a clean demo start.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta

BASE = os.environ.get("BASE", "http://127.0.0.1:8000/api")
RECRUITER = ("recruiter@hire.dev", "demo1234")
CANDIDATE = ("candidate@hire.dev", "demo1234")

PASSED = 0
FAILED = 0


def call(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read() or b"{}")
        except json.JSONDecodeError:
            return exc.code, {}


def check(label, ok, detail=""):
    global PASSED, FAILED
    if ok:
        PASSED += 1
        mark = "PASS"
    else:
        FAILED += 1
        mark = "FAIL"
    suffix = "  [" + str(detail) + "]" if detail else ""
    print("  " + mark + "  " + label + suffix)


def main():
    print("1. auth + health")
    status, health = call("GET", "/health")
    check("health ok", status == 200 and health.get("status") == "ok",
          "ai_mode=" + str(health.get("ai_mode")) + " embedding=" + str(health.get("embedding_mode")))
    status, auth = call("POST", "/auth/login", {"email": RECRUITER[0], "password": RECRUITER[1]})
    check("recruiter login", status == 200 and bool(auth.get("token")), "status=" + str(status))
    token = auth.get("token")
    if not token:
        print("cannot continue without a recruiter token")
        return 1

    print("2. job + ranked applicants")
    status, jobs = call("GET", "/jobs", token=token)
    job = next((j for j in jobs if "Backend" in j["title"]), jobs[0] if jobs else None)
    check("seeded job visible", bool(job), job["title"] if job else "none")
    if not job:
        return 1
    job_id = job["id"]
    status, rows = call("GET", "/jobs/" + str(job_id) + "/applicants", token=token)
    check("at least three applicants", len(rows) >= 3, str(len(rows)) + " rows")
    names = [r["candidate"]["name"] for r in rows]
    check("demo names present", all(n in names for n in ("Ayesha Khan", "Bilal Ahmed")),
          ", ".join(names[:4]))
    overalls = [(r.get("score") or {}).get("overall", 0) for r in rows]
    check("ranked by score", overalls == sorted(overalls, reverse=True), str(overalls))
    top = rows[0]
    check("top candidate matched skills", bool(top["matched"]), ", ".join(top["matched"][:3]))

    print("3. assessment honesty")
    status, detail = call("GET", "/applications/" + str(top["application_id"]), token=token)
    assessment = detail.get("assessment") or {}
    check("ai_mode reported", assessment.get("ai_mode") in ("groq", "degraded", "heuristic"),
          assessment.get("ai_mode"))
    dims = ("skills", "experience", "projects", "qualifications")
    check("score dimensions present", all(d in assessment for d in dims),
          str(assessment.get("overall")) + " / " + str(assessment.get("confidence")))
    skills_detail = assessment.get("skills_detail") or []
    quoted = [r for r in skills_detail if isinstance(r.get("evidence"), dict)]
    check("evidence quotes attached", bool(quoted), str(len(quoted)) + " quoted requirements")

    clean = top["stage"] in ("submitted", "parsed", "assessed")
    print("4. shortlist + private note")
    if not clean:
        print("  SKIP  top applicant is already '" + top["stage"] + "' - run `python seed.py --reset`")
    app_id = top["application_id"]
    if clean:
        status, _ = call("PATCH", "/applications/" + str(app_id) + "/stage",
                         {"to_stage": "shortlisted", "reason": "preflight"}, token=token)
        check("stage -> shortlisted", status in (200, 201), "status=" + str(status))
    status, _ = call("POST", "/applications/" + str(app_id) + "/notes", 
                     {"body": "Preflight note: strong Docker and REST evidence."}, token=token)
    check("recruiter note saved", status in (200, 201), "status=" + str(status))

    print("5. interview questions")
    question_payload = []
    status, question_payload = call("POST", "/applications/" + str(app_id) + "/questions/generate",
                                    {"per_difficulty": 1}, token=token)
    questions = question_payload if isinstance(question_payload, list) else question_payload.get("questions")
    check("questions generated", bool(questions), str(len(questions or [])) + " questions")
    if questions:
        check("question cites resume evidence",
              any(q.get("source") or q.get("guideline") for q in questions),
              str(questions[0].get("source") or questions[0].get("guideline") or "")[:52])

    print("6. schedule + conflict")
    status, me = call("GET", "/auth/me", token=token)
    start = (datetime.now() + timedelta(days=2)).replace(minute=0, second=0, microsecond=0)
    body = {"application_id": app_id, "duration_min": 60, "interview_type": "technical",
            "interviewer_id": me.get("id"),
            "scheduled_at": start.strftime("%Y-%m-%dT%H:%M:%S")}
    if not clean:
        print("  SKIP  scheduling skipped (data already advanced)")
    status, interview = (call("POST", "/interviews", body, token=token) if clean else (0, {}))
    if clean:
        check("interview scheduled", status in (200, 201), "status=" + str(status))
    overlap = dict(body, scheduled_at=(start + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S"))
    if clean:
        status, conflict = call("POST", "/interviews", overlap, token=token)
        check("overlap returns 409", status == 409, "status=" + str(status))
        conflict_detail = conflict.get("detail")
        check("conflict names the clashing interview",
              isinstance(conflict_detail, dict) and "conflict_with" in conflict_detail,
              str(conflict_detail)[:70])

    print("7. feedback + decision")
    interview_id = interview.get("id")
    if interview_id:
        status, _ = call("POST", "/interviews/" + str(interview_id) + "/feedback",
                         {"rating": 4, "strengths": "clear evidence",
                          "concerns": "none", "recommendation": "strong_yes"}, token=token)
        check("feedback recorded", status in (200, 201), "status=" + str(status))
        status, decision = call("POST", "/interviews/" + str(interview_id) + "/decision",
                                {"decision": "selected", "rationale": "preflight"}, token=token)
        check("decision -> selected",
              status in (200, 201) and decision.get("decision") == "selected",
              "stage=" + str(decision.get("stage")))

    print("8. analytics")
    status, overview = call("GET", "/analytics/overview", token=token)
    check("analytics responds", status == 200, "applications=" + str(overview.get("applications")))
    check("shortlisted counted", (overview.get("shortlisted") or 0) >= 1, str(overview.get("shortlisted")))
    check("interviews counted", (overview.get("interviews") or 0) >= 1, str(overview.get("interviews")))
    check("shortlist rate numeric", isinstance(overview.get("shortlist_rate"), (int, float)),
          str(overview.get("shortlist_rate")))
    check("common gaps listed", isinstance(overview.get("common_gaps"), list),
          str(len(overview.get("common_gaps") or [])))

    print("9. talent intelligence + fairness")
    status, fairness = call("GET", "/audit/fairness", token=token)
    check("fairness audit passes", fairness.get("passed") is True, "delta=" + str(fairness.get("delta")))
    status, search = call("GET", "/talent/search?q=python%20developer%20with%20REST%20API", token=token)
    check("talent search returns hits", bool(search.get("hits")),
          str(len(search.get("hits") or [])) + " hits, mode=" + str(search.get("mode")))
    status, duplicates = call("GET", "/talent/duplicates", token=token)
    check("duplicates endpoint", status == 200 and isinstance(duplicates, list),
          str(len(duplicates or [])) + " pairs")

    print("10. real CVs (PDF + DOCX) and document viewing")
    status, jobs2 = call("GET", "/jobs", token=token)
    product = next((j for j in jobs2 if "Product Engineer" in j["title"]), None)
    check("second job seeded", bool(product), product["title"] if product else "missing")
    if product:
        status, real_rows = call("GET", "/jobs/" + str(product["id"]) + "/applicants", token=token)
        names = [r["candidate"]["name"] for r in real_rows]
        check("three real-CV applicants", len(real_rows) == 3, ", ".join(names))
        check("PDF and DOCX both parsed",
              any(r["resume_filename"].endswith(".pdf") for r in real_rows)
              and any(r["resume_filename"].endswith(".docx") for r in real_rows),
              ", ".join(r["resume_filename"] for r in real_rows))
        # A genuinely unrelated CV can come back degraded even though the model ran: the
        # honest label, not a failure. What must never happen is an unlabelled number.
        modes = [(r["score"] or {}).get("ai_mode") for r in real_rows]
        check("real CVs scored and honestly labelled",
              all(mode in ("groq", "degraded") for mode in modes)
              and any(mode == "groq" for mode in modes),
              str(list(zip([(r["score"] or {}).get("overall") for r in real_rows], modes))))
        viewed = 0
        for row in real_rows:
            status, _unused = (0, None)
            url = BASE + "/resumes/" + str(row["resume_id"]) + "/file?token=" + token
            try:
                with urllib.request.urlopen(url, timeout=60) as resp:
                    blob = resp.read()
                    if resp.status == 200 and len(blob) > 5000:
                        viewed += 1
            except urllib.error.HTTPError:
                pass
        check("every original CV downloads", viewed == len(real_rows),
              str(viewed) + "/" + str(len(real_rows)) + " files")

    print("11. candidate view hides private notes")
    status, candidate_auth = call("POST", "/auth/login",
                                  {"email": CANDIDATE[0], "password": CANDIDATE[1]})
    candidate_token = candidate_auth.get("token")
    check("candidate login", bool(candidate_token), "status=" + str(status))
    if candidate_token:
        status, mine = call("GET", "/applications/mine", token=candidate_token)
        check("candidate sees own applications", status == 200 and len(mine) >= 1,
              str(len(mine)) + " applications")
        if mine:
            status, own = call("GET", "/applications/" + str(mine[0]["id"]), token=candidate_token)
            notes = json.dumps(own.get("notes") or [])
            check("candidate cannot read recruiter notes", "Preflight" not in notes, "notes hidden")
        status, recommended = call("GET", "/candidates/jobs/recommended", token=candidate_token)
        check("recommendations for candidate", status == 200, "status=" + str(status))
        status, forbidden = call("GET", "/jobs/" + str(job_id) + "/applicants",
                                 token=candidate_token)
        check("candidate blocked from recruiter route", status == 403, "status=" + str(status))

    print(str(PASSED) + " passed, " + str(FAILED) + " failed")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
