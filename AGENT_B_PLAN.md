# AGENT_B_PLAN.md — Rehan / Agent B (architecture, backend, AI, integration, tests)

Read `MASTER_PLAN.md` first; it is the source of truth. This file is the execution order, file list and acceptance gates.

| | |
|---|---|
| Login | `@Rehan-Abrar` |
| Root you own | `backend/**`, `contracts/**` |
| Not yours | `frontend/**` (Agent A owns it, incl. `App.tsx` and routing) |
| Verified installed | fastapi 0.141, uvicorn 0.52, SQLAlchemy 2.0.51, pymupdf 1.28, scikit-learn 1.8, numpy 2.4, openai 3.8, bcrypt 5.0, PyJWT 2.8, python-multipart 0.0.32, model2vec (installed now, static 256-d embeddings, no torch) |

## 0. Environment facts (checked, not assumed)

- Python 3.14.2 at `C:\Users\rehan\AppData\Local\Python\pythoncore-3.14-64\python.exe`; no torch, so sentence-transformers is out.
- `backend/.env` already holds Groq keys (`GROQ1`, `GROQ2`) supplied by the human. **Keys stay server-side, `.env` is gitignored, never logged, never echoed.** Use Groq's OpenAI-compatible endpoint `https://api.groq.com/openai/v1`, model `llama-3.3-70b-versatile`, `temperature=0`, JSON mode.
- `model2vec` + `minishlab/potion-base-8M` verified working locally (256-d, cosine sane). Pin as primary embedding provider; TF-IDF hybrid is the fallback.

## 1. File layout

```
backend/
  main.py                 app factory, CORS, routers, startup create_all + seed-if-empty
  config.py               settings from env (GROQ1 fallback GROQ2, model names, paths)
  db.py                   engine, SessionLocal, Base
  models.py               all SQLAlchemy tables (MASTER_PLAN section 4)
  schemas.py              pydantic request/response models
  security.py             bcrypt hash/verify, JWT encode/decode, get_current_user, require_role
  routers/auth.py         register, login, me, logout
  routers/jobs.py         CRUD, close/reopen, list w/ counts, extract-requirements
  routers/resumes.py      upload+parse, get, patch skills
  routers/applications.py apply, mine, applicants, stage, override, notes, detail
  routers/assessments.py  assess (idempotent), get
  routers/questions.py    generate, list, update, delete
  routers/interviews.py   create w/ conflict 409, list, feedback, decision
  routers/analytics.py    overview
  routers/talent.py       search, compare, duplicates, merge, job recommendations, talent pool
  services/pdf.py         PyMuPDF text + page offsets, failure/empty classification
  services/extract.py     LLM structured extraction, quote verification, heuristic fallback
  services/skills.py      synonym dictionary + canonicalization
  services/embeddings.py  provider interface: dense(model2vec) | lexical(tfidf+char) | cosine, batch
  services/matching.py    deterministic weighted scoring (the formula in MASTER_PLAN 7)
  services/llm.py         Groq client wrapper: JSON call, schema validation, 1 retry, degrades
  services/fairness.py    protected-attribute stripping + swap audit
  services/analytics.py   aggregation queries
  seed.py                 idempotent demo data (recruiter, 3 candidates, job, applications)
  tests/                  pytest: auth, jobs, upload, parsing, matching, fairness, analytics, conflicts
  data/resumes/*.pdf      3 real generated PDFs (fictional candidates, real text layer)
contracts/
  types.ts                frozen TypeScript mirror of the API shapes
  fixtures/*.json         realistic fixtures so Agent A is never blocked
```

## 2. Phase-by-phase execution

### Phase 0 (must land in minutes) — contracts first
1. `contracts/types.ts` + `contracts/fixtures/{jobs,applicants,assessment,analytics,interviews}.json` matching MASTER_PLAN §5 exactly.
2. `[CONTRACT]` post with the paths and a START signal for Agent A.
**Exit:** Agent A can build every screen from fixtures.

### Phase 1 — skeleton, auth, jobs, upload (60m)
`config/db/models/schemas/security` → `auth` → `jobs` → `resumes` (real parse) → `seed`.
**Exit gates:** `/health` returns `{status,ai_mode,embedding_mode,db}`; register/login/me; role 403 proven by test; job create/close/reopen; a real PDF returns `raw_text` with `page_count > 0`; a text file is rejected 4xx.

### Phase 2 — extraction, embeddings, assessment (60m)
`services/pdf` (chunking + offsets) → `services/skills` (synonyms) → `services/embeddings` → `services/llm` → `services/extract` (quote verification) → `services/matching` → `routers/assessments`.
**Exit gates:** 3 seeded PDFs produce distinct, ordered scores (strong > partial > adjacent); every `matched` row has `raw_text[start:end] == quote`; repeat run gives identical numbers; LLM failure path yields `ai_mode='degraded'` and still returns an assessment.

### Phase 3 — pipeline, questions, scheduling, analytics (60m)
`routers/applications` (stage transitions + `status_events` + notes) → `routers/questions` (generate/edit/delete) → `routers/interviews` (conflict detection) → `routers/analytics`.
**Exit gates:** invalid transition 400; every transition writes an audit row; overlapping interview 409 with the conflicting slot; analytics numbers equal SQL truth in tests.

### Phase 4 — talent intelligence (45m)
`routers/talent`: NL search (LLM query → requirements → embedding rank + evidence), compare, duplicates, merge with explicit confirmation, job recommendations, talent pool, `/audit/fairness`.
**Exit gates:** search returns ranked candidates with snippets; fairness swap test passes; no auto-reject anywhere.

### Phase 5 — integration and submission (30m)
Seed the demo dataset, run the full §8 journey by curl **and** through the UI with Agent A, run pytest, write `README.md` + `.env.example`, confirm no secrets in `git log -p -- .env`.

## 3. Contract ownership

You own `contracts/types.ts`, `contracts/fixtures/`, every request/response schema, error shapes, and the stage machine. Any change is a `[CONTRACT]` post naming the file and the changed field. Never let Agent A wire against an undocumented field.

Validation rules you enforce server-side: email format + uniqueness, password min length 8, role enum, salary range sane, job status transitions, stage transitions, upload type/size, interview datetime must be future, `interviewer_id` must be a recruiter.

## 4. Test coverage targets (pytest, must actually run)

| File | Covers |
|---|---|
| `test_auth.py` | register/login/wrong password/role guard/ownership |
| `test_jobs.py` | CRUD, close/reopen, counts, validation |
| `test_resumes.py` | PDF parse, empty, wrong type, skill correction |
| `test_matching.py` | ordering, determinism, quote↔offset integrity, tri-state, insufficient evidence |
| `test_fairness.py` | attribute swap leaves score identical |
| `test_interviews.py` | 409 conflict, feedback, decision |
| `test_analytics.py` | API numbers == SQL truth |
| `test_pipeline.py` | stage transitions + audit rows |

Never report a test as passing without the run output.

## 5. Handoff / integration points

| Checkpoint | You deliver | Agent A unblocks |
|---|---|---|
| P0 | `contracts/types.ts`, fixtures, `[CONTRACT]` | all screens |
| P1 | `/auth/*`, `/jobs*`, `/resumes` | login, job editor, upload |
| P2 | `/jobs/{id}/applicants`, `/applications/{id}/assessment` | ranked evidence UI |
| P3 | `/questions*`, `/interviews*`, `/analytics/overview` | pipeline, questions, scheduling, dashboard |
| P4 | `/talent/*`, `/health`, `/audit/fairness` | search, compare, AI-mode badge |

Post `[DONE]` at each checkpoint with the endpoint list and the test command that passed. Post `[BLOCKER]` immediately if a key dies or a dependency is missing — never silently fake AI output.
