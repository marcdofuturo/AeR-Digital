import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const single = vi.fn();
const select = vi.fn();
const eq = vi.fn();
const update = vi.fn();
const createBucket = vi.fn();
const createSignedUploadUrl = vi.fn();
const info = vi.fn();
const remove = vi.fn();
const getPublicUrl = vi.fn();

const query = { select, eq, update, single };
select.mockReturnValue(query);
eq.mockReturnValue(query);
update.mockReturnValue(query);

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => query,
    storage: {
      createBucket,
      from: () => ({ createSignedUploadUrl, info, remove, getPublicUrl }),
    },
  }),
}));

describe("direct track audio upload actions", () => {
  beforeEach(() => {
    requireMembership.mockReset().mockResolvedValue({
      userId: "owner-1",
      tenantId: "tenant-1",
      role: "owner",
    });
    single.mockReset().mockResolvedValue({ data: { id: "track-1" }, error: null });
    select.mockClear().mockReturnValue(query);
    eq.mockClear().mockReturnValue(query);
    update.mockClear().mockReturnValue(query);
    createBucket.mockReset().mockResolvedValue({ error: null });
    createSignedUploadUrl.mockReset().mockResolvedValue({
      data: { token: "signed-token" },
      error: null,
    });
    info.mockReset().mockResolvedValue({
      data: { size: 30_000_000, contentType: "audio/wav" },
      error: null,
    });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
    getPublicUrl.mockReset().mockReturnValue({ data: { publicUrl: "https://storage.example/audio-file.wav" } });
  });

  it("creates a tenant-scoped signed upload without receiving the file bytes", async () => {
    const { createTrackAudioUpload } = await import("./actions");
    const ticket = await createTrackAudioUpload({
      releaseId: "release-1",
      trackId: "track-1",
      fileName: "faixa.wav",
      contentType: "audio/wav",
      size: 30_000_000,
    });

    expect(ticket.bucket).toBe("release-assets");
    expect(ticket.token).toBe("signed-token");
    expect(ticket.path).toMatch(/^tenant-1\/release-1\/audio-[a-f0-9-]+\.wav$/);
    expect(createSignedUploadUrl).toHaveBeenCalledWith(ticket.path, { upsert: false });
  });

  it("rejects files above the bounded upload size", async () => {
    const { createTrackAudioUpload } = await import("./actions");

    await expect(createTrackAudioUpload({
      releaseId: "release-1",
      trackId: "track-1",
      fileName: "grande.wav",
      contentType: "audio/wav",
      size: 64 * 1024 * 1024,
    })).rejects.toThrow("Arquivo de áudio excede 60 MB");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses to persist an object outside the current tenant and release", async () => {
    const { completeTrackAudioUpload } = await import("./actions");

    await expect(completeTrackAudioUpload({
      releaseId: "release-1",
      trackId: "track-1",
      path: "tenant-2/release-1/audio-file.wav",
    })).rejects.toThrow("Caminho de áudio inválido");
    expect(info).not.toHaveBeenCalled();
  });

  it("verifies the uploaded object before persisting its public URL", async () => {
    const { completeTrackAudioUpload } = await import("./actions");

    const publicUrl = await completeTrackAudioUpload({
      releaseId: "release-1",
      trackId: "track-1",
      path: "tenant-1/release-1/audio-file.wav",
    });

    expect(publicUrl).toBe("https://storage.example/audio-file.wav");
    expect(info).toHaveBeenCalledWith("tenant-1/release-1/audio-file.wav");
    expect(update).toHaveBeenCalledWith({
      audio_url: "https://storage.example/audio-file.wav",
    });
    expect(eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(eq).toHaveBeenCalledWith("release_id", "release-1");
    expect(eq).toHaveBeenCalledWith("id", "track-1");
  });

  it("removes an uploaded object whose real size exceeds the limit", async () => {
    info.mockResolvedValueOnce({
      data: { size: 61 * 1024 * 1024, contentType: "audio/wav" },
      error: null,
    });
    const { completeTrackAudioUpload } = await import("./actions");
    const path = "tenant-1/release-1/audio-file.wav";

    await expect(completeTrackAudioUpload({
      releaseId: "release-1",
      trackId: "track-1",
      path,
    })).rejects.toThrow("Arquivo de áudio enviado é inválido");

    expect(remove).toHaveBeenCalledWith([path]);
    expect(update).not.toHaveBeenCalled();
  });
});
