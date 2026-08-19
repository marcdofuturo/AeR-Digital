import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSessionById: vi.fn(),
  verifyUploadGrant: vi.fn(),
}));

vi.mock("@/lib/wa/session-store", () => ({ loadSessionById: mocks.loadSessionById }));
vi.mock("@/lib/wa/upload-grant", () => ({ verifyUploadGrant: mocks.verifyUploadGrant }));

import { requireWhatsappUploadSession } from "./upload-session";

describe("requireWhatsappUploadSession", () => {
  beforeEach(() => {
    mocks.verifyUploadGrant.mockReset().mockResolvedValue({ sessionId: "session-1" });
    mocks.loadSessionById.mockReset().mockResolvedValue({
      id: "session-1",
      tenantId: "tenant-1",
      phone: "5511999999999",
      step: "ask_audio",
      draft: {},
    });
  });

  it("accepts only an active media step for the signed session", async () => {
    await expect(requireWhatsappUploadSession("grant")).resolves.toMatchObject({
      id: "session-1",
      step: "ask_audio",
    });
  });

  it("rejects an expired or missing database session", async () => {
    mocks.loadSessionById.mockResolvedValueOnce(null);

    await expect(requireWhatsappUploadSession("grant")).rejects.toThrow(
      "Sess\u00e3o de envio expirada",
    );
  });

  it("rejects a grant after the flow has advanced", async () => {
    mocks.loadSessionById.mockResolvedValueOnce({
      id: "session-1",
      tenantId: "tenant-1",
      phone: "5511999999999",
      step: "confirm_file_metadata",
      draft: {},
    });

    await expect(requireWhatsappUploadSession("grant")).rejects.toThrow(
      "Arquivos j\u00e1 recebidos",
    );
  });
});
