import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, loadDotEnv } from '../src/config.js';

test('loadDotEnv parses KEY=VALUE lines and ignores the rest', () => {
  const dots = loadDotEnv(
    () =>
      '# comment\n\nAGENTLINK_TOPIC=topic\nMALFORMED\nEMPTY=\n AGENTLINK_PORT = 9000 \n',
  );
  assert.deepEqual(dots, {
    AGENTLINK_TOPIC: 'topic',
    EMPTY: '',
    AGENTLINK_PORT: '9000',
  });
});

test('loadDotEnv returns empty when read returns null', () => {
  assert.deepEqual(loadDotEnv(() => null), {});
});

test('loadConfig fills gaps from .env', () => {
  const config = loadConfig(
    { AGENTLINK_TOPIC: 'from-real-env' },
    { AGENTLINK_PORT: '9000', AGENTLINK_APPROVAL_TIMEOUT: '10' },
  );
  assert.equal(config.topic, 'from-real-env');
  assert.equal(config.port, 9000);
  assert.equal(config.approvalTimeout, 10);
  assert.equal(config.server, 'https://ntfy.sh');
});

test('loadConfig: a real env variable wins over .env', () => {
  const config = loadConfig(
    { AGENTLINK_TOPIC: 'from-real-env' },
    { AGENTLINK_TOPIC: 'from-dotenv' },
  );
  assert.equal(config.topic, 'from-real-env');
});

test('loadConfig uses defaults when nothing is set', () => {
  const config = loadConfig({}, {});
  assert.equal(config.topic, null);
  assert.equal(config.server, 'https://ntfy.sh');
  assert.equal(config.port, 7342);
  assert.equal(config.approvalTimeout, 120);
});

test('loadConfig ignores non-positive numbers', () => {
  const config = loadConfig({ AGENTLINK_PORT: '0' }, { AGENTLINK_PORT: '-5' });
  assert.equal(config.port, 7342);
});