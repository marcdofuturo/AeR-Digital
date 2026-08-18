import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.limit = vi.fn(() => query);
      query.maybeSingle = maybeSingle;
      return query;
    }),
  })),
}));

describe("requireMembership", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    maybeSingle.mockReset();
  });

  it("rejects unauthenticated calls", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { requireMembership } = await import("./require-membership");
    await expect(requireMembership()).rejects.toThrow("Nao autenticado");
  });

  it("rejects a role outside the action allowlist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: {} } } });
    maybeSingle.mockResolvedValue({
      data: { tenant_id: "tenant-1", role: "viewer" },
      error: null,
    });
    const { requireMembership } = await import("./require-membership");
    await expect(requireMembership(["owner"])).rejects.toThrow("Sem permissao");
  });

  it("returns the authenticated tenant and role", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: {} } } });
    maybeSingle.mockResolvedValue({
      data: { tenant_id: "tenant-1", role: "ar" },
      error: null,
    });
    const { requireMembership } = await import("./require-membership");
    await expect(requireMembership(["owner", "ar"])).resolves.toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "ar",
    });
  });
});
