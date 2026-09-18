import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalMessage } from '../src/approval.js';
import { getRelayUrl, LOCALHOST_BASE } from '../src/relay.js';

const ORIGINAL = process.env.AGENTLINK_RELAY_URL;

function withRelay<R>(value: string | undefined, fn: () => R): R {
  if (value === undefined) {
    delete process.env.AGENTLINK_RELAY_URL;
  } else {
    process.env.AGENTLINK_RELAY_URL = value;
  }
  try {
    return fn();
  } finally {
    if (ORIGINAL === undefined) {
      delete process.env.AGENTLINK_RELAY_URL;
    } else {
      process.env.AGENTLINK_RELAY_URL = ORIGINAL;
    }
  }
}

test('getRelayUrl returns the set relay URL', () => {
  withRelay('https://relay.example.com', () => {
    assert.equal(getRelayUrl(), 'https://relay.example.com');
  });
});

test('getRelayUrl returns null when unset', () => {
  withRelay(undefined, () => {
    assert.equal(getRelayUrl(), null);
  });
});

test('getRelayUrl returns null when empty or whitespace', () => {
  withRelay('   ', () => {
    assert.equal(getRelayUrl(), null);
  });
});

test('getRelayUrl strips trailing slashes', () => {
  withRelay('https://relay.example.com//', () => {
    assert.equal(getRelayUrl(), 'https://relay.example.com');
  });
});

test('getRelayUrl returns null for a non-http scheme', () => {
  withRelay('ftp://relay.example.com', () => {
    assert.equal(getRelayUrl(), null);
  });
});

test('LOCALHOST_BASE builds the local fallback root', () => {
  assert.equal(LOCALHOST_BASE(7342), 'http://127.0.0.1:7342');
});

test('relay set vs unset changes the button target', () => {
  const target = { permissionID: 'p1', sessionID: 's1', title: 'run test' };
  const relayMessage = withRelay('https://relay.example.com', () =>
    approvalMessage(target, 'abc', getRelayUrl()),
  );
  assert.deepEqual(relayMessage.actions, [
    'http, Allow, https://relay.example.com/approve?id=abc&decision=allow, clear=true',
    'http, Deny, https://relay.example.com/approve?id=abc&decision=deny, clear=true',
  ]);

  const fallbackMessage = withRelay(undefined, () =>
    approvalMessage(target, 'abc', getRelayUrl()),
  );
  assert.equal(fallbackMessage.actions, undefined);
  assert.match(
    fallbackMessage.body,
    /127\.0\.0\.1:7342\/approve\?id=abc&decision=allow/,
  );
  assert.notEqual(fallbackMessage.body, relayMessage.body);
});