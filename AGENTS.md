# AGENTS.md — opencode-ntfy-approve

This file governs how AI agents (OpenCode, Claude Code, Codex, etc.) behave
inside this repository. Read it fully before making any change.

## Documentation map

- [PRD.md](PRD.md) — MVP1 scope and success criteria
- [DESIGN.md](DESIGN.md) — architecture (§2) and voice rules (§7) this file enforces
- [WORKFLOW.md](WORKFLOW.md) — milestones and checkpoints (§7 depends on it)
- [README.md](README.md) — quickstart, user-facing prose owned by @docs
- [GUIDE.md](GUIDE.md) — end-user setup, user-facing prose owned by @docs
- [DEV.md](DEV.md) — forward-looking roadmap (must not conflict with §2)

## 1. Project in one sentence

An OpenCode plugin that sends ntfy notifications with Allow/Deny buttons so
a developer can approve agent actions from their phone.

## 2. Architectural rules (non-negotiable)

- The plugin **must not** open any public inbound port. Bind only to
  `127.0.0.1`. Public reachability is achieved via the Termux SSH relay,
  never by binding to `0.0.0.0`.
- The plugin **must not** execute strings received from ntfy. Callback
  decisions are strictly `allow` or `deny`; anything else → HTTP 400.
- The plugin **must** call `client.permission.respond()` — do not attempt
  to fake approval by writing to OpenCode's internal state.
- No database. No SQLite. No persistent history in MVP1.
- No new runtime dependencies beyond `node-fetch` (or native fetch) and
  `@opencode-ai/plugin`. Adding a dependency requires a note in the PR
  description explaining why the standard library is insufficient.

## 3. Hook contract (critical — read twice)

OpenCode plugins are **not** registered as `{ hooks: { ... } }`. The plugin
factory must return a **flat object** whose keys are hook names, and whose
`event` handler has the signature:

```ts
export const plugin = async (input: PluginInput): Promise<Hooks> => {
  return {
    event: async ({ event }) => { /* ... */ },
    // other flat hooks here
  }
}
session.created and tui.prompt.append are not plugin-triggerable.
Do not attempt to subscribe to them.

permission.asked and permission.updated are the correct hooks for
approval flows. If the OpenCode version in use exposes a different name,
document the mismatch in a PR comment — do not silently work around it.

If you are an AI agent and you are about to write hooks: { — stop. That
is wrong. See §3 again.

4. Subagents
Use only these three. Do not invent more.

@docs
Owns README.md, GUIDE.md, and any user-facing prose.

Must match the voice rules in DESIGN.md §7.

Never touches src/.

@tester
Owns test/.

Must cover: happy-path allow, happy-path deny, unknown id, timeout,
relay-down fallback, invalid decision value.

Runs npm test before handing back.

@reviewer
Reads the diff, checks against §2 and §3 of this file.

Blocks PRs that add dependencies without justification, bind to 0.0.0.0,
or use hooks: {.

The primary agent must delegate to these subagents rather than doing
their work inline. This saves tokens and keeps the primary agent focused
on orchestration.

5. Token-saving rules
Do not re-read files you just wrote. Trust your own output.

Do not summarize the whole repo before every change. Read only the file
you are editing and its direct imports.

When a task maps to a single file, delegate it to the relevant subagent
and stop. Do not open a planning session.

If you are unsure, ask the human one direct question. Do not speculate
across multiple messages.

6. Git workflow
Branches: feature/<issue-number>-<slug> (e.g. feature/003-callback-server).

Never commit to main.

Never git push --force.

Every PR must reference its issue: Closes #<n>.

Run npm run lint && npm test before opening a PR.

7. Checkpoints (mandatory)
After each milestone in WORKFLOW.md, stop and wait for human review
before starting the next milestone. Do not chain milestones in one session.
The human must reply "go" to proceed.

8. Never do this
Never send real ntfy topics, tokens, or personal URLs in commits.

Never log the full ntfy topic to stdout in production builds.

Never auto-approve a permission request. Timeout → deny.

Never bind the callback server to 0.0.0.0.

Never use hooks: { ... } — see §3.

Never add a subagent not listed in §4.

text
