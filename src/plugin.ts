import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Permission } from '@opencode-ai/sdk';
import {
  approvalMessage,
  awaitDecision,
  newApprovalId,
} from './approval.js';
import { loadConfig } from './config.js';
import { NtfyClient } from './ntfy.js';
import { getRelayUrl } from './relay.js';
import { type Decision, close, createCallbackServer, listen, PendingRequestMap } from './server.js';

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
    getRelayUrl,
  });
  await listen(server, HOST, config.port);
  await client.app.log({
    body: {
      service: 'opencode-ntfy-approve',
      level: 'info',
      message: `listening on ${HOST}:${config.port}`,
    },
  });
  const timeoutMs = config.approvalTimeout * 1000;

  return {
    dispose: async () => {
      await close(server);
    },
    'permission.ask': async (permission) => {
      const id = newApprovalId();
      const relay = getRelayUrl();
      try {
        await ntfy.send(
          approvalMessage(
            {
              permissionID: permission.id,
              sessionID: permission.sessionID,
              title: permission.title,
            },
            id,
            relay,
            config.port,
          ),
        );
      } catch (err) {
        await logWarn(client, `failed to send approval notification: ${String(err)}`);
        await respond(client, permission, 'deny');
        return;
      }
      void (async () => {
        try {
          const { decision, timedOut } = await awaitDecision(
            requests,
            id,
            timeoutMs,
          );
          if (timedOut) {
            await ntfy.send({
              title: 'Approval timed out',
              body: 'Action denied.',
              priority: 3,
              tags: ['hourglass_flowing_sand'],
            });
          }
          await respond(client, permission, decision);
        } catch (err) {
          await logWarn(client, `failed to resolve approval: ${String(err)}`);
          await respond(client, permission, 'deny');
        }
      })();
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
        await logWarn(client, `failed to send notification: ${String(err)}`);
      }
    },
  };
};

async function respond(
  client: PluginInput['client'],
  permission: Permission,
  decision: Decision,
): Promise<void> {
  await client.postSessionIdPermissionsPermissionId({
    path: { id: permission.sessionID, permissionID: permission.id },
    body: { response: decision === 'allow' ? 'once' : 'reject' },
  });
}

async function logWarn(client: PluginInput['client'], message: string) {
  await client.app.log({
    body: {
      service: 'opencode-ntfy-approve',
      level: 'warn',
      message,
    },
  });
}