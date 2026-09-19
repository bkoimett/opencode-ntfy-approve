import { randomUUID } from 'node:crypto';
import type { NtfyMessage } from './ntfy.js';
import { LOCALHOST_BASE } from './relay.js';
import { type Decision, type PendingRequestMap } from './server.js';

export type ApprovalTarget = {
  permissionID: string;
  sessionID: string;
  title: string;
};

export type DecisionResult = {
  decision: Decision;
  timedOut: boolean;
};

export const decisionToSdkResponse = (
  decision: Decision,
): 'once' | 'reject' => (decision === 'allow' ? 'once' : 'reject');

export function newApprovalId(): string {
  return randomUUID();
}

export function approvalMessage(
  target: ApprovalTarget,
  id: string,
  relay: string | null,
  port = 7342,
): NtfyMessage {
  const base = relay ?? LOCALHOST_BASE(port);
  const urlFor = (decision: Decision) =>
    `${base}/approve?id=${id}&decision=${decision}`;

  if (relay === null) {
    return {
      title: 'Permission needed',
      body:
        `Approve or deny from the laptop:\n` +
        `curl "${urlFor('allow')}"\n\n${target.title}`,
      priority: 5,
    };
  }

  return {
    title: 'Permission needed',
    body: target.title,
    priority: 5,
    actions: [
      `http, Allow, ${urlFor('allow')}, clear=true`,
      `http, Deny, ${urlFor('deny')}, clear=true`,
    ],
  };
}

export async function awaitDecision(
  requests: PendingRequestMap,
  id: string,
  timeoutMs: number,
): Promise<DecisionResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      requests.clear(id);
      resolve({ decision: 'deny', timedOut: true });
    }, timeoutMs);
    void requests.register(id).then((decision) => {
      clearTimeout(timer);
      resolve({ decision, timedOut: false });
    });
  });
}