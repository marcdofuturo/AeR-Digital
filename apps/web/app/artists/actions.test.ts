import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("@/lib/activity/log", () => ({ recordUserActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

describe("saveArtistProfile", () => {
  beforeEach(() => {
    requireMembership.mockResolvedValue({ tenantId: "tenant-1", role: "owner" });
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it("sends identity and contact data through the tenant-scoped RPC", async () => {
    const formData = new FormData();
    formData.set("artist_id", "artist-1");
    formData.set("stage_name", "Nome Artistico");
    formData.set("legal_name", "Nome Completo");
    formData.set("ecad_code", "ECAD-1");
    formData.set("release_email", "artista@example.com");
    formData.set("phone", "+5511999999999");

    const { saveArtistProfile } = await import("./actions");
    await saveArtistProfile(formData);

    expect(rpc).toHaveBeenCalledWith("save_artist_profile", {
      p_tenant_id: "tenant-1",
      p_artist_id: "artist-1",
      p_stage_name: "Nome Artistico",
      p_legal_name: "Nome Completo",
      p_ecad_code: "ECAD-1",
      p_release_email: "artista@example.com",
      p_phone: "+5511999999999",
    });
  });
});
