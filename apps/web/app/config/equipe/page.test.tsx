import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
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
              role: "owner",
              profiles: {
                full_name: "Marc Audiolink Brasil",
                email: "marc@audiolinkbrasil.com",
              },
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

    expect(screen.getByText("Equipe (1)")).toBeVisible();
    expect(screen.getByText("Marc Audiolink Brasil")).toBeVisible();
    expect(screen.getByText("marc@audiolinkbrasil.com")).toBeVisible();
    expect(screen.getByText("Owner")).toBeVisible();
  });
});
