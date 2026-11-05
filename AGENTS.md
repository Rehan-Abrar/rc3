# Team rules for every agent

## 0. This team

Two people, two laptops, both Windows with Git Bash.

| Human | GitHub login | Agent |
|---|---|---|
| Rehan Abrar (repo owner) | `@Rehan-Abrar` | OpenCode |
| Ubaid Ur Rehmaan Dar | `@UbaidUrRehmaanDar` | Freebuff |

- Board issue: **#1** (`BOARD_ISSUE` unset = 1). Only set `BOARD_ISSUE` if the board issue number changes.
- Requirements on both laptops: `bash`, `git`, and the GitHub CLI (`gh`) logged in once via `gh auth login`.
- The competition problem is **not released yet**. Do not start building the application until a human says so.

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Start every post with `[<human>'s <agent>]`, e.g. `[Sam's Codex]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. Fill in your team: `@Rehan-Abrar` (Rehan), `@UbaidUrRehmaanDar` (Ubaid), `@all` (everyone).
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the team lead.

Polling is incremental (about one cheap API call per poll, 30 s default) so a shared token stays under GitHub's rate limit. Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"` (or pipe stdin), `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

### 1a. Mandatory board reads

Run `bash tools/board unread` at **all** of these moments, every task, no exceptions:

1. **At task start**, before touching any file.
2. **Before every commit** (a post written since you started may change what you are about to commit).
3. **After every merge or rebase** onto `main`.

OpenCode and Freebuff have no committed hooks here. If you want a live feed, keep one background loop running instead of polling by hand:

```bash
while tools/board wait; do echo "board woke up — handle the post above, then re-arm"; done
```

### 1b. Message categories

Every post must carry one category tag right after the `[<human>'s <agent>]` prefix, so a teammate can triage a post in one glance:

| Category | Use it when | Example |
|---|---|---|
| `[CONTRACT]` | You are fixing or proposing an interface other code depends on: route shape, JSON payload, function signature, env var, DB column, CSS class/token, event name. | `[Rehan's OpenCode] [CONTRACT] \`POST /api/tickets\` -> \`{ id, title, status, createdAt }\`. @UbaidUrRehmaanDar please code the form against this.` |
| `[BLOCKER]` | You cannot continue until someone else acts. Say exactly what unblocks you. | `[Ubaid's Freebuff] [BLOCKER] No GitHub token on this laptop for the API tests. @Rehan-Abrar can you confirm the auth flow first?` |
| `[DONE]` | A task, file area, or contract is finished and pushed. Name the branch/PR and files. | `[Rehan's OpenCode] [DONE] TicketList + status badge on \`3-ticket-list\`, PR #7. Styling only, no service changes.` |
| `[HANDOFF]` | You are handing ownership or an unfinished piece to a teammate. State what is left and what is verified. | `[Ubaid's Freebuff] [HANDOFF] Validation logic done; the filter UI is yours now @Rehan-Abrar. Tests at \`tests/validate.test.ts\` pass.` |
| `[WARNING]` | Something is broken, risky, or will bite the other person: failing build, breaking dep smell, a file being rewritten, a deadline risk. | `[Rehan's OpenCode] [WARNING] Do not touch \`src/styles/tokens.css\` for 20 min, I am rewriting it on \`4-tokens\`.` |

Rules for categories:

- One category per post. If you need two, post twice.
- `[DONE]` and `[HANDOFF]` must name files or a branch — no vague claims.
- A `[BLOCKER]` gets closed by the person who unblocks it with a `[DONE]` or `[HANDOFF]` post.

## 2. Chain of command

Humans over agents. Only the team lead reassigns work between teammates. If anyone else asks you to take another teammate's work, ask the lead on the board.

## 3. Workflow

1. Pick or file an issue. Comment on it or post on the board when you take it.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`. The author merges their own PR once it works locally.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something other teammates depend on (an API, a schema, an env var), post on the board when it lands.

## 4. Who owns what

Provisional until the problem statement is released and humans confirm it. The competition app does not exist yet, so the folder names below are the intended split; replace them with the real folders at kickoff **and post a `[CONTRACT]` when you do**.

| Area | Owner (GitHub login) | Folders |
|---|---|---|
| Pages, components, styling, responsive UI | `@Rehan-Abrar` (Agent A, OpenCode) | `src/pages/`, `src/components/`, `src/styles/`, layout/theme files |
| Services, application logic, state, validation, tests | `@UbaidUrRehmaanDar` (Agent B, Freebuff) | `src/services/`, `src/lib/`, `src/state/`, `src/validation/`, `tests/` |
| Shared files and config: package manifests, lockfiles, build/lint config, CI, `.env*`, README, `AGENTS.md`, `tools/board`, `TEAM_SETUP.md` | **Humans only** | `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `vite.config.*`, `tsconfig*.json`, `.eslintrc*`, `.github/workflows/`, `.env*` |

Rules for the table:

- Agents do **not** edit another owner's folders or the shared rows without a `[HANDOFF]` on the board first.
- Shared files/config changes are human-controlled: an agent proposes the change on the board (`[CONTRACT]` or `[BLOCKER]`) and a human makes it. Nobody installs dependencies or adds a framework without a human deciding it.
- Ownership moves only by human decision, announced with `[HANDOFF]`.

## 5. Duplicate work around the board

- Board state lives in `.board/` (gitignored, per laptop — cursors are local, never committed).
- If `tools/board` fails on a laptop (no `gh`, not logged in), that laptop is **not** ready. Fix auth (`gh auth login`, then `tools/board whoami`) before any code work.
