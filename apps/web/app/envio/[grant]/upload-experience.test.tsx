import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  completeWhatsappMediaUpload: vi.fn(),
  createWhatsappMediaUpload: vi.fn(),
}));

import { UploadExperience } from "./upload-experience";

afterEach(cleanup);

describe("UploadExperience", () => {
  it("shows the exact delivery contract and both file controls", () => {
    const { container } = render(<UploadExperience grant="temporary-grant" />);

    expect(screen.getByRole("heading", { name: /Envie a faixa e a capa/i })).toBeVisible();
    expect(screen.getByLabelText("Selecionar \u00c1udio WAV")).toHaveAttribute("accept", expect.stringContaining(".wav"));
    expect(screen.getByLabelText("Selecionar Capa quadrada")).toHaveAttribute("accept", expect.stringContaining(".png"));
    expect(screen.getByText(/44,1 kHz/)).toBeVisible();
    expect(screen.getByText(/1600 a 3000 px/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar arquivos" })).toBeDisabled();
    expect(container).not.toHaveTextContent("\\u00");
  });

  it("rejects an MP3 before requesting any upload ticket", async () => {
    render(<UploadExperience grant="temporary-grant" />);
    const input = screen.getByLabelText("Selecionar \u00c1udio WAV");

    fireEvent.change(input, {
      target: { files: [new File(["mp3"], "faixa.mp3", { type: "audio/mpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Selecione um arquivo WAV");
    });
    expect(screen.getByRole("button", { name: "Enviar arquivos" })).toBeDisabled();
  });
});
