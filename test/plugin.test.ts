import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { PluginInput } from '@opencode-ai/plugin';
import type { Event } from '@opencode-ai/sdk';
import { plugin } from '../src/plugin.js';

type CapturedPost = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

type Hooks = Awaited<ReturnType<typeof plugin>>;

async function startCapture(): Promise<{
  base: string;
  posts: CapturedPost[];
  server: ReturnType<typeof createServer>;
}> {
  const posts: CapturedPost[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = String(value);
      }
      posts.push({ url: req.url ?? '', headers, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: '1', time: Date.now() }));
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, posts, server };
}

async function freePort(): Promise<number> {
  const server = createNetServer();
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor<T>(poll: () => T | undefined, timeoutMs = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = poll();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function permissionAsked(sessionID: string): Event {
  return {
    type: 'permission.asked',
    properties: {
      id: `per_${sessionID}_1`,
      sessionID,
      permission: 'bash',
      patterns: ['echo from-test'],
      metadata: { command: 'echo from-test' },
      always: ['echo *'],
      tool: { messageID: 'msg_1', callID: 'call_1' },
    },
  } as unknown as Event;
}

function approvalUrlFrom(body: string): string {
  const match = /curl "([^"]+)"/.exec(body);
  assert.ok(match !== null, `no approval URL in body: ${body}`);
  return match[1];
}

let capture: Awaited<ReturnType<typeof startCapture>>;
let responded: Array<{ response: string }> = [];

before(async () => {
  capture = await startCapture();
});

after(async () => {
  await new Promise<void>((resolve) => capture.server.close(() => resolve()));
});

async function loadPlugin(env: {
  ntfyServer: string;
  port: number;
  approvalTimeout: number;
}): Promise<{
  hooks: Hooks;
  dispose: () => Promise<void>;
}> {
  process.env.AGENTLINK_TOPIC = 'test-topic';
  process.env.AGENTLINK_NTFY_SERVER = env.ntfyServer;
  process.env.AGENTLINK_PORT = String(env.port);
  process.env.AGENTLINK_APPROVAL_TIMEOUT = String(env.approvalTimeout);
  delete process.env.AGENTLINK_RELAY_URL;

  responded = [];
  const stubClient = {
    app: { log: async () => {} },
    postSessionIdPermissionsPermissionId: async (args: {
      body: { response: string };
    }) => {
      responded.push({ response: args.body.response });
    },
  } as unknown as PluginInput['client'];

  const hooks = await plugin({
    client: stubClient,
  } as unknown as PluginInput);
  return {
    hooks,
    dispose: async () => {
      await hooks.dispose?.();
    },
  };
}

test('approval flow: allow resolves to response: once', async () => {
  const ctx = await loadPlugin({
    ntfyServer: capture.base,
    port: await freePort(),
    approvalTimeout: 3,
  });
  try {
    const start = capture.posts.length;
    await ctx.hooks.event?.({ event: permissionAsked('ses-allow') });

    const post = await waitFor(() =>
      capture.posts.slice(start).find((p) => p.body.includes('Approve or deny')),
    );
    const allowUrl = approvalUrlFrom(post.body);
    const res = await fetch(allowUrl);
    assert.equal(res.status, 200);

    await waitFor(() => (responded.length > 0 ? responded[0] : undefined));
    assert.equal(responded[0].response, 'once');
  } finally {
    await ctx.dispose();
  }
});

test('approval flow: deny resolves to response: reject', async () => {
  const ctx = await loadPlugin({
    ntfyServer: capture.base,
    port: await freePort(),
    approvalTimeout: 3,
  });
  try {
    const start = capture.posts.length;
    await ctx.hooks.event?.({ event: permissionAsked('ses-deny') });

    const post = await waitFor(() =>
      capture.posts.slice(start).find((p) => p.body.includes('Approve or deny')),
    );
    const body = approvalUrlFrom(post.body);
    const denyUrl = body.replace('decision=allow', 'decision=deny');
    const res = await fetch(denyUrl);
    assert.equal(res.status, 200);

    await waitFor(() => (responded.length > 0 ? responded[0] : undefined));
    assert.equal(responded[0].response, 'reject');
  } finally {
    await ctx.dispose();
  }
});

test('approval flow: timeout responds reject and notifies', async () => {
  const ctx = await loadPlugin({
    ntfyServer: capture.base,
    port: await freePort(),
    approvalTimeout: 1,
  });
  try {
    await ctx.hooks.event?.({ event: permissionAsked('ses-timeout') });

    const start = capture.posts.length;
    await waitFor(() =>
      capture.posts
        .slice(start)
        .find((p) => p.headers['title'] === 'Approval timed out'),
    );

    await waitFor(() => (responded.length > 0 ? responded[0] : undefined));
    assert.equal(responded[0].response, 'reject');
  } finally {
    await ctx.dispose();
  }
});

test('approval flow: relay down falls back to deny', async () => {
  const deadPort = await freePort();
  const ctx = await loadPlugin({
    ntfyServer: `http://127.0.0.1:${deadPort}`,
    port: await freePort(),
    approvalTimeout: 3,
  });
  try {
    await ctx.hooks.event?.({ event: permissionAsked('ses-down') });

    await waitFor(() => (responded.length > 0 ? responded[0] : undefined));
    assert.equal(responded[0].response, 'reject');
    const start = capture.posts.length;
    const approvalPost = capture.posts
      .slice(start)
      .find((p) => p.body.includes('Approve or deny'));
    assert.equal(approvalPost, undefined);
  } finally {
    await ctx.dispose();
  }
});