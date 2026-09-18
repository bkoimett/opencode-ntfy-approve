import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config.js';
import { NtfyClient } from './ntfy.js';
import { close, createCallbackServer, listen, PendingRequestMap } from './server.js';

const HOST = '127.0.0.1';

export const plugin: Plugin = async ({ client }) => {
  const config = loadConfig();
  if (!config.topic) {
    await client.app.log({
      body: {
        service: 'opencode-ntfy-approve',
        level: 'warn',
        message: 'AGENTLINK_TOPIC is not set; plugin disabled',
      },
    });
    return {};
  }

  const ntfy = new NtfyClient({ topic: config.topic, server: config.server });
  const requests = new PendingRequestMap();
  const server = createCallbackServer({
    port: config.port,
    requests,
    getRelayUrl: () => process.env.AGENTLINK_RELAY_URL ?? null,
  });
  await listen(server, HOST, config.port);
  await client.app.log({
    body: {
      service: 'opencode-ntfy-approve',
      level: 'info',
      message: `listening on ${HOST}:${config.port}`,
    },
  });

  return {
    dispose: async () => {
      await close(server);
    },
    event: async ({ event }) => {
      try {
        if (event.type === 'session.idle') {
          await ntfy.send({
            title: 'Task complete',
            body: `Session ${event.properties.sessionID} finished`,
            priority: 3,
            tags: ['white_check_mark'],
          });
        }
        if (event.type === 'session.error') {
          const error = event.properties.error;
          const message =
            error !== undefined && 'message' in error
              ? String(error.message)
              : 'An error occurred';
          await ntfy.send({
            title: 'Task error',
            body: message,
            priority: 3,
            tags: ['warning'],
          });
        }
      } catch (err) {
        await client.app.log({
          body: {
            service: 'opencode-ntfy-approve',
            level: 'warn',
            message: `failed to send notification: ${String(err)}`,
          },
        });
      }
    },
  };
};