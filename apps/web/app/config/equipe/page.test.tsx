import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
}));

vi.mock("@/lib/auth/require-membership", () => ({
  requireMembership: vi.fn().mockResolvedValue({
    userId: "user-1",
    tenantId: "tenant-1",
    role: "owner",
  }),
}));

vi.mock("../actions", () => ({
  inviteTeamMember: vi.fn(),
  updateTeamMemberRole: vi.fn(),
  removeTeamMember: vi.fn(),
  INITIAL_CONFIG_ACTION_STATE: { status: "idle", message: "" },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      })),
    })),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: "membership-1",
              user_id: "user-1",
              role: "owner",
              profiles: {
                full_name: "Marc Audiolink Brasil",
                email: "marc@audiolinkbrasil.com",
              },
            },
            {
              id: "membership-2",
              user_id: "4e2f09f6-40e5-4991-9fe4-4468566b56f2",
              role: "viewer",
              profiles: { full_name: "Analista", email: "analista@example.com" },
            },
          ],
        }),
      })),
    })),
  })),
}));

import EquipeConfigPage from "./page";

describe("EquipeConfigPage", () => {
  it("renders tenant members using the admin metadata query", async () => {
    render(await EquipeConfigPage());

    expect(screen.getByText("Equipe (2)")).toBeVisible();
    expect(screen.getByText("Marc Audiolink Brasil")).toBeVisible();
    expect(screen.getByText("marc@audiolinkbrasil.com")).toBeVisible();
    expect(screen.getByText("Owner")).toBeVisible();
    expect(screen.getByRole("button", { name: /convidar membro/i })).toBeVisible();
    expect(screen.getByLabelText(/nivel de permissao/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /salvar permissao/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /retirar acesso/i })).toBeVisible();
  });
});
