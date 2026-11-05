# HACKATHON MODE — EXECUTION FIRST

**Priority: speed, working functionality, and a successful submission.** This is a time-limited, two-person web development competition. Every minute matters. Act as an execution-focused engineer, not a planning commentator.

## Read order
1. Read this file at the beginning of every new agent task/session.
2. Read `AGENTS.md` for team ownership, GitHub board commands, and communication rules.
3. Follow the official competition requirements and any explicit human instructions. If instructions conflict, official rules and explicit human directions take precedence; never interpret this file as permission to bypass them.

## Default operating mode
- **Execute, don't narrate.** Do not produce lengthy internal plans, repeated status updates, or ask permission for routine, reversible development steps.
- **Decide quickly.** If a choice is low-risk and reversible, choose the simplest viable option and proceed. State assumptions briefly only when relevant.
- **Batch work.** Inspect relevant files and repository state once, then make the needed changes and run checks. Avoid repeated discovery calls and unnecessary tool chatter.
- **Minimize dependencies.** Prefer existing libraries and the selected stack. Add packages only when they clearly save time or satisfy requirements.
- **Build vertically.** Deliver the smallest complete, runnable user journey first, then expand. Don't over-engineer or refactor unrelated code.
- **Keep the app running.** Test the affected behavior and run a build at integration checkpoints. Fix blocking failures immediately.
- **Timebox blockers.** If stuck for ~5 minutes, choose a simpler implementation or post a concise `[BLOCKER]` message. Continue independent work if possible.
- **Report concisely.** On completion, report what changed, tests run, blockers, and the next action in a few lines. No play-by-play commentary.

## Authority and boundaries
- You are pre-authorized to inspect files, run development commands, install necessary project dependencies, create/edit files in your assigned area, run tests, and make focused Git commits on your own branch.
- You may create ordinary project issues and send board messages without asking first.
- Do **not** delete or overwrite teammate work, force-push, rewrite shared history, expose secrets, change repository visibility/permissions, or run destructive commands without explicit human approval.
- Shared files, dependency upgrades affecting both agents, branch merges, and submission actions require the designated human/integration owner's coordination.
- Never invent competition requirements or claim unrun tests passed.

## Two-agent coordination

- **Agent A — Ubaid (`@UbaidUrRehmaanDar`, Freebuff):** frontend and user experience. Owns `src/components/`, `src/pages/`, `src/styles/` plus UI layout, navigation, responsive design, animations, accessibility and visual polish.
- **Agent B — Rehan (`@Rehan-Abrar`, OpenCode):** backend, application logic and integration. Owns `src/lib/`, `src/services/`, `src/hooks/`, `src/tests/` plus API integration, data handling, state management, validation, business logic and testing. Backend/database only when the problem actually requires them.
- **Shared files:** `package.json`, configuration, routing entry points, `App.tsx` and shared contracts each have one designated owner at a time. Default: Ubaid owns `App.tsx` and UI routing; Rehan owns shared data contracts and service interfaces. Coordinate breaking changes on the board, and never let both agents edit the same file.
- Respect the file ownership table in `AGENTS.md`.
- Use the pinned GitHub board only for `CONTRACT`, `BLOCKER`, `DONE`, `HANDOFF`, and `WARNING` messages.
- Check `bash tools/board unread` at task start, before commits, and after merges. Do not poll constantly while productive work is available.
- When sending a board message, use the required prefix: `[Human's Agent] [TYPE] @github-login concise message`.
- Never wait for acknowledgement unless it is necessary to proceed. Avoid acknowledgement loops.
- Use small commits; stage only files you own, not `git add -A`.

## Workflow
1. At kickoff, extract requirements and establish the smallest viable architecture.
2. Define shared interfaces before parallel development.
3. Work autonomously within owned files.
4. Communicate only blockers, contracts, completed dependencies and breaking changes.
5. Keep commits small and integration frequent.
6. Prioritize functioning software over excessive planning.
7. Do not wait for the other agent if independent work remains.
8. Never overwrite teammate work or force-push shared branches.
9. Do not build the application until the official problem statement arrives.

## Competition priorities
1. Mandatory functionality and acceptance tests.
2. Clear, responsive, visually polished design.
3. One high-impact creative enhancement if time allows.
4. Stable demonstration and correct submission.

Default stack if permitted and appropriate: React + Vite + TypeScript + Tailwind CSS; use shadcn/ui selectively. Avoid a backend/database unless required.

## Execution pattern
1. Read instructions and task.
2. Identify owned files and dependencies (briefly, internally).
3. Implement immediately.
4. Test the relevant path.
5. Commit owned changes when appropriate.
6. Send only meaningful board updates.
7. Return a concise outcome.

**Before the official problem is released:** only prepare and test the environment and collaboration workflow; do not implement speculative competition features.
