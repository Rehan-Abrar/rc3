# MASTER_PLAN.md — Recruitment & Talent Intelligence Platform

**Single source of truth.** `PROBLEM_STATEMENT.md` is the spec; this file is the plan. Agent plans must stay consistent with it and must not duplicate its prose.

| | |
|---|---|
| Repo | https://github.com/Rehan-Abrar/rc3 |
| Board | issue #1 (pinned) |
| Agent A (Ubaid) | frontend/UX/design — `frontend/src/**` |
| Agent B (Rehan) | architecture, backend, AI, integration, tests — `backend/**`, `contracts/**` |
| Lead architect | Agent B |

---

## 1. Architecture decision record (adr-001..006)

**ADR-001 — Two-root stack: FastAPI + SQLite (backend) and React + Vite + TS + Tailwind (frontend).**
Every required library is already installed on this laptop and verified: `fastapi 0.141`, `uvicorn`, `SQLAlchemy 2.0`, `pymupdf 1.28`, `scikit-learn 1.8`, `numpy 2.4`, `openai 3.8`, `bcrypt 5.0`, `PyJWT 2.8`. No install risk, no ORM/DB server to provision, SQLite is a real persistent store, and PyMuPDF gives genuine PDF text extraction with character offsets. Node 24 + npm 11 are present for Vite. Rejected: Next.js (its route handlers could host the AI calls, but that adds a second runtime and build pipeline over an already-installed FastAPI, and would duplicate the service layer), Django (heavier to a working demo than the already-installed FastAPI), Postgres (no server available, no benefit at this scale).

**ADR-002 — AI provider: Groq (OpenAI-compatible) called server-side only.**
`backend/.env` holds the keys; `.env` is gitignored and keys never reach the browser. Text extraction, requirement extraction, question generation and explanation prose are real LLM calls (strict json_schema, `openai/gpt-oss-120b` quality / `openai/gpt-oss-20b` fast). Every AI response is validated against a schema and rejected on failure. No hardcoded AI output anywhere; a visible `ai_mode` badge shows `groq` or `degraded` so nothing is faked.

**ADR-003 — Semantic layer: dense embeddings when available, deterministic fallback otherwise.**
`backend/services/embeddings.py` exposes one interface with two providers: (a) **model2vec** static embeddings (numpy-only, no torch, works on Python 3.14) if importable, (b) **hybrid lexical vectorizer** (scikit-learn TF-IDF word 1-2 gram + char 3-5 gram cosine) otherwise. Provider is recorded per assessment in `ai_mode` and shown in the UI. Both are real algorithms computed from resume text — no canned results. Dense vectors need no external API, so judging works offline.

**ADR-004 — Scoring: deterministic weighted model over LLM-extracted, quote-linked evidence.**
Skills 50 / Experience 25 / Project relevance 15 / Qualifications 10 (spec's suggested weights, kept). The LLM extracts evidence; arithmetic is pure Python and inspectable. Same input ⇒ same score. No single LLM number is trusted as the score.

**ADR-005 — Auth: bcrypt hashes + HS256 JWT bearer tokens, role guard dependency.**
Passwords hashed with bcrypt (cost 12), never returned by any endpoint. Token in `localStorage`, sent as `Authorization: Bearer`. `require_role("recruiter")` guards every recruiter endpoint; candidate endpoints are scoped to `user.id`. IDOR prevention: every application/job lookup is filtered by ownership, not just by role.

**ADR-006 — No database server, no ORM migrations framework.** SQLAlchemy models + `Base.metadata.create_all` at startup, plus an idempotent `seed.py` for the demo dataset. SQLite file `backend/data/app.db`.

---

## 2. Judging weights → plan priorities

| Criterion | Marks | Where this plan buys the mark |
|---|---|---|
| Architecture & functional completeness | 30 | §4 schema, §5 API, phases 1–3 deliver all of 3.1–3.9 |
| AI implementation & matching quality | 25 | ADR-002/003/004 + §7 evidence-grounded scoring, embeddings, LLM judge with validation |
| Resume parsing & extraction | 15 | §6 PyMuPDF pipeline, offsets, normalization, corrections, failure paths |
| UI & experience | 15 | Agent A: ranked cards with score breakdown + excerpts, pipeline board, analytics |
| Innovation, Testing, Security & Deployment | 15 | §11 tests, §9 security, fairness audit endpoint, README + one-command run |

Rule of thumb used all day: **marks per minute**. Mandatory demo path first (§8), then breadth, then polish.

---

## 3. Requirements traceability matrix

Legend: **P0** = demo-blocking MVP, **P1** = phase-two, **P2** = stretch. Verify = the check that proves it.

| ID | Requirement (spec §) | Pri | Owner | Verify |
|---|---|---|---|---|
| R1 | Recruiter + candidate registration, login, logout (§3.1) | P0 | B / A | register→login→me→logout; wrong password 401 |
| R2 | Role-based dashboards + authorization, candidates blocked from recruiter data (§3.1) | P0 | B / A | candidate token on `/api/recruiter/*` → 403 |
| R3 | Secure passwords, sessions, input validation (§3.1) | P0 | B | bcrypt hash in DB, no password in any response, pydantic 422s |
| R4 | Job create/edit/close/reopen with title, department, location, type, salary, description (§3.2) | P0 | B / A | CRUD round-trip, closed job hidden from candidate list |
| R5 | Required/preferred skills, experience, qualifications, skill importance (§3.2) | P0 | B / A | requirement rows with weight; UI shows required vs preferred |
| R6 | Vacancy list with applicant counts (§3.2) | P0 | B / A | count matches applications |
| R7 | AI extraction of requirements from free-text description (§3.2) | P1 | B | "Extract with AI" fills skill chips from description text |
| R8 | PDF upload (§3.3) | P0 | B / A | upload 3 real PDFs → 201 + parsed text length > 0 |
| R9 | Real parsing: name, contact, skills, education, experience, projects (§3.3) | P0 | B | fields non-empty on demo resumes; text from PyMuPDF not a fixture |
| R10 | Term normalization (JS↔JavaScript), structured storage, candidate corrections (§3.3) | P0 | B / A | canonical skill table + edit endpoint persists |
| R11 | Graceful unsupported/empty/failed documents (§3.3) | P0 | B / A | upload .txt/.png/0-byte PDF → 4xx with readable message |
| R12 | Semantic (not keyword-only) candidate↔job comparison (§3.4) | P0 | B | "REST services"/"web APIs" still matches `REST API` requirement; cosine > 0 |
| R13 | Explainable relevance score: matched skills, gaps, evidence (§3.4) | P0 | B / A | every matched skill carries quote + char offsets |
| R14 | Ranked applicants, manual filters, overrides (§3.4) | P0 | B / A | rank sorted desc; recruiter override stored and shown |
| R15 | Missing evidence vs confirmed absence (§3.5) | P0 | B / A | tri-state `matched`/`not_evidenced`/`confirmed_absent` visible |
| R16 | Resume excerpts + per-recommendation explanation (§3.5) | P0 | B / A | excerpt text equals resume substring at offsets |
| R17 | Learning suggestions + recruiter skill corrections (§3.5) | P1 | B / A | gap card shows suggestion; correction persists |
| R18 | Candidate applies, sees status (§3.6) | P0 | B / A | apply → my applications list with stage |
| R19 | Recruiter shortlist/reject/advance + private notes (§3.6) | P0 | B / A | stage change persists; note recruiter-only |
| R20 | Audit trail of status changes (§3.6) | P0 | B / A | timeline endpoint returns actor, from→to, timestamp |
| R21 | Role-specific questions, difficulty, project questions, answer guidelines (§3.7) | P0 | B / A | generated set has all 3 difficulties + guideline text |
| R22 | Edit / remove / regenerate questions (§3.7) | P1 | B / A | PUT/DELETE/regenerate endpoints + UI |
| R23 | Schedule interview: date, time, interviewer, type; list schedules (§3.8) | P0 | B / A | interview created, appears in list |
| R24 | Conflict detection (§3.8) | P0 | B | overlapping interviewer slot → 409 with the conflicting interview |
| R25 | Structured interviewer feedback + final decision (§3.8) | P1 | B / A | feedback saved, decision recorded by recruiter |
| R26 | Analytics: counts, charts by job/stage, shortlist rate, avg processing time, common gaps (§3.9) | P0 | B / A | dashboard numbers equal DB truth; chart renders |
| R27 | Natural-language talent search with evidence (§3.10) | P1 | B / A | "python developer with REST API experience" returns ranked people + snippets |
| R28 | Embedding-based semantic resume search (§3.10) | P1 | B | vector index query returns a candidate whose wording differs from query |
| R29 | Duplicate detection with human confirmation before merge (§3.10) | P2 | B | same email/phone flagged; merge requires explicit POST |
| R30 | Resume-to-job recommendations for candidates (§3.10) | P2 | B | candidate sees recommended open jobs with reasons |
| R31 | Talent pool discovery for a new job (§3.10) | P2 | B | existing pool scored against new job |
| R32 | Candidate comparison side-by-side (§3.10) | P1 | B / A | compare 2–3 ids → aligned evidence + gaps |
| R33 | Fairness: protected attributes excluded; attribute-swap audit (§3.10) | P1 | B | audit test: changing name/gender/age leaves score unchanged |
| R34 | Hallucination safeguard: claims linked to excerpts, unsupported flagged (§3.10) | P0 | B / A | unverifiable claim → `flagged_unverified`, shown in UI |
| R35 | Human final control; no auto-reject (§3) | P0 | B / A | no automation writes `rejected`; only recruiter actions do |
| R36 | Clean, readable code; run instructions; deployable (§ rubric) | P0 | B | README, single-command run, no leftover dead code |

---

## 4. Data model (SQLite, SQLAlchemy)

```
users(id, email UNIQUE, password_hash, full_name, role[recruiter|candidate], created_at)
jobs(id, recruiter_id→users, title, department, location, employment_type, salary_min, salary_max,
     description, status[open|closed], created_at, updated_at)
job_requirements(id, job_id, kind[skill|qualification], label, canonical, importance[required|preferred],
     weight REAL, min_years REAL NULL, evidence_hint TEXT)
resumes(id, candidate_id→users, filename, mime, size_bytes, raw_text, page_count, parse_status[ok|empty|failed],
     parse_error, extracted_json, created_at)
resume_chunks(id, resume_id, section[summary|skills|experience|education|projects|certification|other],
     text, char_start, char_end, embedding BLOB NULL)          -- offsets = evidence anchors
applications(id, job_id, candidate_id, resume_id, stage, created_at, updated_at,
     override_score REAL NULL, override_reason TEXT NULL,
     UNIQUE(job_id, candidate_id))
assessments(id, application_id UNIQUE, overall REAL, skills_score, experience_score, projects_score,
     qualifications_score, confidence[high|medium|low], insufficient_evidence BOOL,
     ai_mode[groq|degraded|heuristic], embedding_mode[dense|lexical], model TEXT,
     summary TEXT, explanation TEXT, created_at)
assessment_skills(assessment_id, requirement_id, requirement_label,
     status[matched|partial|not_evidenced|confirmed_absent], score REAL, similarity REAL NULL,
     evidence_quote TEXT NULL, evidence_start INT NULL, evidence_end INT NULL, support[verified|flagged_unverified])
notes(id, application_id, author_id, body, created_at)                       -- recruiter-only
status_events(id, application_id, actor_id, from_stage, to_stage, reason, created_at)   -- audit trail
interview_questions(id, application_id, text, difficulty[beginner|intermediate|advanced],
     category[skill|project|experience|behavioral], guideline TEXT, source[ai|human], created_at)
interviews(id, application_id, scheduled_at_utc, duration_min, interviewer_id, interview_type,
     location, status[scheduled|completed|cancelled], conflict_flag BOOL, created_at)
feedback(id, interview_id, interviewer_id, rating INT, strengths, concerns, recommendation, created_at)
final_decisions(id, application_id, recruiter_id, decision[selected|rejected], rationale, created_at)
```

Candidate stage machine: `submitted → parsed → assessed → recruiter_review → shortlisted | rejected → interview → selected | rejected`.
Transitions are validated server-side; only a recruiter triggers `shortlisted|rejected|selected`; `rejected` always requires an explicit recruiter action (R35).

## 5. API contracts (frozen; changes go through `[CONTRACT]`)

Base `http://127.0.0.1:8000/api`. Auth `Authorization: Bearer <jwt>`. Errors `{"detail": "..."}` (422 for validation). Types mirrored in `contracts/types.ts` (Agent B owns that file; Agent A imports it read-only).

**Auth** `POST /auth/register` `{email,password,full_name,role}` → `{token,user}` · `POST /auth/login` → `{token,user}` · `GET /auth/me` → `user` · `POST /auth/logout` (client-side token clear, logged server-side)

**Jobs** `GET /jobs?status=&q=` → `JobSummary[]` (`{...job, applicant_count, shortlisted_count}`) · `POST /jobs` · `GET /jobs/{id}` → `JobDetail` (with `requirements[]`, counts) · `PATCH /jobs/{id}` · `POST /jobs/{id}/close` · `POST /jobs/{id}/reopen` · `POST /jobs/extract-requirements` `{description}` → `{requirements[]}` (AI)

**Resumes** `POST /resumes` multipart `file` → `{resume, extracted}` (real PyMuPDF parse + LLM extraction) · `GET /resumes/{id}` · `PATCH /resumes/{id}/skills` `{skills[]}` (candidate correction, R10)

**Applications** `POST /applications` `{job_id,resume_id}` → `application` · `GET /applications/mine` (candidate) · `GET /jobs/{id}/applicants` → ranked `ApplicantRow[]` · `PATCH /applications/{id}/stage` `{to_stage,reason}` (recruiter) · `POST /applications/{id}/override` `{score,reason}` · `POST /applications/{id}/notes` · `GET /applications/{id}` → detail incl. `assessment`, `events[]`, `notes[]`

**Assessment** `POST /applications/{id}/assess` → `Assessment` (idempotent recompute) · `GET /applications/{id}/assessment` → `Assessment` with `skills[]` evidence rows

**Questions** `POST /applications/{id}/questions/generate` `{counts?}` · `GET .../questions` · `PATCH /questions/{id}` · `DELETE /questions/{id}`

**Interviews** `POST /interviews` `{application_id,scheduled_at,interviewer_id,interview_type,duration_min}` → `201` | `409` conflict payload · `GET /interviews?job_id=` · `POST /interviews/{id}/feedback` · `POST /interviews/{id}/decision` `{decision,rationale}`

**Analytics** `GET /analytics/overview` → `{active_jobs,applications,shortlisted,pending_reviews,interviews,shortlist_rate,avg_processing_hours,by_job[],by_stage[],common_gaps[]}`

**Talent** `GET /talent/search?q=` → `{candidates[],mode}` (LLM query → requirements → embedding rank + evidence) · `GET /talent/compare?ids=1,2,3` · `GET /talent/duplicates` · `POST /talent/merge` `{keep_id,merge_id}` · `GET /candidates/jobs/recommended` · `GET /jobs/{id}/talent-pool`

**Ops** `GET /health` → `{status,ai_mode,embedding_mode,db}` · `GET /audit/fairness` → attribute-swap proof (R33)

Key shapes (abbreviated):
```ts
type Score = { overall:number; skills:number; experience:number; projects:number; qualifications:number;
  confidence:'high'|'medium'|'low'; insufficient_evidence:boolean; ai_mode:string; embedding_mode:string };
type SkillRow = { label:string; importance:'required'|'preferred'; status:'matched'|'partial'|'not_evidenced'|'confirmed_absent';
  weight:number; score:number; similarity:number|null; evidence:{quote:string;start:number;end:number}|null;
  support:'verified'|'flagged_unverified' };
type ApplicantRow = { application_id:number; candidate:{id:number;name:string;email:string}; stage:string;
  score:Score|null; matched:string[]; missing:string[]; has_notes:boolean };
```

## 6. Resume extraction pipeline (real, offset-anchored)

1. **Upload** → validate extension `pdf` + MIME + non-zero size; store bytes; `PyMuPDF` `page.get_text("text")` per page, accumulate a single string with a page-offset map.
2. **Guard**: `< 80` printable chars or no text layer (scanned) ⇒ `parse_status='empty'|'failed'` + human-readable `parse_error`; UI offers candidate correction instead of a dead end (R11).
3. **LLM extraction** (Groq, JSON mode): name, email, phone, links, skills[{label,canonical,quote}], experience[{company,title,start,end,months,summary,quote}], education[{institution,degree,field,quote}], projects[{name,description,tech[],quote}], certifications[]. Each item must return a `quote`; the server locates the quote in `raw_text` and stores `start/end`. Quote not found ⇒ `support=flagged_unverified` and the row is kept but flagged (R34) — this is the hallucination gate.
4. **Deterministic fallback** if the LLM fails: regex email/phone, section-splitting, skill dictionary scan. Flagged `ai_mode='degraded'` in the UI so the demo never pretends.
5. **Normalization**: `skill_dictionary.py` maps synonyms to canonicals (js→javascript, postgres→postgresql, rest api/web services/restful→rest_api, k8s→kubernetes, ml→machine_learning, ci/cd→cicd). Unknown skills keep their cleaned label.
6. **Chunking**: split `raw_text` into section-aware chunks (skills/experience/projects/education/other) with offsets; embed each chunk and store the vector (R28).

## 7. Semantic matching and evidence-grounded scoring

Per application:
1. Requirements → one query text per requirement (`label + importance + evidence_hint`).
2. **Semantic recall**: cosine(embedding(chunk), embedding(requirement)) over all chunks; keep best 3 chunks per requirement with `similarity`.
3. **LLM adjudication** (single batched call, temperature 0, JSON): for each requirement give `status`, `reason`, `quote`, `chunk_id`. Constrained: the quote must come from the supplied chunks; quotes are re-verified against `raw_text` server-side.
4. **Deterministic arithmetic**:
   - `skills = sum(w_i * s_i) / sum(w_i) * 100`, `s_i` = 1 matched, 0.5 partial, 0 not_evidenced/confirmed_absent; `w_i` = 1.0 required, 0.4 preferred, scaled by job `weight`.
   - `experience = min(1, evidenced_years / required_years) * 100`; if `required_years` is unset the dimension is excluded and weights re-normalized, never guessed.
   - `projects = 100 * scaled cosine(project chunks, job description)`.
   - `qualifications = matched_qualifications / total_qualifications * 100`.
   - `overall = 0.50*skills + 0.25*experience + 0.15*projects + 0.10*qualifications`, dropping empty dimensions and re-normalizing the rest.
   - `confidence`: high when >=70% of required skills carry verified quotes, medium, low. `insufficient_evidence` when <50%. Low confidence renders as a band, never a bare certainty (R15/R34).
5. **Tri-state**: `not_evidenced` = resume silent; `confirmed_absent` only when the resume explicitly says no experience or a recruiter marks it. Absence is never proof of incompetence (R15).
6. **Fairness**: `fairness.py` strips name, gender, age, DOB, marital status, nationality, religion, photo and address from the text sent to the LLM and from the person-level embedding; only job-related content is scored. `GET /audit/fairness` re-scores a fixed profile with attributes swapped and asserts the score is identical (R33).

## 8. Exact end-to-end demo journey (must pass before any phase-4 work)

1. Recruiter logs in, dashboard shows demo stats.
2. Creates **Backend Developer** job: Python, Django, PostgreSQL, Docker required; 3+ years; Bachelor's in CS.
3. Candidates 1 (strong), 2 (partial) and 3 (adjacent) register, upload a **real PDF resume**, apply; assessment runs (LLM + embeddings).
4. Recruiter opens the job, sees ranked applicants with score breakdown, matched skills with quotes, gaps, `not_evidenced` rows and a confidence band.
5. Opens Candidate 1: evidence excerpts, explanation, audit timeline.
6. **Manually** shortlists Candidate 1 and adds a private note.
7. Generates interview questions (beginner/intermediate/advanced + project questions), edits one, regenerates one.
8. Schedules an interview (date/time/interviewer/type); a second overlapping booking returns `409` with the conflicting slot.
9. Dashboard analytics update: applications, shortlisted, interviews, shortlist rate, average processing time, common gaps.

Permitted shortcuts: notifications are simulated; no email; no cloud deploy (local run + README).

## 9. Security checklist

bcrypt hashes - JWT with expiry - role guard on every recruiter and mutation route - ownership checks so a candidate reads only its own resume/applications - pydantic validation on every body - upload size/type limits - parameterized queries only - AI keys server-side in `backend/.env` (gitignored, never in `frontend/`) - no secrets in git history - CORS limited to the Vite origin - audit event for every stage change.

## 10. Schedule (T0 = 09:30; re-baseline to the real clock at each phase start)

| Phase | Clock | Timebox | Deliverable | Exit criteria |
|---|---|---|---|---|
| 0 | 09:30-09:45 | 15m (actual: 09:35-10:05) | Plan, contracts, fixtures, `[CONTRACT]` posted | Agent A can start from fixtures |
| 1 | 09:45-10:45 | 60m | Skeleton, auth, jobs CRUD, PDF upload+parse, schema+seed | login/job/upload work; `/health` green |
| 2 | 10:45-11:45 | 60m | Extraction, embeddings, assessment, ranking | 3 candidates scored with quotes; R12/R13/R15 pass |
| 3 | 11:45-12:00 | 15m | Recruiter pipeline + evidence UI on real API | demo steps 1-5 green |
| -- | 12:00-13:00 | break | no risky edits | -- |
| 3b | 13:00-14:00 | 60m | Questions, scheduling+conflicts, analytics | demo steps 6-9 green |
| 4 | 14:00-14:45 | 45m | Talent search, compare, fairness audit, polish | R27/R32/R33 pass |
| 5 | 14:45-15:15 | 30m | Rehearse demo twice, fix bugs, README, submission pack | section 8 runs clean twice |
| 6 | 15:15-15:30 | 15m | Buffer only | pushed and submitted |

MVP cutoffs: steps 1-5 by **13:00**, steps 6-9 by **14:00**. Anything unfinished at 14:45 is cut, not rushed.

## 11. Test cases (run them, never assume them)

`backend/tests/` with pytest: auth (register, login, wrong password 401, candidate hitting a recruiter route 403), jobs (CRUD, close, reopen, applicant counts), upload (valid PDF, empty PDF, `.txt`, oversize), parsing (fields non-empty; `raw_text[start:end] == quote` for every evidence row), matching (strong > partial > adjacent ordering; two runs on the same input give identical scores), tri-state (silent != confirmed_absent), conflicts (409 on overlap), audit (one event per transition), fairness (swapping name/gender/age leaves the score identical), analytics (API numbers equal SQL truth).

Frontend smoke, documented in README: log in as both roles, create job, upload resume, view ranked list, shortlist, generate questions, schedule, dashboard. Browser console clean.

## 12. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Groq rate limit or network drop | AI features die mid-demo | deterministic fallback in every AI path + `ai_mode` badge + last good assessment cached |
| LLM returns malformed JSON | assessment fails | schema validation, one retry, then heuristic fallback |
| model2vec unavailable on Python 3.14 | no dense vectors | TF-IDF word+char-ngram hybrid inside the same interface (still real similarity) |
| Scanned/image-only PDFs | empty text | `parse_status` + candidate correction path |
| Scope explosion in 3.10 | mandatory demo missing | MVP cutoff table; stretch work is additive and isolated |
| Two agents in one file | conflicts, lost time | ownership table; `contracts/types.ts` is Agent B's, imported read-only by A |
| Judge doubts "is this real AI?" | credibility | `/health` shows mode, evidence quotes are clickable resume substrings, no canned output |

## 13. Deferred / stretch (explicitly not MVP)

DOCX - object storage - real email (simulated per spec) - cloud deployment (README + local run instead) - Celery (assessments run synchronously in <10s) - multi-tenant orgs - pgvector (numpy index over SQLite blobs) - bias dashboards beyond the swap audit - in-browser PDF preview.

## 14. Submission checklist

`README.md` with one-command run for backend and frontend - `backend/.env.example` with no keys - demo seed script - 3 real PDF resumes in `backend/data/resumes/` - tests green - no secrets in git - board updated - 2-minute verbal walkthrough rehearsed - source + assets submitted via platform or USB.

## 15. Live progress checklist

- [x] Rules, problem statement saved, architecture decided
- [x] Contracts and fixtures
- [ ] Backend skeleton + auth + jobs + upload
- [ ] Extraction + embeddings + assessment + ranking
- [ ] Pipeline UI on real API
- [ ] Questions + scheduling + analytics
- [ ] Talent search + compare + fairness audit
- [ ] Rehearsal, README, submission
