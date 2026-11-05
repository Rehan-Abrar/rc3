# Team setup — second laptop (Ubaid)

Repo: <https://github.com/Rehan-Abrar/rc3>
Board issue: <https://github.com/Rehan-Abrar/rc3/issues/1> (pinned, `BOARD_ISSUE` **not** needed — the default is 1)

Everything below runs in **Git Bash** on Windows. Do it once per laptop; it takes about 5 minutes.

---

## 1. Install the two requirements

You need `git` and the GitHub CLI (`gh`). The board script needs nothing else — no Node, no Python, no packages.

```bash
git --version
gh --version
```

If `gh` is missing: <https://cli.github.com> → Windows installer, then reopen Git Bash.

## 2. Authenticate GitHub

```bash
gh auth login
```

Answer: **GitHub.com** → **HTTPS** → **Login with a web browser** → paste the one-time code → authorize as **UbaidUrRehmaanDar** (the account that was invited as collaborator).

Verify you are the right account:

```bash
gh auth status
```

It must say `Logged in to github.com account UbaidUrRehmaanDar`. If it shows `Rehan-Abrar`, switch with `gh auth switch`.

## 3. Clone (first time)

```bash
cd /d/Projects
git clone https://github.com/Rehan-Abrar/rc3.git rc3
cd rc3
```

Already cloned? Just pull:

```bash
cd /d/Projects/rc3
git pull
```

You should see `AGENTS.md`, `TEAM_SETUP.md`, `tools/board`, `.github/ISSUE_TEMPLATE/message-board.md`.

## 4. Make the board script executable

```bash
chmod +x tools/board
```

## 5. Check BOARD_ISSUE

The board is issue **#1**, which is the script default, so **nothing to set**. Confirm only if the board issue number ever changes:

```bash
gh issue list --state open --json number,title --jq '.[] | "\(.number) \(.title)"'
```

If the `Message Board` issue is not `1`, set it for your session (and add it to your shell profile if you want it permanent):

```bash
export BOARD_ISSUE=<number>
```

## 6. Test connectivity

```bash
bash tools/board whoami
# -> UbaidUrRehmaanDar

bash tools/board unread
# -> the setup posts (or nothing if you already read them)

bash tools/board post "[Ubaid's Freebuff] [DONE] Laptop 2 connected, board works. @Rehan-Abrar"
```

The post must start with `[<human>'s <agent>]` or the script rejects it. A URL in the output means it worked — open <https://github.com/Rehan-Abrar/rc3/issues/1> to see it.

Then ask Rehan to confirm the post is visible on the board. **Laptop 2 is only "ready" after this test passes and Rehan sees the post.**

## 7. Read the rules before writing code

```bash
cat AGENTS.md
```

Non-negotiables from it:

- Run `bash tools/board unread` at task start, before every commit, and after every merge.
- Tag every post with one category: `[CONTRACT]`, `[BLOCKER]`, `[DONE]`, `[HANDOFF]`, `[WARNING]`.
- You (Agent B, Freebuff) own services, application logic, state, validation and tests.
  Rehan (Agent A, OpenCode) owns pages, components, styling and responsive UI.
- Shared files and config (`package.json`, lockfiles, build/lint config, CI, `.env*`, `AGENTS.md`) are **human-controlled**. Ask on the board, do not edit them.
- Do not install dependencies or add a framework unless a human says so.
- The competition problem is not released. **Do not start building the app.**

## 8. Optional live feed

To get pinged while you work, keep one loop running in a spare terminal:

```bash
while tools/board wait; do echo "--- new board post above: handle it, then re-arm ---"; done
```

Use `tools/board wait --interval 60` if both laptops share one GitHub token.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `board: gh not found` | Install the GitHub CLI, reopen Git Bash. |
| `board: cannot determine repo` | Run from inside the clone, or `export BOARD_REPO=Rehan-Abrar/rc3`. |
| `HTTP 404` on `unread`/`post` | Wrong `BOARD_ISSUE`, or you are not a collaborator. Check `gh auth status`, then `gh issue view 1`. |
| `post must start with [<human>'s <agent>]` | Prefix the text: `"[Ubaid's Freebuff] [DONE] ..."`. |
| `could not reach GitHub` | Network/proxy or TLS hiccup — retry; the read cursor is not advanced on failure. |
| `whoami` shows the wrong account | `gh auth switch`, then re-run. |
| Board reads repeat old posts | Delete your local cursor: `rm -rf .board/` (it is gitignored, safe to reset). |
