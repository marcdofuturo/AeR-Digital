import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationDocumentPreview } from "./authorization-document-preview";

const data = {
  representativeName: "Marc",
  labelName: "Audiolink Brasil",
  releaseTitle: "Teste",
  trackTitle: "Faixa Teste",
  artists: "Artista Teste",
  releaseDate: "18/08/2026",
  distributor: "Audiolink Brasil",
  isrc: "BR-ABC-26-00001",
  albumId: "123",
  trackLink: "https://example.com/audio.mp3",
  splits: { obra: [], fonograma: [], digital: [] },
};

describe("AuthorizationDocumentPreview", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the complete document and confirms the action", async () => {
    render(<AuthorizationDocumentPreview data={data} />);

    fireEvent.click(screen.getByRole("button", { name: /copiar autorizacao formatada/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain("Faixa Teste");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });
});
