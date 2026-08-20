import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const releaseResult = vi.fn();
const trackResult = vi.fn();
const fetchMedia = vi.fn();

function query(result: ReturnType<typeof vi.fn>) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: result,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "releases") return query(releaseResult);
      if (table === "tracks") return query(trackResult);
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("authenticated release media route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    requireMembership.mockReset().mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "viewer",
    });
    releaseResult.mockReset().mockResolvedValue({
      data: {
        title: "Faixa teste",
        cover_url:
          "https://project.supabase.co/storage/v1/object/public/release-assets/tenant-1/release-1/cover.png",
      },
      error: null,
    });
    trackResult.mockReset().mockResolvedValue({
      data: {
        title: "Faixa teste",
        audio_url:
          "https://project.supabase.co/storage/v1/object/public/release-assets/tenant-1/release-1/audio.wav",
      },
      error: null,
    });
    fetchMedia.mockReset().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: {
          "content-type": "audio/wav",
          "content-length": "3",
          "content-range": "bytes 0-2/3",
          "accept-ranges": "bytes",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMedia);
  });

  it("streams a tenant-owned audio file with Range and attachment headers", async () => {
    const { GET } = await import("./route");
    const request = new Request(
      "https://aerdigital.pages.dev/api/releases/release-1/media?kind=audio&track_id=track-1&download=1",
      { headers: { range: "bytes=0-2" } },
    );

    const response = await GET(request, { params: Promise.resolve({ id: "release-1" }) });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).toContain("Faixa-teste.wav");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMedia).toHaveBeenCalledWith(
      expect.stringContaining("/release-assets/tenant-1/release-1/audio.wav"),
      expect.objectContaining({ headers: { range: "bytes=0-2" } }),
    );
  });

  it("refuses to proxy a URL outside the configured Supabase storage origin", async () => {
    trackResult.mockResolvedValueOnce({
      data: { title: "Faixa teste", audio_url: "https://example.com/private.wav" },
      error: null,
    });
    const { GET } = await import("./route");
    const request = new Request(
      "https://aerdigital.pages.dev/api/releases/release-1/media?kind=audio&track_id=track-1",
    );

    const response = await GET(request, { params: Promise.resolve({ id: "release-1" }) });

    expect(response.status).toBe(404);
    expect(fetchMedia).not.toHaveBeenCalled();
  });

  it("requires a current membership before reading media metadata", async () => {
    requireMembership.mockRejectedValueOnce(new Error("Nao autenticado"));
    const { GET } = await import("./route");
    const request = new Request(
      "https://aerdigital.pages.dev/api/releases/release-1/media?kind=cover",
    );

    const response = await GET(request, { params: Promise.resolve({ id: "release-1" }) });

    expect(response.status).toBe(401);
    expect(releaseResult).not.toHaveBeenCalled();
  });
});
