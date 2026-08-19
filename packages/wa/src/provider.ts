// ─── WhatsApp Provider Interface ─────────────────────────────

export interface WhatsAppProvider {
  sendText(to: string, text: string): Promise<void>;
  sendPresence(to: string, status: "composing" | "paused"): Promise<void>;
  downloadMedia(messageId: string): Promise<{ url: string; mimeType: string }>;
  getInstanceHealth(): Promise<boolean>;
}

// ─── Mock Provider (for tests) ───────────────────────────────

export class MockProvider implements WhatsAppProvider {
  messages: Array<{ to: string; text: string }> = [];
  presenceEvents: Array<{ to: string; status: string }> = [];

  async sendText(to: string, text: string): Promise<void> {
    this.messages.push({ to, text });
  }

  async sendPresence(to: string, status: "composing" | "paused"): Promise<void> {
    this.presenceEvents.push({ to, status });
  }

  async downloadMedia(_messageId: string): Promise<{ url: string; mimeType: string }> {
    return { url: "mock://media.mp3", mimeType: "audio/mpeg" };
  }

  async getInstanceHealth(): Promise<boolean> {
    return true;
  }

  // Assertion helpers for tests
  lastMessage(): string {
    return this.messages[this.messages.length - 1]?.text ?? "";
  }

  lastMessages(count: number): string[] {
    return this.messages.slice(-count).map(m => m.text);
  }
}

// ─── Evolution Provider ──────────────────────────────────────

export class EvolutionProvider implements WhatsAppProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private instance: string,
  ) {}

  private async request(method: string, path: string, body?: unknown) {
    const url = `${this.baseUrl}/message/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      throw new Error(`Evolution API ${method} ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async sendText(to: string, text: string): Promise<void> {
    await this.request("POST", `sendText/${this.instance}`, {
      number: to,
      text,
    });
  }

  async sendPresence(to: string, status: "composing" | "paused"): Promise<void> {
    await this.request("POST", `sendPresence/${this.instance}`, {
      number: to,
      presence: status,
      delay: 0,
    });
  }

  async downloadMedia(messageId: string): Promise<{ url: string; mimeType: string }> {
    const data = await this.request("GET", `downloadMedia/${this.instance}?messageId=${messageId}`);
    return { url: data.url ?? data.base64, mimeType: data.mimeType ?? "application/octet-stream" };
  }

  async getInstanceHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${this.baseUrl}/instance/connectionState/${this.instance}`, {
        headers: { apikey: this.apiKey },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const data = await res.json();
      return data.instance?.status === "open";
    } catch {
      return false;
    }
  }
}
