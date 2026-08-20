import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button interaction feedback", () => {
  beforeEach(cleanup);

  it("provides visible press feedback without forcing motion", () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass(
      "active:scale-[0.98]",
      "motion-reduce:transform-none",
    );
  });

  it("uses the requested semantic colors for editing, saving and cancelling", () => {
    const { rerender } = render(<Button variant="edit">Editar</Button>);
    expect(screen.getByRole("button", { name: "Editar" })).toHaveClass("bg-blue-600");

    rerender(<Button variant="success">Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("bg-success");

    rerender(<Button variant="cancel">Cancelar</Button>);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("bg-danger");
  });
});
