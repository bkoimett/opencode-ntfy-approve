export type NtfyPriority = 1 | 2 | 3 | 4 | 5;

export type NtfyMessage = {
  title: string;
  body: string;
  priority?: NtfyPriority;
  tags?: string[];
  actions?: string[];
};

export class NtfyClient {
  readonly server: string;
  readonly topic: string;

  constructor(options: { server?: string; topic: string }) {
    this.server = (options.server ?? 'https://ntfy.sh').replace(/\/+$/, '');
    this.topic = options.topic;
  }

  async send(message: NtfyMessage): Promise<void> {
    const headers = new Headers({ Title: message.title });
    if (message.priority !== undefined) {
      headers.set('Priority', String(message.priority));
    }
    if (message.tags !== undefined && message.tags.length > 0) {
      headers.set('Tags', message.tags.join(','));
    }
    if (message.actions !== undefined && message.actions.length > 0) {
      headers.set('Actions', message.actions.join('; '));
    }
    const response = await fetch(`${this.server}/${this.topic}`, {
      method: 'POST',
      headers,
      body: message.body,
    });
    if (!response.ok) {
      throw new Error(
        `ntfy request failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}