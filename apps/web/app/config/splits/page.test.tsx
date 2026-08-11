import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn().mockResolvedValue({ name: "SuperTime Digital" }),
  getTenantSplitSettings: vi.fn().mockResolvedValue({
    digital_mode: "fixo",
    digital_label_bps100: 3000,
    digital_weight_primary: 100,
    digital_weight_featuring: 100,
  }),
}));

vi.mock("./actions", () => ({
  saveDigitalSplitSettings: vi.fn(),
}));

import SplitsConfigPage from "./page";

describe("SplitsConfigPage", () => {
  it("renders editable digital split controls", async () => {
    render(await SplitsConfigPage());

    expect(screen.getByRole("radio", { name: /percentual fixo/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /pro-rata automático/i })).toBeVisible();
    expect(screen.getByLabelText("Percentual do selo")).toHaveValue(30);
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeVisible();
    expect(screen.getByText(/restante é distribuído pro-rata/i)).toBeVisible();
  });
});
