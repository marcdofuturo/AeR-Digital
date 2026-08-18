import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const inviteUserByEmail = vi.fn();
const listUsers = vi.fn();
const deleteUser = vi.fn();
const profileUpsert = vi.fn();
const membershipUpsert = vi.fn();
const tenantUpdate = vi.fn();

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail, listUsers, deleteUser } },
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
    process.env.NEXT_PUBLIC_SITE_URL = "https://aerdigital.pages.dev";
    requireMembership.mockReset().mockResolvedValue({
      userId: "owner-1",
      tenantId: "tenant-1",
      role: "owner",
    });
    inviteUserByEmail.mockReset().mockResolvedValue({ data: { user: { id: "user-2" } }, error: null });
    listUsers.mockReset().mockResolvedValue({ data: { users: [] }, error: null });
    deleteUser.mockReset().mockResolvedValue({ error: null });
    profileUpsert.mockReset().mockResolvedValue({ error: null });
    membershipUpsert.mockReset().mockResolvedValue({ error: null });
    tenantUpdate.mockClear();
  });

  it("exports only async actions from the use-server module", () => {
    const source = readFileSync("app/config/actions.ts", "utf8");

    expect(source).not.toMatch(/^export\s+const\s+/m);
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
    expect(inviteUserByEmail).toHaveBeenCalledWith("novo@example.com", {
      data: { full_name: "Novo Membro" },
      redirectTo: "https://aerdigital.pages.dev/auth/invite?next=/config/equipe",
    });
    expect(membershipUpsert).toHaveBeenCalledWith(
      { tenant_id: "tenant-1", user_id: "user-2", role: "ar" },
      { onConflict: "tenant_id,user_id" },
    );
  });

  it("updates only editable label fields in the authenticated tenant", async () => {
    const formData = new FormData();
    formData.set("name", "Audiolink Atualizado");
    formData.set("legal_name", "Audiolink Ltda");
    formData.set("cnpj", "12.345.678/0001-95");
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

  it("recovers an existing Auth user left without a profile", async () => {
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: new Error("already exists") });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-user", email: "novo@example.com" }] },
      error: null,
    });
    const formData = new FormData();
    formData.set("full_name", "Novo Membro");
    formData.set("email", "novo@example.com");
    formData.set("role", "viewer");

    const { inviteTeamMember } = await import("./actions");
    await expect(inviteTeamMember({ status: "idle", message: "" }, formData)).resolves.toMatchObject({
      status: "success",
    });
    expect(membershipUpsert).toHaveBeenCalledWith(
      { tenant_id: "tenant-1", user_id: "orphan-user", role: "viewer" },
      { onConflict: "tenant_id,user_id" },
    );
  });

  it("removes a newly invited Auth user when profile persistence fails", async () => {
    profileUpsert.mockResolvedValue({ error: new Error("database unavailable") });
    const formData = new FormData();
    formData.set("full_name", "Novo Membro");
    formData.set("email", "novo@example.com");
    formData.set("role", "ar");

    const { inviteTeamMember } = await import("./actions");
    await expect(inviteTeamMember({ status: "idle", message: "" }, formData)).resolves.toMatchObject({
      status: "error",
    });
    expect(deleteUser).toHaveBeenCalledWith("user-2");
  });

  it("clears optional label fields when they are submitted blank", async () => {
    const formData = new FormData();
    formData.set("name", "Audiolink Atualizado");
    for (const field of [
      "legal_name", "cnpj", "logo_url", "responsible_name", "contact_email", "contact_phone",
    ]) formData.set(field, "");

    const { updateLabelSettings } = await import("./actions");
    await updateLabelSettings({ status: "idle", message: "" }, formData);

    expect(tenantUpdate).toHaveBeenCalledWith(expect.objectContaining({
      legal_name: null,
      cnpj: null,
      logo_url: null,
      responsible_name: null,
      contact_email: null,
      contact_phone: null,
    }));
  });
});
