import { beforeEach, describe, expect, it } from "vitest";
import { createUploadGrant, verifyUploadGrant } from "./upload-grant";

const SESSION_ID = "6bf35a8f-6422-4f48-8b87-cfd8d59f45ab";

describe("WhatsApp media upload grants", () => {
  beforeEach(() => {
    process.env.EVOLUTION_API_KEY = "existing-evolution-key-used-only-by-the-server";
  });

  it("round-trips a session-scoped grant for two hours", async () => {
    const grant = await createUploadGrant(SESSION_ID, { nowSeconds: 1_000 });

    await expect(verifyUploadGrant(grant, { nowSeconds: 8_199 })).resolves.toMatchObject({
      sessionId: SESSION_ID,
      expiresAt: 8_200,
    });
  });

  it("rejects an expired grant", async () => {
    const grant = await createUploadGrant(SESSION_ID, { nowSeconds: 1_000 });

    await expect(verifyUploadGrant(grant, { nowSeconds: 8_201 })).rejects.toThrow(
      "Link de envio expirado",
    );
  });

  it("rejects a grant whose payload was modified", async () => {
    const grant = await createUploadGrant(SESSION_ID, { nowSeconds: 1_000 });
    const [payload, signature] = grant.split(".");
    const forgedPayload = `${payload!.slice(0, -1)}${payload!.endsWith("a") ? "b" : "a"}`;

    await expect(
      verifyUploadGrant(`${forgedPayload}.${signature}`, { nowSeconds: 1_001 }),
    ).rejects.toThrow("Link de envio inv\u00e1lido");
  });

  it("fails closed when the existing server credential is absent", async () => {
    delete process.env.EVOLUTION_API_KEY;

    await expect(createUploadGrant(SESSION_ID)).rejects.toThrow(
      "Envio de m\u00eddia n\u00e3o configurado",
    );
  });
});
