// ─── Email Sender (Resend) + VERP ───────────────────────────

export interface EmailParams {
  to: string;
  from: string;
  replyTo: string; // VERP: auth+{reply_token}@inbox.{domain}
  subject: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export interface EmailResult {
  id: string;
  status: string;
}

export class EmailSender {
  constructor(
    private apiKey: string,
    private domain: string,
  ) {}

  get verpDomain(): string {
    return `inbox.${this.domain}`;
  }

  /** Create a VERP reply-to address for tracking */
  verpAddress(replyToken: string): string {
    return `auth+${replyToken}@${this.verpDomain}`;
  }

  /** Send an email via Resend API */
  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: params.from,
          to: params.to,
          subject: params.subject,
          reply_to: params.replyTo,
          html: params.html,
          attachments: params.attachments?.map(a => ({
            filename: a.filename,
            content: a.content.toString("base64"),
            encoding: "base64",
          })),
        }),
      });
      const data = await res.json();
      return { id: data.id ?? "", status: res.ok ? "sent" : "error" };
    } catch (err) {
      return { id: "", status: "error" };
    }
  }

  /** Send authorization email with PDF attachment */
  async sendAuthorization(params: {
    to: string;
    arName: string;
    trackTitle: string;
    releaseDate: string;
    labels: string[];
    replyToken: string;
    pdfBuffer: Buffer;
    htmlContent: string;
  }): Promise<EmailResult> {
    const labelName = params.labels.join(" via ");
    const from = `${labelName} via A&R Digital <naoresponda@mail.${this.domain}>`;

    return this.send({
      to: params.to,
      from,
      replyTo: this.verpAddress(params.replyToken),
      subject: `Autorização de lançamento — ${params.trackTitle} (${params.releaseDate})`,
      html: params.htmlContent,
      attachments: [
        {
          filename: `Autorizacao_${params.trackTitle.replace(/\s+/g, "_")}_${params.labels[0]}_${new Date().toISOString().split("T")[0]!.replace(/-/g, "")}.pdf`,
          content: params.pdfBuffer,
        },
      ],
    });
  }
}
