# WORKFLOW — opencode-ntfy-approve

## Documentation map

- [PRD.md](PRD.md) — MVP1 scope and success criteria the milestones deliver
- [AGENTS.md](AGENTS.md) — git workflow and subagent rules (§4–§6)
- [DESIGN.md](DESIGN.md) — the architecture these milestones build
- [GUIDE.md](GUIDE.md) — the demo each checkpoint verifies
- [README.md](README.md) — overview and quickstart
- [DEV.md](DEV.md) — phases beyond MVP1

This document defines how the AI builds the project: milestones, GitHub
issues, acceptance criteria, and the Git workflow. The AI reads this file,
implements one milestone at a time, and **stops at each checkpoint** for
human review before continuing.

## 1. Ground rules

- One milestone per session. No chaining.
- After each milestone: run `npm run lint && npm test`, then **stop**.
- The human reviews the diff, runs the demo, and replies "go" to proceed.
- Every issue is created with `gh issue create` before any code is written.
- Every PR references its issue with `Closes #<n>`.
- Never commit to `main`. Branch per issue.

## 2. Milestones

### Milestone 0 — Repo bootstrap
**Goal:** empty but valid TypeScript project that installs and lints.

Issues:
- `#1` — `chore: initialize package.json, tsconfig, eslint`
- `#2` — `chore: add @opencode-ai/plugin dependency`
- `#3` — `docs: add README skeleton and license (MIT)`

Acceptance:
- `npm install` succeeds.
- `npm run lint` succeeds.
- `npm test` runs (even with zero tests).

**Checkpoint 0 → wait for human "go".**

### Milestone 1 — ntfy one-way notification
**Goal:** plugin loads in OpenCode and sends a plain notification on
`session.idle`. No buttons yet.

Issues:
- `#5` — `feat: plugin skeleton with flat hook contract`
- `#6` — `feat: ntfy client posting to AGENTLINK_TOPIC`
- `#7` — `feat: send notification on session.idle`
- `#8` — `test: ntfy client unit tests`

Acceptance:
- Restart OpenCode with plugin installed.
- Run any task. Phone receives one notification when it finishes.
- No errors in OpenCode logs.

**Checkpoint 1 → wait for human "go".**

### Milestone 2 — local callback server
**Goal:** HTTP server on `127.0.0.1:7342` that resolves pending approvals.

Issues:
- `#10` — `feat: callback server with /approve and /health`
- `#11` — `feat: pending-request map with UUID keys`
- `#12` — `test: server rejects unknown id and invalid decision`

Acceptance:
- `curl http://127.0.0.1:7342/health` returns `{ ok: true }`.
- `curl 'http://127.0.0.1:7342/approve?id=unknown&decision=allow'` → 404.
- `curl 'http://127.0.0.1:7342/approve?id=<valid>&decision=maybe'` → 400.
- `curl 'http://127.0.0.1:7342/approve?id=<valid>&decision=allow'` → 200.

**Checkpoint 2 → wait for human "go".**

### Milestone 3 — interactive approval (the differentiator)
**Goal:** a permission request in OpenCode sends an ntfy notification with
Allow/Deny buttons (or a curl fallback) that resolve the pending request.

Issues (plan numbers; the spike was filed on GitHub as **#29**, see the note
below):
- `#13` — `spike: verify permission.ask fires in pinned OpenCode v1.18.31`
- `#14` — `feat: subscribe to permission.asked event`
- `#15` — `feat: ntfy Actions header with Allow/Deny buttons`
- `#16` — `feat: resolve pending request via postSessionIdPermissionsPermissionId`
- `#17` — `feat: timeout auto-denies and notifies`
- `#18` — `test: allow path, deny path, timeout path`

Decision mapping: **Allow** → `response: 'once'`, **Deny** →
`response: 'reject'`, timeout → `response: 'reject'`. There is no
`client.permission.respond()` in the pinned SDK (v1.18.31). See AGENTS.md §3.

`#13` spike outcome (verified 2026-09-18 on v1.18.31): the flat
`permission.ask` hook **does not fire** in run mode (opencode emits
`asking id=...` and auto-rejects without dispatching the hook). The SDK
**event** `permission.asked` **does fire** with runtime properties
`{ id, sessionID, permission, patterns, metadata, always, tool }` (no
`title`); `permission.replied` also fires. M3 therefore implements the
event fallback: subscribe in the `event` hook, match `permission.asked`,
respond via `postSessionIdPermissionsPermissionId`. Outcome documented in
the M3 PR (plan `#13` was created on GitHub as issue **#29** because `#13`
already exists historically — surface this mapping at Checkpoint 3).

Deploy layout (learned during end-to-end verification): opencode
auto-discovers every top-level `.js` under `.opencode/plugins/` as a plugin
and invokes its exports with the plugin input. Loose helper modules must
therefore live under `.opencode/plugins/lib/`; only the entry
`opencode-ntfy-approve.js` may sit at the top level. The old single-file
bundle layout also works (entry only). Do not put `config.js`, `ntfy.js`,
etc. loose at the top level.

Acceptance:
- Trigger a permission prompt in OpenCode.
- Phone receives notification with two buttons.
- Tapping **Allow** → OpenCode proceeds.
- Tapping **Deny** → OpenCode aborts cleanly.
- Ignoring for the configured timeout (default 30s) → OpenCode denies,
  phone gets a timeout notice.

**Checkpoint 3 → wait for human "go".**

### Milestone 4 — relay detection and fallback
**Goal:** primary path uses `AGENTLINK_RELAY_URL` if set; fallback
includes a copy-pasteable curl command in the notification body.

Issues:
- `#19` — `feat: relay URL detection from env`
- `#20` — `feat: fallback notification body with curl command`
- `#21` — `test: relay set vs unset changes button target`

Acceptance:
- With relay set: buttons point at relay URL.
- Without relay: notification body includes a working Termux curl command.
- Killing the relay mid-session → next notification auto-falls back.

**Checkpoint 4 → wait for human "go".**

### Milestone 5 — polish and docs
**Goal:** README, GUIDE.md, and DEV.md accurate; demo reproducible.

Issues:
- `#22` — `docs: README quickstart`
- `#23` — `docs: GUIDE.md end-to-end setup`
- `#24` — `docs: DEV.md roadmap`
- `#25` — `chore: tag v0.1.0`

Acceptance:
- A fresh clone + GUIDE.md steps produce a working demo in ≤ 3 hours.

**Checkpoint 5 → done.**

## 3. Definition of done (every issue)

- Code merged to `main` via PR.
- Tests pass.
- Lint passes.
- No new dependency without justification in the PR body.
- Acceptance criteria above met and demonstrated.

## 4. Git workflow

```
main
 │
 ├── feature/1-repo-bootstrap
 ├── feature/5-plugin-skeleton
 ├── feature/10-callback-server
 ├── feature/13-hook-spike
 ├── feature/19-relay-detection
 └── feature/22-readme
```

Commands the AI will run per issue:

```bash
gh issue create --title "..." --body "..."
git checkout -b feature/<n>-<slug>
# ... implement ...
git add -A && git commit -m "feat: ..."
git push -u origin feature/<n>-<slug>
gh pr create --fill --base main
# wait for human review
```

## 5. Checkpoint protocol

At the end of each milestone, the AI outputs:

```
=== CHECKPOINT <n> ===
Branch: feature/<n>-<slug>
Demo: <exact command the human runs>
Expected: <what the human should see>
Status: waiting for human "go"
```

Then it stops. No further tool calls until the human replies.

## 6. Emergency fallback

If Milestone 3 does not pass Checkpoint 3 within the hackathon window,
**ship Milestones 0–2 plus a one-way notification path**. Document
interactive approval as "in progress" in README.md. Do not stay up
debugging. A working one-way notification beats a broken two-way attempt.

