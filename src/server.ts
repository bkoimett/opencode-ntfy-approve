import {
  createServer,
  type Server,
  type ServerResponse,
} from 'node:http';

export type Decision = 'allow' | 'deny';

export class PendingRequestMap {
  private readonly resolvers = new Map<string, (decision: Decision) => void>();

  register(id: string): Promise<Decision> {
    return new Promise((resolve) => {
      this.resolvers.set(id, resolve);
    });
  }

  resolve(id: string, decision: Decision): boolean {
    const resolve = this.resolvers.get(id);
    if (resolve === undefined) {
      return false;
    }
    this.resolvers.delete(id);
    resolve(decision);
    return true;
  }
}

export type CallbackServerOptions = {
  host?: string;
  port: number;
  requests: PendingRequestMap;
  getRelayUrl?: () => string | null;
};

export function createCallbackServer(
  options: CallbackServerOptions,
): Server {
  const getRelayUrl = options.getRelayUrl ?? (() => null);
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, relay: getRelayUrl() });
      return;
    }
    if (url.pathname === '/approve' && req.method === 'GET') {
      handleApprove(url, res, options.requests);
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  });
}

function handleApprove(
  url: URL,
  res: ServerResponse,
  requests: PendingRequestMap,
): void {
  const id = url.searchParams.get('id') ?? '';
  const decision = url.searchParams.get('decision');
  if (decision !== 'allow' && decision !== 'deny') {
    sendJson(res, 400, { error: 'invalid decision' });
    return;
  }
  if (requests.resolve(id, decision)) {
    sendJson(res, 200, { ok: true });
    return;
  }
  sendJson(res, 404, { error: 'unknown id' });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve(
        typeof address === 'object' && address !== null ? address.port : port,
      );
    });
  });
}

export function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}