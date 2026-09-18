# opencode-ntfy-approve

Approve or reject OpenCode tool permissions from your phone lock screen.

## Documentation map

- [GUIDE.md](GUIDE.md) — step-by-step setup for humans, no prior experience assumed
- [PRD.md](PRD.md) — product requirements and MVP1 scope
- [DESIGN.md](DESIGN.md) — architecture and design decisions
- [WORKFLOW.md](WORKFLOW.md) — milestone plan and checkpoint protocol
- [DEV.md](DEV.md) — forward-looking roadmap (Phases 2+)
- [AGENTS.md](AGENTS.md) — rules for AI agents working in this repo

Existing OpenCode+ntfy plugins only send one-way notifications. This one is interactive: when OpenCode asks for permission, you get an ntfy notification with **Allow** and **Reject** buttons. Tap one, and OpenCode continues or stops.

## How it works

```
OpenCode (permission.asked)
    │
    ▼
[Plugin] ──► ntfy.sh ──► Phone notification
    ▲                         │
    │                         │ tap Allow/Reject
    └───── local callback ◄───┘
    │
    ▼
client.permission.respond()
```

No inbound ports exposed. The callback server binds to localhost only.

## Requirements

- OpenCode installed
- Node 20+
- ntfy app on Android or iOS
- A local tunnel (ngrok, Cloudflare Tunnel, or Tailscale) if your phone isn't on the same network

## Setup

**1. Create an ntfy topic**

Pick a random topic name, e.g. `opencode-approve-a8f3k2m9`. Subscribe to it in the ntfy app.

**2. Install the plugin**

```bash
mkdir -p ~/.config/opencode/plugins
curl -o ~/.config/opencode/plugins/opencode-ntfy-approve.ts \
  https://raw.githubusercontent.com/<you>/opencode-ntfy-approve/main/plugin.ts
```

**3. Configure**

Set environment variables in your shell profile:

```bash
export AGENTLINK_TOPIC="opencode-approve-a8f3k2m9"
export AGENTLINK_RELAY_URL="https://your-tunnel.ngrok.io"
export AGENTLINK_PORT="7342"
```

**4. Start a tunnel**

```bash
ngrok http 7342
# or
cloudflared tunnel --url http://localhost:7342
```

Copy the public URL (no `/approve` suffix) into `AGENTLINK_RELAY_URL`.

**5. Run OpenCode**

Trigger a tool that requires permission. You should get a notification with Allow/Reject buttons.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENTLINK_TOPIC` | yes | — | ntfy topic name |
| `AGENTLINK_RELAY_URL` | yes | — | Public URL of your tunnel, no `/approve` suffix |
| `AGENTLINK_APPROVAL_TIMEOUT` | no | `30` | Seconds before auto-deny |
| `AGENTLINK_PORT` | no | `7342` | Local callback server port |
| `AGENTLINK_NTFY_SERVER` | no | `https://ntfy.sh` | ntfy server (for self-hosting) |

## Security

- Topic name acts as a shared secret. Use a long random suffix.
- Callback server binds to `127.0.0.1` only.
- Nonces are single-use and expire with the permission timeout.
- No inbound ports on your machine — the tunnel handles routing.

**Do not use a guessable topic name.** Anyone who knows your topic can send you fake notifications.

## Known limitations

- Single machine only (MVP1)
- Binary approve/reject only (no free-text replies)
- Requires a tunnel for remote phones
- OpenCode only (not Claude Code, Codex, etc.)

## Contributing

Brief and direct:

1. Open an issue before starting work. Describe the problem and your proposed fix.
2. Wait for a maintainer to confirm the approach.
3. Fork, branch from `main`, make one focused change.
4. Run `npm test` if tests exist for the area you touched.
5. Open a PR referencing the issue. Keep the diff minimal.
6. Respond to review comments within 72 hours or the PR may be closed.

**Do not:**
- Submit PRs without an associated issue
- Mix refactoring with feature changes
- Add dependencies without justification
- Reformat unrelated code

## License

MIT


