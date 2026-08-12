import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "marc@audiolinkbrasil.com" } },
      }),
      signOut: vi.fn(),
    },
  }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/releases");
    window.localStorage.clear();
  });

  it("collapses and expands the desktop sidebar with the back-music button", () => {
    render(<Sidebar />);

    const collapseButton = screen.getByRole("button", { name: /recolher menu lateral/i });
    expect(screen.getByText("AeR Digital")).toBeVisible();

    fireEvent.click(collapseButton);

    expect(screen.getByRole("button", { name: /expandir menu lateral/i })).toBeVisible();
    expect(screen.queryByText("Audiolink Brasil")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expandir menu lateral/i }));

    expect(screen.getByRole("button", { name: /recolher menu lateral/i })).toBeVisible();
    expect(screen.getByText("Audiolink Brasil")).toBeVisible();
  });
});

