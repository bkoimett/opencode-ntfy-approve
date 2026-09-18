# DEV — roadmap, distribution, and commercialization

## Documentation map

- [DESIGN.md](DESIGN.md) — the MVP1 design this roadmap extends (§10)
- [PRD.md](PRD.md) — MVP1 scope and non-goals this roadmap stays clear of
- [WORKFLOW.md](WORKFLOW.md) — the milestones that ship MVP1 first
- [GUIDE.md](GUIDE.md) — setup (Termux relay) that Phase 2 aims to remove
- [README.md](README.md) — overview and quickstart
- [AGENTS.md](AGENTS.md) — agent rules that still apply to future phases

This file is forward-looking. Nothing here is built in MVP1. It exists so
the MVP1 architecture does not paint us into a corner.

## 1. Phases

### Phase 1 — MVP (current)
- OpenCode plugin.
- ntfy.sh public topics.
- Allow/Deny from phone.
- Termux relay + localhost fallback.

### Phase 2 — Remove the relay dependency
- Embed a Tailscale userspace node (`tsnet`) inside the plugin so the
  laptop joins the tailnet without sudo, without a system daemon, and
  without Termux.
- Result: notifications contain a stable `http://100.x.y.z:7342/approve`
  URL that works from any network.
- Decision mapping grows to three tiers: **Allow once** →
  `response: 'once'`, **Allow always** → `response: 'always'`, **Deny** →
  `response: 'reject'`. MVP1 only exposes the `'once'` / `'reject'`
  buttons; `'always'` is reserved for this phase.
- Question prompts (`AskUserQuestion`, tool id `question`): forward
  multiple-choice questions to ntfy with one answer button per choice;
  free-text questions stay in the TUI. Requires a `question` server API
  and a `question.asked`-style event or hook — neither is typed in the
  pinned SDK v1.18.31, so this needs a spike of its own.

### Phase 3 — Multi-agent adapters
Introduce an internal `AgentAdapter` interface:

```ts
interface AgentAdapter {
  name: string
  onPermissionRequested(handler: (req: PermissionRequest) => void): void
  respond(id: string, decision: 'allow' | 'deny'): Promise<void>
}
```

Adapters:
- `OpenCodeAdapter` (existing).
- `ClaudeCodeAdapter`.
- `CodexAdapter`.
- `AiderAdapter`.

The plugin core does not change. Only adapters are added.

### Phase 4 — Provider abstraction
Same pattern for notification providers:

```ts
interface NotificationProvider {
  send(msg: Notification): Promise<void>
}
```

Providers:
- `NtfyProvider` (existing).
- `TelegramProvider`.
- `DiscordProvider`.
- `WebPushProvider`.

### Phase 5 — Optional UI
A small web dashboard at `localhost:7342/dashboard` showing:
- Recent notifications.
- Pending approvals.
- Session history.

No mobile app. The phone stays on ntfy. A native app is only justified
if push reliability becomes a real problem, which it isn't with ntfy.

## 2. Distribution

### npm
- Package name: `opencode-ntfy-approve` (confirmed free at time of
  writing; re-verify before publish).
- Publish via GitHub Actions on tag push.
- `package.json` fields:
  - `"type": "module"`
  - `"bin": { "opencode-ntfy-approve": "./dist/cli.js" }`
  - `"files": ["dist", "README.md", "LICENSE"]`

### Versioning
- SemVer.
- `0.x` until Phase 3 ships.
- Breaking changes documented in `CHANGELOG.md`.

## 3. Security roadmap

- Phase 2: TLS on the callback server (self-signed + pinning).
- Phase 3: signed approval tokens (HMAC over `id + decision + expiry`).
- Phase 4: per-device pairing (phone generates a keypair, laptop stores
  the public key).

MVP1 relies on ntfy topic secrecy, which is adequate for personal use but
not for teams.

## 4. Monetization (optional, not required)

Three viable paths:

1. **Open-core.** Plugin stays MIT. Paid team features (shared topics,
   audit log, SSO) ship as a separate closed package.
2. **Hosted relay.** Free plugin, paid hosted relay that removes the
   Termux/Tailscale setup. $5/mo.
3. **Sponsorship.** GitHub Sponsors + npm funding field. No gating.

Do not decide now. Revisit after Phase 3 when there is real usage data.

## 5. Open-source strategy

- License: MIT.
- Code of Conduct: Contributor Covenant 2.1.
- Contribution guide: `CONTRIBUTING.md` (add in Phase 2).
- Issue templates: bug, feature, adapter request.
- Do not accept PRs that add dependencies without a written justification.

## 6. Competitive landscape

| Tool | Two-way approval | OpenCode support | Free |
|---|---|---|---|
| `opencode-ntfy` | No | Yes | Yes |
| `opencode-ntfy.sh` | No | Yes | Yes |
| `clawleash` | Partial (Telegram) | No | Yes |
| **opencode-ntfy-approve** | **Yes (ntfy actions)** | **Yes** | **Yes** |

The differentiator is interactive approval via ntfy action buttons.
Protect that. Every Phase 2+ decision should be evaluated against
"does this make the approval flow better?"

## 7. Metrics to watch (once published)

- npm weekly downloads.
- GitHub stars / forks.
- Issues opened per month.
- % of users who set `AGENTLINK_RELAY_URL` (proxy for two-way adoption).
- % of approvals that time out (proxy for relay reliability).

If relay adoption is low, Phase 2 (embedded Tailscale) becomes urgent.
If timeout rate is high, the relay UX is the bottleneck.

## 8. Explicit non-goals (long-term)

- Becoming a general chat client.
- Supporting every CLI agent under the sun.
- Building a mobile app.
- Self-hosting ntfy as a service.
- Enterprise SSO before Phase 4.

Stay small. Stay focused. The differentiator is one specific flow.


