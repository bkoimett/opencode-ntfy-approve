# RUN.md

Quick reference for bringing the whole stack up after a reboot.

## Prerequisites (one-time, already done)

- Termux + Tailscale on phone, authenticated
- `sshd` running in Termux, password set
- Laptop Tailscale authenticated
- Repo cloned at `~/benjie/opencode-ntfy-approve`, built once
- ntfy app subscribed to `opencode-approve-<your-topic>`

## Every restart — 3 terminals

### Terminal 1 — Phone (Termux)

Open Termux. Then:

```bash
sshd
pgrep sshd        # confirm running
tailscale status  # confirm daemon alive
```

If `tailscale status` says the daemon isn't running:

```bash
tailscale-cli up
```

Get your phone's Tailscale IP (should still be `100.95.231.122`):

```bash
tailscale ip -4
```

### Terminal 2 — Laptop (SSH tunnel)

```bash
ssh -p 8022 -R 7342:127.0.0.1:7342 u0_a248@100.95.231.122
```

Leave this terminal open. It's the tunnel. You'll land in a Termux prompt — that's fine, don't type anything here.

### Terminal 3 — Laptop (OpenCode)

```bash
cd ~/benjie/opencode-ntfy-approve

# rebuild + redeploy in case anything changed
npm run build
cp dist/src/*.js .opencode/plugins/
cp dist/src/plugin.js .opencode/plugins/opencode-ntfy-approve.js

# env vars (needed every new shell)
export AGENTLINK_TOPIC=opencode-approve-<your-topic>
export AGENTLINK_RELAY_URL=http://100.95.231.122:7342

# start
opencode
```

Watch for: `[opencode-ntfy-approve] listening on 127.0.0.1:7342`

## Verify

**Terminal 4 (or reuse Terminal 3's shell before starting OpenCode):**

```bash
curl http://127.0.0.1:7342/health
```

Expected: `{"ok":true,"relay":"http://100.95.231.122:7342"}`

**Then in Termux (Terminal 2, after SSH lands you there):**

```bash
curl http://127.0.0.1:7342/health
```

Same expected output. If both pass, the tunnel is live.

## Test the permission flow

In OpenCode:

```
Use the bash tool to run: echo allow-path-ok
```

Phone should buzz with a **Permission needed** notification and Allow/Deny buttons. Tap one.

## If something breaks

| Symptom | Fix |
|---|---|
| `pkill -f opencode` doesn't kill it | `pgrep -af opencode` then `kill -9 <pid>` |
| Plugin log says `AGENTLINK_TOPIC is not set` | Re-run the `export` lines in Terminal 3 |
| `curl health` fails on laptop | OpenCode isn't running or plugin didn't load — check Terminal 3 logs |
| `curl health` fails in Termux | Tunnel dropped — re-run Terminal 2's SSH command |
| Phone no notification | Check topic spelling, then `curl -d "test" ntfy.sh/<topic>` from laptop |
| 404 on button tap | Tap took longer than `AGENTLINK_APPROVAL_TIMEOUT` (default 120s) — the approval auto-denied. Re-request or raise the timeout in `.env` and restart OpenCode. |

## Stop everything

```bash
# Terminal 3
pkill -f opencode

# Terminal 2
exit   # closes SSH tunnel

# Terminal 1 (Termux)
pkill sshd   # optional
```

---

## Tip: make it a script

Save this as `start-stack.sh` in the repo:

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
npm run build
cp dist/src/*.js .opencode/plugins/
cp dist/src/plugin.js .opencode/plugins/opencode-ntfy-approve.js

if [ -z "$AGENTLINK_TOPIC" ]; then
  echo "AGENTLINK_TOPIC not set. Run: export AGENTLINK_TOPIC=opencode-approve-<topic>"
  exit 1
fi
if [ -z "$AGENTLINK_RELAY_URL" ]; then
  echo "AGENTLINK_RELAY_URL not set. Run: export AGENTLINK_RELAY_URL=http://100.95.231.122:7342"
  exit 1
fi

echo "Starting OpenCode with AGENTLINK_TOPIC=$AGENTLINK_TOPIC"
echo "Relay: $AGENTLINK_RELAY_URL"
opencode
```

Then every restart, Terminal 3 becomes:

```bash
cd ~/benjie/opencode-ntfy-approve
export AGENTLINK_TOPIC=opencode-approve-<your-topic>
export AGENTLINK_RELAY_URL=http://100.95.231.122:7342
./start-stack.sh
```
