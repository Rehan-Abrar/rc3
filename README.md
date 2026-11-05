# Recruitment & Talent Intelligence Platform

AI-assisted recruitment with **evidence-grounded, explainable** candidate matching. Humans make
every hiring decision; the system never auto-rejects anyone.

Competition submission for the R S C I Web Development Competition, Riphah International University,
Lahore (05/Nov/2026) - see `PROBLEM_STATEMENT.md` and `COMPETITION_RULES.md`.

## What it does

| Area | Capability |
|---|---|
| Auth | Recruiter/candidate registration, login, logout. bcrypt hashes, JWT sessions, role + ownership authorization |
| Jobs | Create/edit/close/reopen, required/preferred skills with importance, AI extraction of requirements from a free-text description |
| Resumes | Real **PDF (PyMuPDF) and DOCX (OOXML)** parsing -> structured profile via LLM with **quote -> character-offset verification**; the original file can be opened from the UI; candidate corrections; graceful failure for scanned/empty files |
| Matching | Dense embeddings + cosine recall, then LLM evidence adjudication, then **deterministic weighted scoring** (skills 50 / experience 25 / projects 15 / qualifications 10) |
| Explainability | Every matched requirement carries a resume excerpt; missing evidence is distinguished from confirmed absence; confidence band instead of false precision |
| Pipeline | Submitted -> Parsed -> Assessed -> Recruiter review -> Shortlisted/Rejected -> Interview -> Selected, with audit trail, private notes and manual score override |
| Interviews | AI question generation (beginner/intermediate/advanced + project questions) with answer guidelines, edit/regenerate; scheduling with conflict detection (409); structured feedback; final decision |
| Analytics | Active jobs, applications, shortlisted, pending reviews, interviews, shortlist rate, average processing time, common skill gaps |
| Talent intelligence | Natural-language talent search with evidence, candidate comparison, duplicate detection with human-confirmed merge, job recommendations, talent pool, fairness audit |

## Architecture

```
frontend/   React + Vite + TypeScript + Tailwind (Agent A - UI/UX)
backend/    FastAPI + SQLAlchemy + SQLite (Agent B - API, AI, data)
contracts/  types.ts + fixtures: the frozen API contract both sides build against
```

- **AI provider:** Groq, server-side only (`backend/.env`, gitignored). Two tiers:
  `openai/gpt-oss-120b` for resume extraction, evidence verification and explanations;
  `openai/gpt-oss-20b` for requirement extraction, question generation and query parsing.
  Strict Structured Outputs (`json_schema`, `strict: true`) on every call.
- **Credential pool:** any number of `GROQ1`, `GROQ2`, `GROQ3`... keys can be configured; on a
  rate limit the client fails over to the next credential and only surfaces the limit
  (`ai_mode=degraded`) once every credential is exhausted.
- **Embeddings:** `model2vec` static embeddings (256-d, numpy only, no torch) with a lexical
  fallback. The provider actually used is reported by `/api/health` and shown in the UI - the
  fallback is never mislabelled as semantic.
- **AI honesty:** no hardcoded AI output. If a call fails the response is marked `degraded` and
  the UI says so. A claim whose quote cannot be found in the resume is downgraded, never trusted.
- **Secrets:** keys live in `backend/.env` only. `.env`, `backend/data/`, `*.db` are gitignored.

## Run it

```bash
# 1. backend
cd backend
cp .env.example .env          # add GROQ1 (and optionally GROQ2)
./run.sh                      # installs requirements.txt, seeds on first run, serves :8000
# or manually:
#   python -m pip install -r requirements.txt
#   python seed.py --reset      # 3 real PDF resumes, 1 job, 3 assessments
#   python -m uvicorn main:app --port 8000

# 2. frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Seed credentials:

| Role | Email | Password |
|---|---|---|
| Recruiter | `recruiter@hire.dev` | `demo1234` |
| Candidate (strong) | `candidate@hire.dev` | `demo1234` |
| Candidate (partial) | `bilal@rc3.dev` | `demo1234` |
| Candidate (adjacent) | `sana@rc3.dev` | `demo1234` |
| Candidate (thin résumé) | `hamza@rc3.dev` | `demo1234` |
| Candidate - real PDF CV | `rehan@rc3.dev` | `demo1234` |
| Candidate - real DOCX CV | `ubaid@rc3.dev` | `demo1234` |
| Candidate - real PDF CV | `mustafa@rc3.dev` | `demo1234` |

**Every password is `demo1234`.** You only need two logins for the demo: the recruiter and
`candidate@hire.dev`; the rest are there so the ranked list has real competition and so each
real CV can open its own candidate portal.

The seed leaves the pipeline mid-journey so every screen has content on first load: Bilal is
shortlisted with an interview booked (check the Interviews page and his candidate timeline),
Sana has a private recruiter note, and Hamza has a deliberately thin résumé so the
`insufficient_evidence` path is visible rather than hidden.

Two seeded jobs: **Backend Developer** (synthetic backend candidates) and
**Product Engineer (React + TypeScript)** (the three real CVs from `CVs/`, one of them DOCX).
Log in as any candidate to see the same application the recruiter sees, and use
**View file** to open the original PDF/DOCX.

## Tests

```bash
cd backend && python -m pytest tests/ -q     # 26 passed
cd backend && python demo_preflight.py       # 36 checks: one reviewer journey, end to end
cd backend && python feature_sweep.py        # 64 checks: every endpoint, incl. error paths
```

`pytest` covers auth + role/ownership guards, job CRUD/validation, upload rejection, real PDF and
DOCX parsing with quote-offset integrity, tri-state evidence, scoring arithmetic and determinism,
fairness invariance, dense-embedding paraphrase separation, interview conflict 409, and the
failure modes below. `feature_sweep.py` walks all 64 API paths including the unhappy ones
(401/403/404/409/415/422) and fails loudly on any 5xx.

## Demo (2 minutes)

1. Log in as the recruiter, open **Backend Developer** (Python, Django, PostgreSQL, Docker).
2. Ranked applicants with score breakdown, matched skills and evidence quotes.
3. Open Ayesha Khan: evidence per requirement, confidence band, audit trail.
4. Shortlist her, add a private note.
5. Generate interview questions, edit one.
6. Schedule the interview; scheduling a second overlapping slot shows the conflict banner.
7. Dashboard analytics update; talent search returns evidence-backed candidates.

## Failure behaviour (deliberate)

- **Never a silent zero.** If the model returns nothing usable, or claims "no evidence" for a
  requirement it cannot actually rule out, the assessment degrades (`ai_mode=degraded`, reasons
  in `summary`) and re-attempts itself on the next read instead of freezing a bad number.
- **Quotes are proof, not decoration.** A quote only counts as `verified` when
  `raw_text[start:end] == quote`; otherwise the row is `flagged_unverified` and cannot be `matched`.
- **Internal reasoning stays internal.** Candidates never see recruiter notes, interview
  questions, manual overrides or override reasons.
- **Rate limits are surfaced.** With several Groq credentials the client fails over on 429 and
  only reports `degraded` once every credential is exhausted.

## Known limits

- Notifications and email are simulated, as the spec permits.
- Runs locally (SQLite + uvicorn); no cloud deployment.
