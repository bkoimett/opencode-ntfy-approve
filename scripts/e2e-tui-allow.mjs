// Interactive allow-path E2E for opencode-ntfy-approve (M3 acceptance:
// "Tapping Allow -> OpenCode proceeds").
//
// Manual harness. Requires:
//   - opencode 1.18.31 on PATH
//   - a model configured to actually run the bash tool
//   - `script` (util-linux)
//   - a built + deployed plugin in <repo>/.opencode/plugins/
//
// It must NOT be part of `npm test` (needs a live model + TUI).
//
// Usage: node scripts/e2e-tui-allow.mjs [opencode-ntfy-approve-repo]
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(process.argv[2] ?? process.cwd());
const PROMPT = 'Use the bash tool to run exactly this command and report its output: echo allow-e2e-ok';
const MARKER = 'allow-e2e-ok';
const TIMEOUT_MS = 120_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  const s = createNetServer();
  return new Promise((resolve, reject) => {
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startCapture() {
  const posts = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      posts.push({ url: req.url ?? '', headers: req.headers, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: '1' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, posts, server };
}

function fail(msg, detail = '') {
  console.error(`E2E FAIL: ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
}

async function waitFor(poll, timeoutMs, what) {
  const start = Date.now();
  for (;;) {
    const value = poll();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) fail(`timed out waiting for ${what}`);
    await sleep(250);
  }
}

const cmd = spawnSync('which', ['script', 'opencode'], { encoding: 'utf8' });
for (const dep of ['script', 'opencode']) {
  if (!cmd.stdout.includes(dep)) fail(`missing dependency: ${dep}`);
}

const scratch = join(tmpdir(), 'opencode-e2e-tui-allow');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

const pluginSrc = join(REPO, '.opencode');
if (!existsSync(pluginSrc)) fail(`plugin not deployed at ${pluginSrc}`);
symlinkSync(pluginSrc, join(scratch, '.opencode'));

const ntfyCapture = await startCapture();
const callbackPort = await freePort();

writeFileSync(
  join(scratch, 'opencode.json'),
  JSON.stringify({ permission: { bash: 'ask' } }, null, 2),
);
const env = {
  ...process.env,
  AGENTLINK_TOPIC: 'e2e-tui',
  AGENTLINK_NTFY_SERVER: `http://127.0.0.1:${ntfyCapture.port}`,
  AGENTLINK_PORT: String(callbackPort),
  AGENTLINK_APPROVAL_TIMEOUT: '60',
};
delete env.AGENTLINK_RELAY_URL;

const outFile = join(scratch, 'tui.out');
const child = spawn('script', ['-q', '-e', '-c', 'opencode', outFile], {
  cwd: scratch,
  env,
  stdio: ['pipe', 'inherit', 'inherit'],
  detached: true,
});

let exited = false;
child.on('exit', () => (exited = true));
const cleanup = () => {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  ntfyCapture.server.close();
};
process.on('exit', cleanup);

const readOut = () =>
  existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';

try {
  await sleep(6000); // allow TUI to boot
  child.stdin.write(PROMPT + '\r');
  console.log('prompt sent, waiting for permission.asked notification...');

  const post = await waitFor(
    () => ntfyCapture.posts.find((p) => p.headers.title === 'Permission needed'),
    TIMEOUT_MS,
    'ntfy "Permission needed" post',
  );
  const match = /curl "([^"]+)"/.exec(post.body);
  if (!match) fail('approval URL not found in notification', post.body);
  const url = match[1];
  console.log('notification received, tapping Allow:', url.slice(0, 80));

  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || json.ok !== true) {
    fail(`callback did not resolve allow (${res.status})`, JSON.stringify(json));
  }
  console.log('callback resolved (allow=once)');

  await waitFor(
    () => (readOut().includes(MARKER) ? MARKER : undefined),
    TIMEOUT_MS,
    `bash output "${MARKER}" in session`,
  );
  console.log('bash command executed in the session — ALLOW PATH PASS');
  console.log(`  repo:        ${REPO}`);
  console.log(`  callback:    127.0.0.1:${callbackPort}`);
  console.log(`  ntfy capture:${ntfyCapture.port}`);
  console.log(`  logs:        ${outFile}`);
} finally {
  cleanup();
}

// Allow proc exit after killing the detached group.
await sleep(300);
if (!exited) process.exit(0);