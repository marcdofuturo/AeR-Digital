import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  advanceUploadSession: vi.fn(),
  completeUploadedMedia: vi.fn(),
  createHandlerDB: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  getPublicUrl: vi.fn(),
  info: vi.fn(),
  remove: vi.fn(),
  requireSession: vi.fn(),
  sendText: vi.fn(),
}));

vi.mock("@/lib/wa/upload-session", () => ({
  requireWhatsappUploadSession: mocks.requireSession,
}));
vi.mock("@/lib/wa/session-store", () => ({
  advanceUploadSession: mocks.advanceUploadSession,
}));
vi.mock("@/lib/wa/handler-db", () => ({ createHandlerDB: mocks.createHandlerDB }));
vi.mock("@ar/wa/handlers", () => ({ completeUploadedMedia: mocks.completeUploadedMedia }));
vi.mock("@ar/wa/provider", () => ({
  EvolutionProvider: vi.fn().mockImplementation(() => ({ sendText: mocks.sendText })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: mocks.createSignedUploadUrl,
        getPublicUrl: mocks.getPublicUrl,
        info: mocks.info,
        remove: mocks.remove,
      }),
    },
  }),
}));

import { completeWhatsappMediaUpload, createWhatsappMediaUpload } from "./actions";

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function wav() {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  view.setUint32(4, 36, true);
  bytes.set(new TextEncoder().encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 44_100, true);
  view.setUint32(28, 176_400, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  bytes.set(new TextEncoder().encode("data"), 36);
  return bytes;
}

describe("WhatsApp media upload actions", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
    process.env.EVOLUTION_API_KEY = "server-only-key";
    process.env.EVOLUTION_BASE_URL = "https://evolution.example.com";
    process.env.EVOLUTION_INSTANCE = "atendimento";
    for (const mock of Object.values(mocks)) mock.mockReset();

    mocks.requireSession.mockResolvedValue({
      id: "session-1",
      tenantId: "tenant-1",
      phone: "5511999999999",
      step: "ask_audio",
      draft: { release_format: "single" },
    });
    mocks.createSignedUploadUrl.mockResolvedValue({
      data: {
        token: "signed-upload-token",
        signedUrl: "https://project-ref.supabase.co/storage/v1/object/upload/sign/release-assets/path?token=signed-upload-token",
      },
      error: null,
    });
    mocks.info.mockResolvedValue({ data: { size: 10_000, contentType: "ok" }, error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://storage.example/${path}` },
    }));
    mocks.completeUploadedMedia.mockResolvedValue({
      nextStep: "confirm_file_metadata",
      reply: "Revise os dados recebidos.",
      draft: {
        audio_url: "https://storage.example/audio.wav",
        cover_url: "https://storage.example/cover.png",
      },
    });
    mocks.advanceUploadSession.mockResolvedValue({ id: "session-1" });
    mocks.sendText.mockResolvedValue(undefined);
    mocks.createHandlerDB.mockReturnValue({});
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const bytes = String(url).includes("cover") ? png(3000, 3000) : wav();
      return new Response(bytes, { status: 206 });
    }));
  });

  it("creates a direct signed upload ticket without imposing an app audio size cap", async () => {
    const ticket = await createWhatsappMediaUpload({
      grant: "grant",
      kind: "audio",
      fileName: "faixa.wav",
      contentType: "audio/wav",
      size: 2 * 1024 * 1024 * 1024,
    });

    expect(ticket).toMatchObject({
      bucket: "release-assets",
      signedUrl: expect.stringContaining("/storage/v1/object/upload/sign/"),
    });
    expect(ticket.path).toMatch(/^tenant-1\/whatsapp\/session-1\/audio-[a-f0-9-]+\.wav$/);
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(ticket.path, { upsert: false });
  });

  it("rejects formats outside WAV and the supported cover types", async () => {
    await expect(createWhatsappMediaUpload({
      grant: "grant",
      kind: "audio",
      fileName: "faixa.mp3",
      contentType: "audio/mpeg",
      size: 10,
    })).rejects.toThrow("WAV");
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("validates stored bytes, advances once and resumes WhatsApp", async () => {
    const result = await completeWhatsappMediaUpload({
      grant: "grant",
      audio: {
        path: "tenant-1/whatsapp/session-1/audio-acde.wav",
        fileName: "MC Teste - Faixa Nova.wav",
      },
      cover: { path: "tenant-1/whatsapp/session-1/cover-cafe.png" },
    });

    expect(mocks.info).toHaveBeenCalledTimes(2);
    expect(mocks.completeUploadedMedia).toHaveBeenCalledOnce();
    expect(mocks.advanceUploadSession).toHaveBeenCalledWith(
      "session-1",
      "confirm_file_metadata",
      expect.objectContaining({ release_format: "single" }),
    );
    expect(mocks.sendText).toHaveBeenCalledWith("5511999999999", "Revise os dados recebidos.");
    expect(result).toMatchObject({
      replySent: true,
      whatsappUrl: "https://wa.me/5511948059297",
    });
  });

  it("persists the upload when WhatsApp is not configured", async () => {
    delete process.env.EVOLUTION_INSTANCE;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await completeWhatsappMediaUpload({
      grant: "grant",
      audio: {
        path: "tenant-1/whatsapp/session-1/audio-acde.wav",
        fileName: "MC Teste - Faixa Nova.wav",
      },
      cover: { path: "tenant-1/whatsapp/session-1/cover-cafe.png" },
    });

    expect(mocks.advanceUploadSession).toHaveBeenCalledWith(
      "session-1",
      "confirm_file_metadata",
      expect.objectContaining({ release_format: "single" }),
    );
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(result.replySent).toBe(false);
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it("deletes an object whose stored bytes violate the cover contract", async () => {
    vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
      const bytes = String(url).includes("cover") ? png(1599, 1599) : wav();
      return new Response(bytes, { status: 206 });
    });

    await expect(completeWhatsappMediaUpload({
      grant: "grant",
      audio: {
        path: "tenant-1/whatsapp/session-1/audio-acde.wav",
        fileName: "MC Teste - Faixa Nova.wav",
      },
      cover: { path: "tenant-1/whatsapp/session-1/cover-cafe.png" },
    })).rejects.toThrow("1600x1600");

    expect(mocks.remove).toHaveBeenCalledWith([
      "tenant-1/whatsapp/session-1/cover-cafe.png",
    ]);
    expect(mocks.advanceUploadSession).not.toHaveBeenCalled();
  });

  it("refuses objects outside the signed session prefix", async () => {
    await expect(completeWhatsappMediaUpload({
      grant: "grant",
      audio: { path: "tenant-2/audio.wav", fileName: "audio.wav" },
      cover: { path: "tenant-2/cover.png" },
    })).rejects.toThrow("Caminho de arquivo inv\u00e1lido");

    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("fails visibly instead of waiting forever on Storage", async () => {
    vi.useFakeTimers();
    mocks.info.mockReturnValue(new Promise(() => undefined));

    const assertion = expect(completeWhatsappMediaUpload({
      grant: "grant",
      audio: {
        path: "tenant-1/whatsapp/session-1/audio-acde.wav",
        fileName: "MC Teste - Faixa Nova.wav",
      },
      cover: { path: "tenant-1/whatsapp/session-1/cover-cafe.png" },
    })).rejects.toThrow("Tempo esgotado ao consultar o arquivo");

    await vi.advanceTimersByTimeAsync(15_001);
    await assertion;
    expect(mocks.advanceUploadSession).not.toHaveBeenCalled();
  });
});
