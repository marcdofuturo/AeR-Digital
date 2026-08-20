import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/activity/log", () => ({ recordUserActivity: vi.fn() }));

const requireMembership = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}));

describe("authorization recipient actions", () => {
  beforeEach(() => {
    requireMembership.mockReset().mockResolvedValue({
      userId: "owner-1",
      tenantId: "tenant-1",
      role: "owner",
    });
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it("derives the artist from the tenant-scoped recipient instead of trusting form input", async () => {
    const formData = new FormData();
    formData.set("release_id", "release-1");
    formData.set("recipient_id", "recipient-1");
    formData.set("artist_id", "artist-from-another-tenant");
    formData.set("email", "artista@example.com");

    const { saveAuthorizationRecipientEmail } = await import("./actions");
    await saveAuthorizationRecipientEmail(formData);

    expect(rpc).toHaveBeenCalledWith("save_authorization_recipient_email", {
      p_tenant_id: "tenant-1",
      p_release_id: "release-1",
      p_recipient_id: "recipient-1",
      p_email: "artista@example.com",
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("artist_id");
  });
});
