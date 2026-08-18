import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";

const mocks = vi.hoisted(() => ({
  classifyResponse: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@ar/docs-gen/classifier", () => ({
  classifyResponse: mocks.classifyResponse,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: mocks.rpc })),
}));

const SECRET = "whsec_dGVzdHNlY3JldA==";

function signedRequest(payload: string, secret = SECRET) {
  const id = "msg_test_123";
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, payload);
  return new Request("https://aerdigital.pages.dev/api/webhooks/email/inbound", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: payload,
  });
}

describe("Resend inbound webhook", () => {
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
    mocks.classifyResponse.mockReset();
    mocks.rpc.mockReset();
    vi.resetModules();
  });

  it("fails closed when the signing secret is not configured", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("https://aerdigital.pages.dev/api/webhooks/email/inbound", {
      method: "POST",
      body: "{}",
    }) as never);

    expect(response.status).toBe(503);
  });

  it("rejects a forged signature", async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const { POST } = await import("./route");
    const request = signedRequest(JSON.stringify({ type: "email.received", data: {} }));
    request.headers.set("svix-signature", "v1,invalid");

    const response = await POST(request as never);

    expect(response.status).toBe(401);
  });

  it("accepts a valid signature and ignores unrelated event types", async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const { POST } = await import("./route");
    const request = signedRequest(JSON.stringify({ type: "email.delivered", data: {} }));

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ignored" });
  });

  it("retrieves a received email and persists a verified authorization reply", async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    process.env.RESEND_API_KEY = "re_test";
    mocks.classifyResponse.mockResolvedValue({
      decisao: "aprovado",
      nome_declarado: null,
      artista_declarado: null,
      condicoes: [],
      resumo: "Autorizacao confirmada",
      confianca: 0.91,
    });
    mocks.rpc.mockResolvedValue({
      data: [{ matched: true, recipient_status: "aprovado", authorization_status: "aprovado" }],
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      to: ["auth+reply-token@inbox.aerdigital.com.br"],
      text: "Eu autorizo o lancamento.",
      html: null,
    }), { status: 200 })));

    const { POST } = await import("./route");
    const request = signedRequest(JSON.stringify({
      type: "email.received",
      data: { email_id: "email-1" },
    }));
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "approved" });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_authorization_reply", expect.objectContaining({
      p_reply_token: "reply-token",
      p_decision: "aprovado",
      p_high_confidence: true,
    }));
  });
});
