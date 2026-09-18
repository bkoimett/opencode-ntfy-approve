# opencode-ntfy-approve

Approve or reject OpenCode tool permissions from your phone lock screen.

## Documentation map

- [GUIDE.md](GUIDE.md) — step-by-step setup for humans, no prior experience assumed
- [PRD.md](PRD.md) — product requirements and MVP1 scope
- [DESIGN.md](DESIGN.md) — architecture and design decisions
- [WORKFLOW.md](WORKFLOW.md) — milestone plan and checkpoint protocol
- [DEV.md](DEV.md) — forward-looking roadmap (Phases 2+)
- [AGENTS.md](AGENTS.md) — rules for AI agents working in this repo

Existing OpenCode + ntfy plugins only send one-way notifications. This one
is interactive: when OpenCode asks for permission, you get an ntfy
notification with **Allow** and **Deny** buttons. Tap one, and OpenCode
continues or stops.

## How it works

See [DESIGN.md](DESIGN.md) for the full architecture.

## Quickstart

**1. Install the ntfy app** on your Android phone (Play Store or F-Droid).
Subscribe to a random topic, e.g. `opencode-approve-a8f3k2m9`.

**2. Install the plugin** on your Ubuntu laptop:

    git clone https://github.com/<you>/opencode-ntfy-approve.git
    cd opencode-ntfy-approve
    npm install
    npm run build
    mkdir -p .opencode/plugins
    cp dist/plugin.js .opencode/plugins/opencode-ntfy-approve.js

**3. Configure** — create `.env` in the repo root:

    AGENTLINK_TOPIC=opencode-approve-a8f3k2m9
    AGENTLINK_APPROVAL_TIMEOUT=30
    AGENTLINK_PORT=7342

**4. Set up the relay** so your phone can reach the laptop:

- Primary path (recommended): Termux reverse SSH tunnel over Tailscale.
  See GUIDE.md Part C.
- Fallback path (zero setup): leave AGENTLINK_RELAY_URL unset. The
  notification body will include a copy-pasteable Termux curl command.

**5. Run OpenCode:**

    opencode

Trigger a tool that requires permission. You should receive an ntfy
notification with **Allow** and **Deny** buttons.

Full walkthrough: GUIDE.md.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| AGENTLINK_TOPIC | yes | — | ntfy topic name |
| AGENTLINK_RELAY_URL | no | unset | Relay URL the phone uses to reach the laptop (e.g. http://100.x.y.z:7342). If unset, fallback mode is used. |
| AGENTLINK_APPROVAL_TIMEOUT | no | 30 | Seconds before a pending approval auto-denies |
| AGENTLINK_PORT | no | 7342 | Local callback server port (bound to 127.0.0.1) |
| AGENTLINK_NTFY_SERVER | no | https://ntfy.sh | ntfy server (override for self-hosting) |

## Security

- The callback server binds to 127.0.0.1 only. No public inbound ports.
- The ntfy topic name acts as a shared secret. Use a long random suffix.
- Decisions are strictly allow or deny. Unknown request IDs are rejected.
- Timeout defaults to auto-deny — never auto-approve.

## License

MIT — see LICENSE.