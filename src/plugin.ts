import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config.js';
import { NtfyClient } from './ntfy.js';

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

  return {
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