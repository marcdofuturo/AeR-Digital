// WhatsApp Provider + máquina de estados + handlers
// Implementation in Prompt 3

export interface WhatsAppProvider {
  sendText(to: string, text: string): Promise<void>;
  sendPresence(to: string, status: "composing" | "paused"): Promise<void>;
  downloadMedia(messageId: string): Promise<{ url: string; mimeType: string }>;
  getInstanceHealth(): Promise<boolean>;
}
