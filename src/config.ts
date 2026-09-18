export type Config = {
  topic: string | null;
  server: string;
  port: number;
  approvalTimeout: number;
};

const DEFAULTS = {
  server: 'https://ntfy.sh',
  port: 7342,
  approvalTimeout: 30,
} as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    topic: env.AGENTLINK_TOPIC ?? null,
    server: env.AGENTLINK_NTFY_SERVER ?? DEFAULTS.server,
    port: parseNumber(env.AGENTLINK_PORT, DEFAULTS.port),
    approvalTimeout: parseNumber(
      env.AGENTLINK_APPROVAL_TIMEOUT,
      DEFAULTS.approvalTimeout,
    ),
  };
}

function parseNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}