# Demo run sheet (2–3 minutes)

Two logins cover everything. **Every password is `demo1234`.**

| Who | Email | Password |
|---|---|---|
| Recruiter | `recruiter@hire.dev` | `demo1234` |
| Candidate | `candidate@hire.dev` | `demo1234` |

Other candidates exist so the list is competitive: `bilal@`, `sana@`, `hamza@`, `rehan@`,
`ubaid@`, `mustafa@` (all `@rc3.dev`, same password). Their résumés are real files in `CVs/`.

Servers: backend `uvicorn main:app --port 8000`, frontend `npm run dev` → http://localhost:5173.
Check the pill in the sidebar: it must read **groq** and **dense**, not `degraded`.

---

## 1. The problem, in one sentence

"Recruiters get a pile of PDFs and a gut feeling. We return a ranked shortlist where every
point is tied to a sentence in the candidate's own résumé."

## 2. Recruiter — ranked, evidence-first (60s)

1. Log in as **recruiter@hire.dev**. Dashboard shows 2 open roles and live pipeline numbers.
2. Open **Backend Developer** → ranked list: Ayesha **97.5**, Bilal **45.9**, Sana **42.8**,
   Hamza **11.6**. Hamza has a deliberately thin résumé: the score stays visible but carries a
   **thin** caveat instead of pretending to be confident.
3. Click **Why?** on Ayesha → each requirement shows its own evidence sentence with the
   resume offset it came from. Weights are fixed (skills 50 / experience 25 / projects 15 /
   qualifications 10), so the arithmetic is checkable, not a black box.
4. Open Ayesha's application: audit trail, confidence band, **View file** opens her real PDF.

## 3. Human in the loop (45s)

5. Write a private note (candidates never see it), then **Schedule interview**: pick a time,
   submit. Submit a second overlapping slot → the API rejects it with **409** and the dialog
   stays open showing whose booking it clashes with.
6. **Interviews** page now lists the slot; **Analytics** shows the updated conversion.

## 4. Honesty under pressure (30s)

7. **Audit** page: the same résumé is re-scored with gender, name, age, marital status and
   nationality changed. Baseline is that candidate's real Skills score; delta is **0.0**.
   Be precise about the claim: it proves the text we score is unchanged by those attributes -
   it is not proof that hiring outcomes are fair, which is why a human still decides.
   On the breakdown, a dimension the role sets no bar for reads "not scored" with 0%, so the
   percentages always multiply out to the overall.
8. Kill the internet (or drop the API key) and re-run an assessment: the app says
   `ai_mode: degraded` and shows semantic similarity only. It never invents a score and never
   labels lexical matching as semantic.

## 5. Candidate side (30s)

9. Log in as **candidate@hire.dev** (Ayesha). She sees the same assessment per requirement,
   her stage tracker and her booked interview slot — but no recruiter notes, no prep questions,
   no manual override.

---

## If a judge asks "is the AI real?"

- Extraction and evidence adjudication run on Groq (`openai/gpt-oss-120b`), requirement
  extraction and question generation on `openai/gpt-oss-20b`, embeddings are local
  (model2vec, 256-d) — the sidebar exposes `ai_mode` and `embedding_mode` per assessment.
- A quote only counts as `verified` when `raw_text[start:end] == quote` byte for byte.
- Scoring is deterministic Python; the model never computes a number.

## If something looks wrong

```bash
cd backend && python demo_preflight.py    # 37 checks against the running API
cd backend && python feature_sweep.py     # 64 checks, every endpoint incl. error paths
cd backend && python -m pytest tests/ -q  # 35 offline tests
```

Then `python seed.py --reset` to put the demo data back to a known state, and restart uvicorn.
