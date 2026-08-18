import { describe, expect, it } from "vitest";
import { labelSettingsSchema, teamInvitationSchema } from "./schemas";

describe("configuration schemas", () => {
  it.each(["ar", "financeiro", "viewer"])("accepts the invite role %s", (role) => {
    expect(teamInvitationSchema.safeParse({
      full_name: "Novo Membro",
      email: "novo@example.com",
      role,
    }).success).toBe(true);
  });

  it("does not allow inviting another owner", () => {
    expect(teamInvitationSchema.safeParse({
      full_name: "Novo Owner",
      email: "owner@example.com",
      role: "owner",
    }).success).toBe(false);
  });

  it("accepts editable label data without tenant identity fields", () => {
    const parsed = labelSettingsSchema.parse({
      name: "Audiolink Brasil",
      legal_name: "Audiolink Brasil Ltda",
      cnpj: "12.345.678/0001-90",
      logo_url: "https://example.com/logo.png",
      responsible_name: "Marc",
      contact_email: "contato@example.com",
      contact_phone: "+5511999999999",
      intake_code: "MUST-NOT-WRITE",
      slug: "must-not-write",
    });

    expect(parsed).not.toHaveProperty("intake_code");
    expect(parsed).not.toHaveProperty("slug");
  });
});
