# DESIGN — opencode-ntfy-approve

## Documentation map

- [PRD.md](PRD.md) — product requirements this design implements
- [README.md](README.md) — overview and quickstart
- [GUIDE.md](GUIDE.md) — setup guide that references these components
- [WORKFLOW.md](WORKFLOW.md) — milestones that build this architecture
- [DEV.md](DEV.md) — future phases that extend this design (§10)
- [AGENTS.md](AGENTS.md) — agent rules; §3 (hook contract) governs the plugin shape

## 1. Architecture
┌─────────────┐ ┌──────────────┐ ┌─────────┐
│ OpenCode │────▶│ Plugin │────▶│ ntfy │
│ CLI │◀────│ (Node.js) │◀────│ .sh │
└─────────────┘ └──────┬───────┘ └────┬────┘
│ │
┌──────┴──────┐ │
│ │ │
┌─────▼─────┐ ┌─────▼─────┐ │
│ Termux │ │ localhost │ │
│ SSH relay │ │ polling │ │
└─────┬─────┘ └─────┬─────┘ │
│ │ │
└──────┬──────┘ │
▼ │
┌─────────────┐ │
│ Android │◀───────────┘
│ ntfy app │
└─────────────┘

text

## 2. Components

### 2.1 Plugin (`src/plugin.ts`)
- Registered in OpenCode via `.opencode/plugins/opencode-ntfy-approve.ts`.
- Returns a **flat hook object** (not `{ hooks: {...} }`) — this is the
  OpenCode plugin contract. See AGENTS.md §Hook Contract.
- Subscribes to:
  - Flat hook `permission.ask` → send interactive notification, await a
    decision. (The SDK also emits the matching event `permission.updated`;
    the docs call that event `permission.asked`.)
  - Generic `event` hook → filter `session.idle` for "task complete" and
    `session.error` for error one-way notifications.

### 2.2 Callback server (`src/server.ts`)
- HTTP server bound to `127.0.0.1:7342` (no sudo required).
- Routes:
  - `GET /approve?id=<id>&decision=allow` → resolves pending promise.
  - `GET /approve?id=<id>&decision=deny` → resolves pending promise.
  - `GET /health` → returns `{ ok: true, relay: "<url|null>" }`.
- Server starts once on plugin init, lives for the session.

### 2.3 Relay detection (`src/relay.ts`)
- Reads `AGENTLINK_RELAY_URL` env var on startup and on every notification.
- If set → notification action buttons point at `<relay>/approve`.
- If unset → notification body includes a copy-pasteable Termux curl command
  targeting `http://127.0.0.1:7342/approve`.

### 2.4 ntfy client (`src/ntfy.ts`)
- Sends notifications via `POST https://ntfy.sh/<topic>`.
- Uses ntfy's `Actions` header to embed **Allow** / **Deny** buttons.
- Priority 5 for permission requests (bypasses DND).
- Priority 3 for completion / error notifications.

## 3. Approval flow (happy path — Option 2)

1. OpenCode fires a permission prompt (flat hook `permission.ask` / event
   `permission.updated`).
2. Plugin generates `id = randomUUID()`, stores a pending resolver.
3. Plugin POSTs to ntfy with `Actions: http, Allow, <relay>/approve?id=...&decision=allow, clear=true; http, Deny, <relay>/approve?id=...&decision=deny, clear=true`.
4. Phone receives notification with two buttons.
5. Developer taps **Allow**.
6. Phone POSTs to `<relay>/approve?id=...&decision=allow`.
7. Termux SSH reverse tunnel forwards to laptop's `127.0.0.1:7342`.
8. Plugin resolves the pending promise → calls
   `postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response: 'once' } })`.
9. OpenCode continues.

Decision mapping: **Allow** → `response: 'once'`, **Deny** →
`response: 'reject'`. MVP1 exposes only these two buttons;
`response: 'always'` is reserved for Phase 2 (see DEV.md §1 Phase 2).

## 4. Approval flow (fallback — Option 3)

Steps 1–4 identical. Then:

5. Developer opens Termux and runs the curl command shown in the notification body.
6. Same as steps 7–9 above.

The developer experience is worse, but the plugin's code path is identical.

## 5. Timeout behavior

- Default timeout: 120 seconds (`AGENTLINK_APPROVAL_TIMEOUT`).
- On timeout: plugin responds with `response: 'reject'` via
  `postSessionIdPermissionsPermissionId(...)`, then sends a follow-up ntfy
  notification: *"⏱ Approval timed out — action denied."*
- This is fail-safe: no accidental approvals.

## 6. Security model

- **No inbound ports exposed to the public internet.** The plugin binds to
  `127.0.0.1`. The relay (Termux SSH) is an outbound connection initiated
  from the phone, which is initiated from the laptop's ssh client — no
  listening socket on any public interface.
- **ntfy topic is the only shared secret.** Use a random suffix
  (e.g. `opencode-approve-a8f3k2m9`). Do not reuse across machines.
- **Decision is binary.** The callback URL accepts only `allow` or `deny`.
  Any other value is rejected with HTTP 400.
- **ID validation.** Every callback must carry a `id` matching a pending
  request. Unknown IDs are rejected with HTTP 404.
- **No command injection surface.** The plugin never executes strings from
  ntfy. It only calls the typed respond API
  (`postSessionIdPermissionsPermissionId` with `response`).

## 7. UI / UX direction

> **No AI-generated aesthetic.** No gradients-for-the-sake-of-gradients,
> no purple/blue neon, no glassmorphism clichés, no emoji-heavy copy,
> no "magical" language. Modern, restrained, professional — think Linear,
> Vercel, Stripe docs. When in doubt, less.

The **ntfy notification is the only UI surface**. It must look clean and
native to the ntfy app. Do not fight the platform with custom formatting,
HTML, or oversized text. Use plain sentences, a single relevant emoji at
most, and let the action buttons carry the interaction.

Examples:

- ✅ `Permission needed: run "npm test"` / [Allow] [Deny]
- ✅ `Task complete: auth module` (priority 3, no buttons)
- ❌ `🚀✨ YOUR AGENT NEEDS YOU! ✨🚀` (banned)

## 8. Configuration

Environment variables (all optional except `AGENTLINK_TOPIC`):

| Var | Default | Purpose |
|---|---|---|
| `AGENTLINK_TOPIC` | — | ntfy topic name (required) |
| `AGENTLINK_RELAY_URL` | unset | Public relay URL for action buttons |
| `AGENTLINK_APPROVAL_TIMEOUT` | `120` | Seconds before auto-deny |
| `AGENTLINK_PORT` | `7342` | Local callback server port |
| `AGENTLINK_NTFY_SERVER` | `https://ntfy.sh` | Override for self-hosted |

## 9. File layout
opencode-ntfy-approve/
├── src/
│ ├── plugin.ts # OpenCode plugin entry
│ ├── server.ts # Local HTTP callback server
│ ├── ntfy.ts # ntfy client
│ ├── relay.ts # Relay URL detection
│ └── types.ts
├── package.json
├── tsconfig.json
├── README.md
├── PRD.md
├── DESIGN.md
├── AGENTS.md
├── WORKFLOW.md
├── GUIDE.md
└── DEV.md

text

## 10. Future (documented in DEV.md, not built in MVP1)

- Tailscale userspace embedded node (removes Termux dependency).
- Self-hosted ntfy.
- Adapter interface for Claude Code / Codex / Aider.
- Web dashboard.
- npm publish under `opencode-ntfy-approve`.