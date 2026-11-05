# Demo run sheet (3 minutes)

Two logins cover everything. **Every password is `demo1234`.**

| Who | Email | Password |
|---|---|---|
| Recruiter | `recruiter@hire.dev` | `demo1234` |
| Candidate | `candidate@hire.dev` | `demo1234` (Ayesha Khan) |

Other candidates exist so the list is competitive: `bilal@`, `sana@`, `hamza@`, `rehan@`,
`ubaid@`, `mustafa@` (all `@rc3.dev`, same password). Their real résumés are in `CVs/`.

---

## Start the servers (do this 10 minutes before you present)

```bash
# 1. backend  (needs backend/.env with GROQ keys)
cd backend
pip install -r requirements.txt          # only once
python seed.py --reset                   # only if the DB is missing/polluted
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# 2. frontend, second terminal
cd frontend
npm install                              # only once - the 3D hero needs three/@react-three
npm run dev                              # http://localhost:5173
```

Check `http://127.0.0.1:8000/api/health` → `{"status":"ok"}`. Open
`http://localhost:5173` and confirm the landing hero renders the 3D network.

The sidebar pill must read **groq** and **dense**. If it reads `degraded`, the AI keys are
exhausted — see *Backup plan* at the end; do **not** present a degraded number as AI output.

Seeded state (verified): all seven assessments are `ai_mode=groq`, `embedding_mode=dense`,
`data_audit.py` reports 0 problems.

---

## 1. The problem, in one sentence (20s)

"Recruiters get a pile of PDFs and a gut feeling. We return a ranked shortlist where every
point is tied to a sentence in the candidate's own résumé, and the recruiter controls how the
points are weighted."

## 2. Recruiter — ranked, evidence-first (50s)

1. **Sign in** as `recruiter@hire.dev`. Landing page first if you want the 3D beat: the hero
   network is real WebGL — hover/click a node and the readout changes.
2. Open **Backend Developer** → ranked list:
   Ayesha **97.5**, Bilal **55.7**, Sana **42.8**, Hamza **11.6**.
   Hamza's résumé is deliberately thin: the score is visible but carries a **thin evidence**
   caveat and `low` confidence instead of pretending certainty.
3. Click **Why?** on Ayesha → each requirement shows the evidence sentence and the character
   offset it came from in the raw PDF. Every quote was verified as a literal substring —
   unverifiable quotes are downgraded and flagged, never invented.
4. Open her application: confidence band, audit trail, and **View file** opens her real PDF.
   The breakdown reads 50 / 25 / 15 / 10 over skills / experience / projects / qualifications.

## 3. The What-If simulator (60s) — the new headline feature

5. Back on the applicant list, open **What-if ranking** above the table.
6. Pick **Portfolio-first** (35 / 10 / 45 / 10). The preview immediately shows, per candidate,
   *Now → Simulated*, rank before/after and the per-dimension drivers:
   `Ayesha 97.48 → 92.44`, `Hamza 11.58 → 15.26`. Nothing is saved yet — the panel says
   **preview only** and the official ranking below is unchanged.
7. Type `20 / 55 / 15 / 10` (experience-heavy) → **Sana moves 3 → 2 and Bilal drops 2 → 3**,
   with the drivers showing exactly why (+experience, −skills).
8. Press **Apply**, give a reason, confirm: scores and order update for real, and the audit
   trail records job, recruiter, previous → new weights, reason and timestamp.
9. Do the same on **Product Engineer** with **Portfolio-first**: Ubaid 84.05 → 85.12 overtakes
   Rehan 90.73 → 83.13. Then press **Default** to restore 50/25/15/10 — the ranking returns to
   exactly the original numbers.

Talking point: the simulator cannot write anything until you confirm, and it makes no AI
calls — it is arithmetic over stored, evidence-backed dimension scores.

## 4. Human in the loop (35s)

10. On an application, write a **private note** (candidates never see it), then **Schedule
    interview**. Scheduling the same candidate twice returns **409** with the clashing slot —
    the guard is real.
11. **Interviews** lists the slot; **Analytics** shows the updated pipeline.

## 5. Honesty under pressure (25s)

12. **Audit** page: the same résumé is re-scored with gender, name, age, marital status and
    nationality changed → delta **0.0**, because the scoring text is provably identical.
    Say the limit out loud: this proves the text we score does not change with those
    attributes; it is not proof of fair hiring outcomes — which is why a human still decides.
13. Any dimension the role sets no bar for reads **"not scored"** with 0% and the remaining
    weights renormalise, so the percentages always multiply out to the overall score. A
    measured zero stays a real zero.

## 6. Candidate side (20s)

14. Log in as `candidate@hire.dev` (Ayesha): she sees the same per-requirement evidence, her
    stage tracker and (when booked) her interview slot — but no recruiter notes, no internal
    questions, no manual override.

---

## Backup plan if Groq is unavailable

* The platform never fabricates AI output: an assessment taken while the keys are exhausted
  is stored as `ai_mode=degraded` and shows semantic similarity only.
* Assessments are **cached**, so the seeded shortlist above stays presentable with the
  network down. Do not re-run an assessment live if the pill says `degraded`.
* These demo beats need **no** AI at all and always work offline: the What-If simulator,
  ranking, evidence offsets, private notes, scheduling, the fairness audit and the candidate
  view.
* If a fresh assessment is unavoidable, be explicit: "this one is running degraded — it is
  showing similarity only, not adjudicated evidence."
* Keys live in `backend/.env` (`GROQ1`…`GROQ5`, pooled with failover across organisations).
  The limit is only reported when every key is spent.

## If something looks wrong

```bash
cd backend
python demo_preflight.py      # 31 checks: seed, logins, scores, files, guards
python feature_sweep.py       # 79 endpoint checks (creates a throwaway job)
python data_audit.py          # arithmetic + evidence offsets + masking
python seed.py --reset        # restore the exact demo data above
```

`feature_sweep.py` and `demo_preflight.py` add test rows — always finish with
`python seed.py --reset` before presenting.
