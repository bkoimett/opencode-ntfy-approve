import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NtfyClient } from '../src/ntfy.js';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const realFetch = globalThis.fetch;

function installFetchHandler(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call.url, init);
  };
  return calls;
}

function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

test.afterEach(() => {
  restoreFetch();
});

test('posts to <server>/<topic> with default server', async () => {
  const calls = installFetchHandler(() => Promise.resolve(new Response('ok')));
  const client = new NtfyClient({ topic: 'opencode-approve-test' });
  await client.send({ title: 'hi', body: 'hello' });
  assert.equal(calls[0].url, 'https://ntfy.sh/opencode-approve-test');
});

test('uses a custom server without trailing slash duplication', async () => {
  const calls = installFetchHandler(() => Promise.resolve(new Response('ok')));
  const client = new NtfyClient({
    topic: 'topic-x',
    server: 'https://ntfy.example.com/',
  });
  await client.send({ title: 'hi', body: 'hello' });
  assert.equal(calls[0].url, 'https://ntfy.example.com/topic-x');
});

test('sets Title, Priority and Tags headers and a text body', async () => {
  const calls = installFetchHandler(() => Promise.resolve(new Response('ok')));
  const client = new NtfyClient({ topic: 'topic' });
  await client.send({
    title: 'Task complete',
    body: 'all good',
    priority: 3,
    tags: ['white_check_mark'],
  });
  assert.equal(calls[0].init?.method, 'POST');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('Title'), 'Task complete');
  assert.equal(headers.get('Priority'), '3');
  assert.equal(headers.get('Tags'), 'white_check_mark');
  assert.equal(calls[0].init?.body, 'all good');
});

test('omits Priority and Tags when not provided', async () => {
  const calls = installFetchHandler(() => Promise.resolve(new Response('ok')));
  const client = new NtfyClient({ topic: 'topic' });
  await client.send({ title: 'plain', body: 'body' });
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('Priority'), null);
  assert.equal(headers.get('Tags'), null);
});

test('sends Actions header when provided', async () => {
  const calls = installFetchHandler(() => Promise.resolve(new Response('ok')));
  const client = new NtfyClient({ topic: 'topic' });
  await client.send({
    title: 'Permission needed',
    body: 'write test.txt',
    actions: [
      'http, Allow, https://relay.example.com/approve?id=abc&decision=allow, clear=true',
    ],
  });
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(
    headers.get('Actions'),
    'http, Allow, https://relay.example.com/approve?id=abc&decision=allow, clear=true',
  );
});

test('throws on non-2xx response', async () => {
  installFetchHandler(() =>
    Promise.resolve(new Response('rate limited', { status: 429 })),
  );
  const client = new NtfyClient({ topic: 'topic' });
  await assert.rejects(
    () => client.send({ title: 'boom', body: 'body' }),
    /ntfy request failed: 429/,
  );
});