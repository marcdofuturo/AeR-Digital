import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn().mockResolvedValue({
    id: "tenant-1",
    slug: "audiolink",
    name: "Audiolink Brasil",
    legal_name: "Audiolink Brasil Ltda",
    cnpj: "12.345.678/0001-90",
    logo_url: null,
    intake_code: "A7K9",
    plan: "trial",
    status: "active",
    responsible_name: "Marc",
    contact_email: "contato@example.com",
    contact_phone: "+5511999999999",
    created_at: "2026-01-01T00:00:00Z",
  }),
}));

vi.mock("@/lib/auth/require-membership", () => ({
  requireMembership: vi.fn().mockResolvedValue({
    userId: "user-1",
    tenantId: "tenant-1",
    role: "owner",
  }),
}));

vi.mock("../actions", () => ({
  updateLabelSettings: vi.fn(),
  INITIAL_CONFIG_ACTION_STATE: { status: "idle", message: "" },
}));

import SeloConfigPage from "./page";

describe("SeloConfigPage", () => {
  it("edits business data while keeping the intake code immutable", async () => {
    render(await SeloConfigPage());

    expect(screen.getByLabelText(/^nome do selo$/i)).toHaveValue("Audiolink Brasil");
    expect(screen.getByLabelText(/responsavel/i)).toHaveValue("Marc");
    expect(screen.getByRole("button", { name: /salvar dados do selo/i })).toBeVisible();
    expect(screen.getByText("A7K9")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /codigo de intake/i })).not.toBeInTheDocument();
  });
});
