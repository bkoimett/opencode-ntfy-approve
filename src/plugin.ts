import type { Plugin, PluginInput } from '@opencode-ai/plugin';
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

// OpenCode 1.18.31 emits `permission.asked` at runtime with an
// AskParams-shaped payload (no `title`). The pinned v1 SDK types this
// event as `permission.updated` with a different `Permission` shape, so
// the event must be matched by string and cast. See AGENTS.md §3.
type PermissionAskedEvent = {
  type: 'permission.asked';
  properties: {
    id: string;
    sessionID: string;
    permission: string;
    patterns?: string[];
    metadata?: Record<string, unknown>;
    always?: string[];
    tool?: { messageID: string; callID: string };
  };
};

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
    event: async ({ event }) => {
      try {
        const permissionEvent =
          event as unknown as PermissionAskedEvent;
        if (permissionEvent.type === 'permission.asked') {
          const { id: permissionID, sessionID, permission, patterns } =
            permissionEvent.properties;
          const approvalId = newApprovalId();
          const relay = getRelayUrl();
          try {
            await ntfy.send(
              approvalMessage(
                {
                  permissionID,
                  sessionID,
                  title:
                    patterns !== undefined && patterns.length > 0
                      ? `${permission}: ${patterns.join(' ')}`
                      : permission,
                },
                approvalId,
                relay,
                config.port,
              ),
            );
          } catch (err) {
            await logWarn(
              client,
              `failed to send approval notification: ${String(err)}`,
            );
            await respond(client, sessionID, permissionID, 'deny');
            return;
          }
          void (async () => {
            try {
              const { decision, timedOut } = await awaitDecision(
                requests,
                approvalId,
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
              await respond(client, sessionID, permissionID, decision);
            } catch (err) {
              await logWarn(
                client,
                `failed to resolve approval: ${String(err)}`,
              );
              await respond(client, sessionID, permissionID, 'deny');
            }
          })();
          return;
        }
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
  sessionID: string,
  permissionID: string,
  decision: Decision,
): Promise<void> {
  await client.postSessionIdPermissionsPermissionId({
    path: { id: sessionID, permissionID },
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