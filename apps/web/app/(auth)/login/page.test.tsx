import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

describe("LoginPage", () => {
  it("uses email and password login instead of a magic link", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Senha")).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(screen.queryByText(/link mágico/i)).toBeNull();
    expect(screen.queryByText(/não precisa de senha/i)).toBeNull();
  });
});
