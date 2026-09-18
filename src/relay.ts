export const LOCALHOST_BASE = (port: number): string =>
  `http://127.0.0.1:${port}`;

export function getRelayUrl(): string | null {
  const raw = process.env.AGENTLINK_RELAY_URL;
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }
  return url;
}