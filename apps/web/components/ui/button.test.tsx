import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button interaction feedback", () => {
  it("provides visible press feedback without forcing motion", () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass(
      "active:scale-[0.98]",
      "motion-reduce:transform-none",
    );
  });
});
