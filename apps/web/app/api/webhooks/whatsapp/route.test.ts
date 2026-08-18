import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReleaseDb: vi.fn(),
  expireAllSessionsForPhone: vi.fn(),
  expireSession: vi.fn(),
  forgetTenantByPhone: vi.fn(),
  loadSession: vi.fn(),
  process: vi.fn(),
  registerIdentity: vi.fn(),
  resolveTenantByCode: vi.fn(),
  resolveTenantByPhone: vi.fn(),
  saveSession: vi.fn(),
  sendText: vi.fn(),
}));

vi.mock("@ar/wa/machine", () => ({
  StepMachine: vi.fn().mockImplementation(() => ({
    process: mocks.process,
  })),
}));

vi.mock("@ar/wa/provider", () => ({
  EvolutionProvider: vi.fn().mockImplementation(() => ({
    sendText: mocks.sendText,
  })),
}));

vi.mock("@/lib/wa/handler-db", () => ({
  createHandlerDB: mocks.createReleaseDb,
}));

vi.mock("@/lib/wa/session-store", () => ({
  expireAllSessionsForPhone: mocks.expireAllSessionsForPhone,
  expireSession: mocks.expireSession,
  loadSession: mocks.loadSession,
  saveSession: mocks.saveSession,
}));

vi.mock("@/lib/wa/tenant-resolver", () => ({
  forgetTenantByPhone: mocks.forgetTenantByPhone,
  registerIdentity: mocks.registerIdentity,
  resolveTenantByCode: mocks.resolveTenantByCode,
  resolveTenantByPhone: mocks.resolveTenantByPhone,
}));

import { POST } from "./route";

const EVOLUTION_API_KEY = "test-existing-evolution-key";

function requestFor(text: string, options: { apiKey?: string; instance?: string } = {}) {
  return new Request("https://aerdigital.pages.dev/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.apiKey === undefined ? { apikey: EVOLUTION_API_KEY } : { apikey: options.apiKey }),
    },
    body: JSON.stringify({
      event: "MESSAGES_UPSERT",
      instance: options.instance ?? "atendimento",
      data: {
        key: {
          fromMe: false,
          remoteJid: "5511970416135@s.whatsapp.net",
        },
        message: { conversation: text },
      },
    }),
  });
}

describe("WhatsApp webhook route", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_KEY = EVOLUTION_API_KEY;
    process.env.EVOLUTION_BASE_URL = "https://evolution.example.com";
    process.env.EVOLUTION_INSTANCE = "atendimento";
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolveTenantByPhone.mockResolvedValue({
      tenant_id: "tenant-1",
      tenant_name: "SuperTime Digital",
    });
    mocks.resolveTenantByCode.mockResolvedValue({
      tenant_id: "tenant-1",
      tenant_name: "SuperTime Digital",
    });
    mocks.loadSession.mockResolvedValue({
      id: "session-1",
      step: "ask_release_format",
      draft: {},
    });
    mocks.process.mockResolvedValue({
      reply: "wrong path",
      nextStep: "ask_release_format",
      draft: {},
    });
  });

  it("fails closed when the existing Evolution credential is not configured", async () => {
    delete process.env.EVOLUTION_API_KEY;

    const response = await POST(requestFor("A7K9") as never);

    expect(response.status).toBe(503);
    expect(mocks.resolveTenantByCode).not.toHaveBeenCalled();
  });

  it("rejects forged webhook requests before processing their payload", async () => {
    const response = await POST(requestFor("A7K9", { apiKey: "forged" }) as never);

    expect(response.status).toBe(401);
    expect(mocks.resolveTenantByCode).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("ignores events sent for another Evolution instance", async () => {
    const response = await POST(requestFor("A7K9", { instance: "other-instance" }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ignored" });
    expect(mocks.resolveTenantByCode).not.toHaveBeenCalled();
  });

  it("fails closed instead of constructing a provider from an insecure URL", async () => {
    process.env.EVOLUTION_BASE_URL = "http://evolution.example.com";

    const response = await POST(requestFor("A7K9") as never);

    expect(response.status).toBe(503);
    expect(mocks.resolveTenantByCode).not.toHaveBeenCalled();
  });

  it("restarts the intake when a valid label code arrives during an active session", async () => {
    const response = await POST(requestFor("A7K9") as never);
    const json = await response.json();

    expect(json).toMatchObject({ status: "greeted", reply_sent: true });
    expect(mocks.resolveTenantByCode).toHaveBeenCalledWith("A7K9");
    expect(mocks.expireAllSessionsForPhone).toHaveBeenCalledWith("5511970416135");
    expect(mocks.registerIdentity).toHaveBeenCalledWith("5511970416135", "tenant-1");
    expect(mocks.saveSession).toHaveBeenCalledWith("5511970416135", "tenant-1", "ask_release_format", {});
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.sendText.mock.calls.at(-1)?.[1]).toContain("single");
  });

  it("does not report success when the first intake question cannot be sent", async () => {
    mocks.sendText.mockRejectedValueOnce(new Error("Evolution down"));

    const response = await POST(requestFor("A7K9") as never);
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toMatchObject({ status: "reply_failed", error_code: "send_failed" });
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("reports a safe auth error when Evolution rejects the first intake reply", async () => {
    mocks.sendText.mockRejectedValueOnce(new Error("Evolution API POST sendText/atendimento: 401 Unauthorized"));

    const response = await POST(requestFor("A7K9") as never);
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toMatchObject({ status: "reply_failed", error_code: "unauthorized" });
    expect(mocks.process).not.toHaveBeenCalled();
  });
});
