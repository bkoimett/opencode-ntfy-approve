# GUIDE — setup for humans (no prior experience assumed)

## Documentation map

- [README.md](README.md) — overview and quickstart
- [PRD.md](PRD.md) — product requirements; this guide is how a human reaches MVP1
- [DESIGN.md](DESIGN.md) — how the plugin works under the hood
- [WORKFLOW.md](WORKFLOW.md) — milestone acceptance checks and demo script
- [DEV.md](DEV.md) — where the project goes after MVP1
- [AGENTS.md](AGENTS.md) — rules for AI agents contributing to this repo

This is your step-by-step manual. Follow it in order. Do not skip steps.
If a step fails, jump to §Troubleshooting.

You will need:
- Ubuntu 22.04+ laptop with OpenCode installed.
- Android phone.
- About 3 hours.
- No sudo required.

---

## Part A — Get ntfy working on your phone (10 min)

### A1. Install the ntfy app
- Open the Play Store or F-Droid on your Android phone.
- Search for **ntfy** (by Philipp Heckel).
- Install it. No account needed.

### A2. Pick a topic
A "topic" is like a private channel name. Anyone who knows it can read
and write. Make it random.

- Open the ntfy app.
- Tap **+** → **Subscribe to topic**.
- Enter: `opencode-approve-` followed by 8 random characters.
  Example: `opencode-approve-a8f3k2m9`.
- Write this topic down. You will need it in Part C.

### A3. Test it
On your Ubuntu laptop, open a terminal and run (replace `<topic>`):

```bash
curl -d "hello from laptop" ntfy.sh/<topic>
```

Your phone should buzz within 2 seconds. If it does not, see §Troubleshooting.

---

## Part B — Install the plugin on the laptop (20 min)

### B1. Check Node
```bash
node --version
```
Must be `v20` or higher. If not:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
(If you don't have sudo, ask your admin or use `nvm`.)

### B2. Clone the repo
```bash
git clone https://github.com/<you>/opencode-ntfy-approve.git
cd opencode-ntfy-approve
npm install
npm run build
```

### B3. Configure the topic
Create a file `.env` in the repo root:

```
AGENTLINK_TOPIC=opencode-approve-a8f3k2m9
AGENTLINK_APPROVAL_TIMEOUT=30
AGENTLINK_PORT=7342
```

Do not commit `.env`. It is in `.gitignore`.

### B4. Register the plugin with OpenCode
Copy the built plugin into OpenCode's project plugin directory:

```bash
mkdir -p .opencode/plugins
cp dist/src/plugin.js .opencode/plugins/opencode-ntfy-approve.js
```

### B5. Restart OpenCode
```bash
opencode
```

You should see a log line: `[opencode-ntfy-approve] listening on 127.0.0.1:7342`.

If not, see §Troubleshooting.

---

## Part C — Set up the phone → laptop relay (30 min)

This is the part that makes interactive approval work when your phone
is not on the same Wi-Fi as your laptop.

### C1. Install Termux on the phone
- F-Droid is recommended (the Play Store version is outdated).
- Install **Termux**.

### C2. Install Tailscale on both devices
On the phone:
- Install **Tailscale** from the Play Store.
- Sign in with a free account (Google/GitHub/email).

On the laptop (no sudo needed):
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```
If you don't have sudo, skip this and use the phone-only path in C5.

### C3. Get the laptop's Tailscale IP (if installed)
```bash
tailscale ip -4
```
Write it down. Example: `100.64.12.34`.

### C4. Open an SSH reverse tunnel from the laptop
In Termux on the phone, first install `openssh`:
```bash
pkg install openssh
sshd
```
Find the phone's Tailscale IP:
```bash
tailscale ip -4
```
Back on the laptop, run (replace `<phone-ip>`):
```bash
ssh -R 7342:127.0.0.1:7342 <phone-ip>
```
This forwards port 7342 from the phone to the laptop.

Now, from the phone, this should work:
```bash
curl http://127.0.0.1:7342/health
```
You should see `{"ok":true}`.

### C5. Tell the plugin about the relay
Export the relay URL before starting OpenCode:

```bash
export AGENTLINK_RELAY_URL=http://<phone-ip>:7342
opencode
```

The plugin will now put `http://<phone-ip>:7342/approve?...` into the
ntfy action buttons.

**If you skipped C4 (no Tailscale on laptop):** the plugin will fall back
to including a copy-pasteable curl command in the notification body.
When you receive a permission request, open Termux and run the command.
This is slower but works with zero setup.

---

## Part D — Run the demo (5 min)

1. With OpenCode running and the plugin loaded, ask it to do something
   that triggers a permission prompt. Example:
   > "Create a file called test.txt with the word hello."

2. OpenCode will pause and ask for permission.

3. Your phone buzzes: `Permission needed: write test.txt` with two buttons.

4. Tap **Allow**. OpenCode proceeds.

5. Tap **Deny** on a second request. OpenCode aborts.

If both work, MVP1 is done.

---

## Part E — Troubleshooting

### Phone does not receive notification
- Confirm the topic in the ntfy app matches `.env` exactly.
- Run the curl test from A3 again.
- Check `ntfy.sh` status: https://ntfy.sh/status

### Plugin does not load
- Check OpenCode logs for `[opencode-ntfy-approve]`.
- Confirm `.opencode/plugins/opencode-ntfy-approve.js` exists.
- Confirm `dist/src/plugin.js` was built (`npm run build`).

### Buttons do nothing
- Confirm `AGENTLINK_RELAY_URL` is set and reachable from the phone:
  ```bash
  curl http://<phone-ip>:7342/health
  ```
- If using Tailscale: confirm both devices show up in the Tailscale
  admin console and are on the same tailnet.

### Timeout fires too fast
- Increase `AGENTLINK_APPROVAL_TIMEOUT` in `.env` and restart OpenCode.

### "Invalid decision" on callback
- The callback only accepts `allow` or `deny`. Check the URL for typos.

### Firewall blocks the port
- If you have sudo: `sudo ufw allow 7342/tcp`.
- If not: use the Termux relay (Part C). The relay avoids the firewall
  entirely because the connection is outbound from the laptop.

---

## Part F — Emergency one-way fallback

If interactive approval does not work within your time budget:

1. Unset `AGENTLINK_RELAY_URL`.
2. The plugin will still send notifications on `permission.asked`,
   `session.idle`, and `session.error`.
3. Approvals happen manually via Termux curl commands shown in the
   notification body, or you return to the laptop.

Ship that. It is still useful. Do not stay up debugging.