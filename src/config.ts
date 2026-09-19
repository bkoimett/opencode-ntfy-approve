import { readFileSync } from 'node:fs';

export type Config = {
  topic: string | null;
  server: string;
  port: number;
  approvalTimeout: number;
};

const DEFAULTS = {
  server: 'https://ntfy.sh',
  port: 7342,
  approvalTimeout: 120,
} as const;

const DOTENV_PATH = '.env';

export function loadDotEnv(
  read: (path: string) => string | null = (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
  path: string = DOTENV_PATH,
): Record<string, string> {
  const text = read(path);
  if (text === null) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq < 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key === '') {
      continue;
    }
    out[key] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  dots: Record<string, string> = loadDotEnv(),
): Config {
  const merged: NodeJS.ProcessEnv = { ...dots, ...env };
  return {
    topic: merged.AGENTLINK_TOPIC ?? null,
    server: merged.AGENTLINK_NTFY_SERVER ?? DEFAULTS.server,
    port: parseNumber(merged.AGENTLINK_PORT, DEFAULTS.port),
    approvalTimeout: parseNumber(
      merged.AGENTLINK_APPROVAL_TIMEOUT,
      DEFAULTS.approvalTimeout,
    ),
  };
}

function parseNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}