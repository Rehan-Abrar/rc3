# AGENT_A_PLAN.md — Ubaid / Agent A (frontend, UX, design)

Read `MASTER_PLAN.md` first. It is the source of truth; this file only says **what you build, in what order, with which files**. Do not duplicate its contracts here — import them from `contracts/types.ts`.

| | |
|---|---|
| Login | `@UbaidUrRehmaanDar` |
| Root you own | `frontend/` (all of it) |
| Not yours | `backend/`, `contracts/`, `MASTER_PLAN.md`, `PROBLEM_STATEMENT.md` |
| Stack | Vite + React 18 + TypeScript + Tailwind + Recharts + lucide-react. Router: react-router-dom |
| Design brief | Dense, professional recruiter tool. Dark-neutral UI, one accent color, tabular numbers, evidence-first cards. No hero-page fluff, no gradients-for-the-sake-of-it |

## 1. Ownership boundary (avoid merge conflicts)

You own `frontend/src/**`, `frontend/index.html`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/src/index.css`, **`App.tsx` and all routing**.

Agent B owns `contracts/**` (types + fixtures), `backend/**`. Import from `contracts/types.ts` and `contracts/fixtures/*.json` **read-only**. Never edit them; request a change with `[CONTRACT]` on the board.

Swap strategy fixture → real API: `frontend/src/lib/api.ts` is yours. Rule: every page loads through one client; a single flag `VITE_USE_FIXTURES=1` reads `contracts/fixtures/`, otherwise it calls `http://127.0.0.1:8000/api`. Your components never change when the switch flips. Set `VITE_USE_FIXTURES=0` as soon as an endpoint is live, endpoint by endpoint, so you are never blocked.

## 2. Phase-by-phase tasks

### Phase 0 (start now, ~15 min) — scaffold against fixtures
- `npm create vite@latest frontend -- --template react-ts`, add Tailwind, react-router-dom, recharts, lucide-react.
- Design tokens in `src/styles/tokens.css` + `tailwind.config.js`: surfaces, border, text, accent, success/warn/danger, score band colors. Sentence-case labels, 14px base, one type scale.
- App shell: `App.tsx` router + `components/layout/AppShell.tsx` (sidebar, role-aware nav, topbar with user menu + AI-mode badge from `GET /health`).
- `lib/api.ts` client + auth context (`AuthContext.tsx`, token in localStorage), `ProtectedRoute` with role check.
- Build `components/ui/` primitives once: `Button, Card, Input, Select, Textarea, Badge, Tabs, Table, Dialog, Toast, EmptyState, Skeleton, StatCard, ScoreBar, ScoreBreakdown, EvidenceQuote, ConfidenceBand`.
- **Acceptance:** `npm run build` clean, routes render with fixtures, 401 → redirect to login.

### Phase 1 (with B's auth/jobs landing) — auth, jobs, applications
- `pages/LoginPage.tsx`, `pages/RegisterPage.tsx` (role picker: recruiter/candidate), validation messages, loading + error states.
- `pages/recruiter/JobsPage.tsx` — table of jobs with applicant counts, status chips, close/reopen actions.
- `pages/recruiter/JobEditorPage.tsx` — create/edit: title, department, location, type, salary range, description, skills editor (required/preferred, importance weight, min years), qualifications. "Extract requirements with AI" button (calls `/jobs/extract-requirements`) that fills the chips and lets the recruiter edit them before saving.
- `pages/candidate/JobsBrowsePage.tsx`, `pages/candidate/ResumePage.tsx` (drag-drop upload, parse status, editable extracted skills/education corrections), `pages/candidate/MyApplicationsPage.tsx` (stage timeline + status).
- **Acceptance:** recruiter creates the demo job end-to-end in the UI; candidate uploads a PDF and sees extracted fields; all errors show a human message, never a raw stack trace.

### Phase 2 — ranking with evidence (highest mark value)
- `pages/recruiter/ApplicantsPage.tsx`: ranked table + filters (stage, min score, required-skill chips, "hide insufficient evidence"), sortable, manual score override dialog with reason.
- `components/assessment/ApplicantCard.tsx` and `components/assessment/SkillMatrix.tsx`: per-requirement row with status pill (`matched` / `partial` / `not_evidenced` / `confirmed_absent`), similarity bar, and **`EvidenceQuote`** that shows the resume excerpt; `flagged_unverified` items get a visible warning style.
- `components/assessment/ScoreBreakdown.tsx`: 4 weighted bars (50/25/15/10) + overall + confidence band; when `insufficient_evidence` show "evidence thin" instead of a confident number.
- **Acceptance:** a recruiter can explain any score from the screen alone (quote + weight + status visible without a console).

### Phase 3 — pipeline, questions, scheduling, analytics
- `pages/recruiter/ApplicationDetailPage.tsx`: candidate profile, evidence, explanation, audit timeline (`events[]`), notes panel (recruiter-only), stage action buttons (shortlist/reject/advance → interview → selected/rejected) each with a confirm dialog + reason field.
- `pages/recruiter/QuestionsPanel.tsx`: grouped by difficulty, inline edit, delete, regenerate, answer-guideline accordion.
- `pages/recruiter/InterviewsPage.tsx`: schedule dialog (date, time, interviewer, type, duration), schedule list, **conflict banner** rendering the 409 payload, feedback form, final decision form.
- `pages/recruiter/AnalyticsPage.tsx`: 5 stat cards, bar chart applications by job, funnel by stage, shortlist rate, avg processing time, common-gaps list.
- **Acceptance:** demo steps 6-9 clickable without the API docs.

### Phase 4 — talent intelligence + polish
- `pages/recruiter/TalentSearchPage.tsx`: natural-language search box, results with evidence snippets and mode badge (`dense`/`lexical`), multi-select.
- `pages/recruiter/ComparePage.tsx`: side-by-side score breakdown, matched/missing columns, evidence.
- Duplicate banner + human-confirm merge dialog; recommended-jobs list on the candidate dashboard.
- Polish pass: responsive at 375 / 768 / 1440, focus rings, keyboard nav, `aria-label`s, empty/loading/error states everywhere, skeletons, toast feedback, reduced-motion respected.
- **Acceptance:** no horizontal scroll at 375px, every async view has loading+empty+error states, Lighthouse-ish a11y pass by hand (labels, contrast, focus order).

## 3. Accessibility and design priorities (in order)

1. Evidence legibility — quotes must be readable and visually anchored to the claim.
2. Score transparency — weight, status and confidence always on screen together.
3. Density and scanning — recruiter workflows are tables and lists, not cards in whitespace.
4. Responsive: sidebar collapses to a drawer; tables become stacked rows with labels.
5. Accessibility: semantic landmarks, labels on every input, visible focus, 4.5:1 text contrast, no color-only status (always pill text).
6. Motion: only for state changes (row expand, toast), 150-200ms, `prefers-reduced-motion` off-switch.

## 4. Creativity (20% weight) — cheap, real, judge-visible

- Evidence-on-hover: hovering a matched skill highlights the exact quote with the job requirement it satisfies.
- "Why this rank" one-line explanation under each candidate card, generated from the assessment fields (not free text the backend invents separately).
- Confidence band instead of a false-precise number for thin evidence — visibly honest AI.
- Score-delta chip showing the recruiter override vs the AI score.

## 5. Handoff and integration points

| Checkpoint | You need from B | You deliver |
|---|---|---|
| P1 start | `contracts/types.ts` + fixtures | runnable shell, login, job editor |
| P1 end | `/auth/*`, `/jobs*` live | jobs + upload working against real API |
| P2 | `/jobs/{id}/applicants`, `/applications/{id}/assessment` | ranked list with evidence |
| P3 | `/questions*`, `/interviews*`, `/analytics/overview` | pipeline, questions, scheduling, dashboard |
| P4 | `/talent/search`, `/talent/compare`, `/health`, `/audit/fairness` | search, compare, badges |

Rules: post `[BLOCKER]` only when a fixture cannot unblock you; post `[WARNING]` if you must touch a shared file; never edit `backend/` or `contracts/`.
