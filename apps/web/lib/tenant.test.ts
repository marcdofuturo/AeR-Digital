import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockRequireMembership = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/auth/require-membership", () => ({
  requireMembership: mockRequireMembership,
}));

function singleResult(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

describe("tenant metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateAdminClient.mockReset();
    mockRequireMembership.mockReset();
  });

  it("resolves the tenant only from a verified membership", async () => {
    mockRequireMembership.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "viewer",
    });

    const { getCurrentTenantId } = await import("./tenant");

    await expect(getCurrentTenantId()).resolves.toBe("tenant-1");
  });

  it("does not trust stale tenant metadata after membership removal", async () => {
    mockRequireMembership.mockRejectedValue(new Error("Sem permissao para este tenant"));

    const { getCurrentTenantId } = await import("./tenant");

    await expect(getCurrentTenantId()).resolves.toBeNull();
  });

  it("fetches the current tenant with the admin client after resolving the user's tenant id", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "audiolink",
      name: "Audiolink Brasil",
      plan: "trial",
    };
    const adminTenantQuery = singleResult(tenant);

    mockRequireMembership.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "owner",
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => adminTenantQuery),
    });

    const { getTenant } = await import("./tenant");

    await expect(getTenant()).resolves.toMatchObject(tenant);
    expect(adminTenantQuery.eq).toHaveBeenCalledWith("id", "tenant-1");
  });
});
