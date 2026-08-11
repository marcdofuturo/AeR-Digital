import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
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
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });

  it("fetches the current tenant with the admin client after resolving the user's tenant id", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "audiolink",
      name: "Audiolink Brasil",
      plan: "trial",
    };
    const blockedTenantQuery = singleResult(null);
    const adminTenantQuery = singleResult(tenant);

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", app_metadata: { tenant_id: "tenant-1" } } },
        }),
      },
      from: vi.fn(() => blockedTenantQuery),
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => adminTenantQuery),
    });

    const { getTenant } = await import("./tenant");

    await expect(getTenant()).resolves.toMatchObject(tenant);
    expect(adminTenantQuery.eq).toHaveBeenCalledWith("id", "tenant-1");
  });
});
