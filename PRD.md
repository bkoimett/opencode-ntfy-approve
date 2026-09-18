# PRD — opencode-ntfy-approve

## Documentation map

- [README.md](README.md) — overview and quickstart
- [DESIGN.md](DESIGN.md) — the architecture that implements this PRD
- [WORKFLOW.md](WORKFLOW.md) — how the solution gets built, milestone by milestone
- [GUIDE.md](GUIDE.md) — end-user setup covering the MVP1 success criteria
- [DEV.md](DEV.md) — what comes after MVP1 (Phases 2+)
- [AGENTS.md](AGENTS.md) — rules for AI agents working in this repo

## 1. Problem

OpenCode CLI runs long agentic tasks on a developer's machine. When the agent
needs human approval (e.g. to run a shell command, edit a file, or proceed past
a permission gate), it blocks. The developer must be physically at the terminal
to respond. This breaks flow when the developer steps away — and is unusable at
a hackathon, at work, or anywhere the terminal is not on the same network as
the developer's phone.

Existing packages (`opencode-ntfy`, `opencode-ntfy.sh`) solve only **one-way
notifications**. No shipped npm package enables **interactive approval from the
phone** for OpenCode.

## 2. Solution

`opencode-ntfy-approve` is an OpenCode plugin that:

1. Listens for OpenCode's permission prompt (flat hook `permission.ask` /
   event `permission.updated`).
2. Sends an ntfy notification to the developer's phone containing
   **Allow** and **Deny** action buttons.
3. When the developer taps a button, the decision is relayed back to the
   laptop and sent to OpenCode via `postSessionIdPermissionsPermissionId(...)`
   — Allow → `'once'`, Deny → `'reject'`.
4. OpenCode continues (or aborts) with no developer at the keyboard.

## 3. Target user

- Solo developer running OpenCode on Ubuntu 22.04+.
- Frequently away from the terminal (meetings, hackathons, commuting).
- Uses Android phone.
- Cannot install system-level software on the host (no sudo).

## 4. MVP1 scope

### In scope
- OpenCode plugin (TypeScript, project-local install).
- ntfy.sh public topic (no self-hosting).
- `permission.ask` → notification with **Allow / Deny** buttons.
- Two relay paths for the button callback:
  - **Primary:** Termux reverse SSH tunnel (phone relays to laptop).
  - **Fallback:** localhost-only server + manual Termux curl command.
- Auto-detection of relay URL via `AGENTLINK_RELAY_URL` env var.
- 30-second approval timeout → auto-deny + fallback notification.
- One-way notifications for `session.idle` and `session.error` (bonus, low cost).

### Out of scope (MVP1)
- Free-text replies. Binary allow/deny only. No command injection surface.
- Multi-agent adapters (Claude Code, Codex, Aider). OpenCode only.
- Self-hosted ntfy.
- Mobile app or web dashboard.
- Authentication beyond ntfy topic secrecy.
- Persistent storage / SQLite / history.

## 5. Success criteria

MVP1 is done when:

1. `npm install` + `opencode` restart loads the plugin with no errors.
2. Triggering a permission prompt in OpenCode sends an ntfy notification
   to the phone within 2 seconds.
3. Tapping **Allow** from the phone lock screen causes OpenCode to proceed.
   (Maps to `postSessionIdPermissionsPermissionId(..., { response: 'once' })`.)
4. Tapping **Deny** causes OpenCode to abort the action cleanly.
5. Killing the SSH tunnel mid-session causes the next notification to
   automatically fall back to the localhost flow with no plugin restart.
6. Total setup time from zero to working demo: **≤ 3 hours.**

## 6. Non-goals

- Becoming a general-purpose agent communication layer. That is a Phase 3
  question, not MVP1.
- Replacing the OpenCode TUI. The TUI remains the primary interface; this
  plugin only handles the "developer is away" case.
- Supporting iOS in MVP1. Android + ntfy app only.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Work laptop has no sudo | Primary path uses Termux on the phone; laptop needs no privileged install. |
| Guest Wi-Fi blocks phone↔laptop | SSH reverse tunnel over Tailscale on the phone side. |
| ntfy.sh rate limits | ntfy has no designed-in rate limit; monitored but not a blocker. |
| OpenCode hook API changes | Pin to a known-good OpenCode version in GUIDE.md; document hook contract in AGENTS.md. |
| Two-way flow fails under time pressure | One-way fallback is always available and documented. Ship that if needed. |