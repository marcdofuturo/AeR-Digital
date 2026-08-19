import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("./sidebar", () => ({
  Sidebar: () => <aside aria-label="Navegacao principal" />,
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
  });

  it("renders auth pages without the authenticated sidebar", () => {
    mockUsePathname.mockReturnValue("/login");

    render(
      <AppShell>
        <h1>Entrar</h1>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeVisible();
    expect(screen.queryByLabelText("Navegacao principal")).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("renders the public media page without the authenticated sidebar", () => {
    mockUsePathname.mockReturnValue("/envio/temporary-grant");

    render(
      <AppShell>
        <h1>Envio seguro</h1>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { name: "Envio seguro" })).toBeVisible();
    expect(screen.queryByLabelText("Navegacao principal")).not.toBeInTheDocument();
  });

  it("wraps CRM pages with sidebar and main landmark", () => {
    mockUsePathname.mockReturnValue("/releases");

    render(
      <AppShell>
        <h1>Lancamentos</h1>
      </AppShell>,
    );

    expect(screen.getByLabelText("Navegacao principal")).toBeVisible();
    expect(screen.getByRole("main")).toHaveTextContent("Lancamentos");
  });
});
