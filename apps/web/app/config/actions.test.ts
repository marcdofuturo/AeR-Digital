import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const inviteUserByEmail = vi.fn();
const profileUpsert = vi.fn();
const membershipUpsert = vi.fn();
const tenantUpdate = vi.fn();

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail } },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
          })),
          upsert: profileUpsert,
        };
      }
      if (table === "memberships") return { upsert: membershipUpsert };
      if (table === "tenants") {
        return {
          update: tenantUpdate.mockReturnValue({
            eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "tenant-1" }, error: null }) })) })),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

describe("configuration actions", () => {
  beforeEach(() => {
    requireMembership.mockReset().mockResolvedValue({
      userId: "owner-1",
      tenantId: "tenant-1",
      role: "owner",
    });
    inviteUserByEmail.mockReset().mockResolvedValue({ data: { user: { id: "user-2" } }, error: null });
    profileUpsert.mockReset().mockResolvedValue({ error: null });
    membershipUpsert.mockReset().mockResolvedValue({ error: null });
    tenantUpdate.mockClear();
  });

  it("invites one of the three allowed member roles", async () => {
    const formData = new FormData();
    formData.set("full_name", "Novo Membro");
    formData.set("email", "novo@example.com");
    formData.set("role", "ar");

    const { inviteTeamMember } = await import("./actions");
    await expect(inviteTeamMember({ status: "idle", message: "" }, formData)).resolves.toMatchObject({
      status: "success",
    });
    expect(requireMembership).toHaveBeenCalledWith(["owner"]);
    expect(membershipUpsert).toHaveBeenCalledWith(
      { tenant_id: "tenant-1", user_id: "user-2", role: "ar" },
      { onConflict: "tenant_id,user_id" },
    );
  });

  it("updates only editable label fields in the authenticated tenant", async () => {
    const formData = new FormData();
    formData.set("name", "Audiolink Atualizado");
    formData.set("legal_name", "Audiolink Ltda");
    formData.set("cnpj", "12.345.678/0001-90");
    formData.set("responsible_name", "Marc");
    formData.set("contact_email", "contato@example.com");
    formData.set("contact_phone", "+5511999999999");
    formData.set("intake_code", "DO-NOT-CHANGE");

    const { updateLabelSettings } = await import("./actions");
    await expect(updateLabelSettings({ status: "idle", message: "" }, formData)).resolves.toMatchObject({
      status: "success",
    });
    expect(requireMembership).toHaveBeenCalledWith(["owner"]);
    expect(tenantUpdate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Audiolink Atualizado",
      responsible_name: "Marc",
    }));
    expect(tenantUpdate.mock.calls[0]?.[0]).not.toHaveProperty("intake_code");
  });
});
