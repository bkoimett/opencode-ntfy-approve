import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalMessage,
  awaitDecision,
  newApprovalId,
} from '../src/approval.js';
import { PendingRequestMap } from '../src/server.js';

const TARGET = {
  permissionID: 'perm-1',
  sessionID: 'session-1',
  title: 'write test.txt',
};

test('newApprovalId returns a uuid', () => {
  const a = newApprovalId();
  const b = newApprovalId();
  assert.match(a, /^[0-9a-f-]{36}$/);
  assert.notEqual(a, b);
});

test('approvalMessage with relay embeds Allow/Deny action buttons', () => {
  const msg = approvalMessage(TARGET, 'abc', 'https://relay.example.com');
  assert.equal(msg.title, 'Permission needed');
  assert.equal(msg.body, 'write test.txt');
  assert.equal(msg.priority, 5);
  assert.deepEqual(msg.actions, [
    'http, Allow, https://relay.example.com/approve?id=abc&decision=allow, clear=true',
    'http, Deny, https://relay.example.com/approve?id=abc&decision=deny, clear=true',
  ]);
});

test('approvalMessage without relay falls back to a curl command, no buttons', () => {
  const msg = approvalMessage(TARGET, 'abc', null);
  assert.equal(msg.actions, undefined);
  assert.match(
    msg.body,
    /curl "http:\/\/127\.0\.0\.1:7342\/approve\?id=abc&decision=allow"/,
  );
  assert.match(msg.body, /write test\.txt/);
});

test('awaitDecision resolves allow', async () => {
  const requests = new PendingRequestMap();
  const pending = awaitDecision(requests, 'abc', 5000);
  assert.equal(requests.resolve('abc', 'allow'), true);
  assert.deepEqual(await pending, { decision: 'allow', timedOut: false });
});

test('awaitDecision resolves deny', async () => {
  const requests = new PendingRequestMap();
  const pending = awaitDecision(requests, 'abc', 5000);
  assert.equal(requests.resolve('abc', 'deny'), true);
  assert.deepEqual(await pending, { decision: 'deny', timedOut: false });
});

test('awaitDecision times out to deny and clears the entry', async () => {
  const requests = new PendingRequestMap();
  const pending = awaitDecision(requests, 'abc', 50);
  assert.deepEqual(await pending, { decision: 'deny', timedOut: true });
  assert.equal(requests.resolve('abc', 'deny'), false);
});

test('awaitDecision is single-use after a decision', async () => {
  const requests = new PendingRequestMap();
  const pending = awaitDecision(requests, 'abc', 5000);
  assert.equal(requests.resolve('abc', 'allow'), true);
  await pending;
  assert.equal(requests.resolve('abc', 'deny'), false);
});