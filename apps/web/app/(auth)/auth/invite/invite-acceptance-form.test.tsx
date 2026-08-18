import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteAcceptanceForm } from "./invite-acceptance-form";

const mocks = vi.hoisted(() => ({
  setSession: vi.fn(),
  updateUser: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { setSession: mocks.setSession, updateUser: mocks.updateUser },
  })),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mocks.replace, refresh: mocks.refresh })),
}));

describe("InviteAcceptanceForm", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/auth/invite?next=/config/equipe#access_token=access-1&refresh_token=refresh-1&type=invite",
    );
    mocks.setSession.mockReset().mockResolvedValue({ error: null });
    mocks.updateUser.mockReset().mockResolvedValue({ error: null });
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  afterEach(cleanup);

  it("establishes the invite session and lets the member define a password", async () => {
    render(<InviteAcceptanceForm />);

    await screen.findByRole("heading", { name: "Concluir convite" });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "SenhaSegura123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "SenhaSegura123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar acesso" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "SenhaSegura123!" }));
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: "access-1",
      refresh_token: "refresh-1",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/config/equipe");
  });
});
