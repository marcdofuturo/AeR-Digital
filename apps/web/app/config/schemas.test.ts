import { describe, expect, it } from "vitest";
import { labelSettingsSchema, teamInvitationSchema, teamMemberAccessSchema } from "./schemas";

describe("configuration schemas", () => {
  it("accepts only delegated roles when editing an existing member", () => {
    expect(
      teamMemberAccessSchema.safeParse({
        user_id: "4e2f09f6-40e5-4991-9fe4-4468566b56f2",
        role: "financeiro",
      }).success,
    ).toBe(true);
    expect(
      teamMemberAccessSchema.safeParse({
        user_id: "4e2f09f6-40e5-4991-9fe4-4468566b56f2",
        role: "owner",
      }).success,
    ).toBe(false);
  });
  it.each(["ar", "financeiro", "viewer"])("accepts the invite role %s", (role) => {
    expect(
      teamInvitationSchema.safeParse({
        full_name: "Novo Membro",
        email: "novo@example.com",
        role,
      }).success,
    ).toBe(true);
  });

  it("does not allow inviting another owner", () => {
    expect(
      teamInvitationSchema.safeParse({
        full_name: "Novo Owner",
        email: "owner@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("accepts editable label data without tenant identity fields", () => {
    const parsed = labelSettingsSchema.parse({
      name: "Audiolink Brasil",
      legal_name: "Audiolink Brasil Ltda",
      cnpj: "12.345.678/0001-95",
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

  it("normalizes cleared optional label fields to null", () => {
    const parsed = labelSettingsSchema.parse({
      name: "Audiolink Brasil",
      legal_name: "",
      cnpj: " ",
      logo_url: "",
      responsible_name: "",
      contact_email: "",
      contact_phone: "",
    });

    expect(parsed).toMatchObject({
      legal_name: null,
      cnpj: null,
      logo_url: null,
      responsible_name: null,
      contact_email: null,
      contact_phone: null,
    });
  });

  it.each(["11.111.111/1111-11", "12.345.678/0001-91"])("rejects the invalid CNPJ %s", (cnpj) => {
    expect(labelSettingsSchema.safeParse({ name: "Audiolink Brasil", cnpj }).success).toBe(false);
  });
});
