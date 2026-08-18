import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveButton } from "./save-button";

const { useFormStatus } = vi.hoisted(() => ({ useFormStatus: vi.fn() }));

vi.mock("react-dom", () => ({ useFormStatus }));

describe("SaveButton", () => {
  beforeEach(() => useFormStatus.mockReturnValue({ pending: false }));

  it("does not announce success when an action returns an error", () => {
    useFormStatus.mockReturnValue({ pending: true });
    const view = render(<SaveButton resultStatus="idle">Salvar</SaveButton>);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();

    useFormStatus.mockReturnValue({ pending: false });
    view.rerender(<SaveButton resultStatus="error">Salvar</SaveButton>);

    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.queryByText("Salvo")).not.toBeInTheDocument();
  });
});
