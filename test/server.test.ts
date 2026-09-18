import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  close,
  createCallbackServer,
  listen,
  PendingRequestMap,
} from '../src/server.js';

type TestServer = {
  base: string;
  requests: PendingRequestMap;
  server: ReturnType<typeof createCallbackServer>;
};

async function startServer(): Promise<TestServer> {
  const requests = new PendingRequestMap();
  const server = createCallbackServer({ port: 0, requests });
  const port = await listen(server, '127.0.0.1', 0);
  return { base: `http://127.0.0.1:${port}`, requests, server };
}

test('GET /health returns ok and relay', async () => {
  const ctx = await startServer();
  try {
    const res = await fetch(`${ctx.base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, relay: null });
  } finally {
    await close(ctx.server);
  }
});

test('GET /approve with unknown id returns 404', async () => {
  const ctx = await startServer();
  try {
    const res = await fetch(`${ctx.base}/approve?id=unknown&decision=allow`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'unknown id' });
  } finally {
    await close(ctx.server);
  }
});

test('GET /approve with invalid decision returns 400 and does not consume id', async () => {
  const ctx = await startServer();
  try {
    const pending = ctx.requests.register('abc');
    const res = await fetch(`${ctx.base}/approve?id=abc&decision=maybe`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'invalid decision' });
    const resolved = ctx.requests.resolve('abc', 'deny');
    assert.equal(resolved, true);
    assert.equal(await pending, 'deny');
  } finally {
    await close(ctx.server);
  }
});

test('GET /approve with valid id and allow resolves the pending request', async () => {
  const ctx = await startServer();
  try {
    const pending = ctx.requests.register('abc');
    const res = await fetch(`${ctx.base}/approve?id=abc&decision=allow`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(await pending, 'allow');
  } finally {
    await close(ctx.server);
  }
});

test('GET /approve with deny resolves to deny', async () => {
  const ctx = await startServer();
  try {
    const pending = ctx.requests.register('abc');
    const res = await fetch(`${ctx.base}/approve?id=abc&decision=deny`);
    assert.equal(res.status, 200);
    assert.equal(await pending, 'deny');
  } finally {
    await close(ctx.server);
  }
});

test('pending request is single-use', async () => {
  const ctx = await startServer();
  try {
    ctx.requests.register('abc');
    const first = await fetch(`${ctx.base}/approve?id=abc&decision=allow`);
    assert.equal(first.status, 200);
    const second = await fetch(`${ctx.base}/approve?id=abc&decision=deny`);
    assert.equal(second.status, 404);
  } finally {
    await close(ctx.server);
  }
});

test('GET /approve with missing id returns 404', async () => {
  const ctx = await startServer();
  try {
    const res = await fetch(`${ctx.base}/approve?decision=allow`);
    assert.equal(res.status, 404);
  } finally {
    await close(ctx.server);
  }
});