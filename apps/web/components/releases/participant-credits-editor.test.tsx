import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveTrackParticipantCredits: vi.fn() }));

import { ParticipantCreditsEditor } from "./participant-credits-editor";

describe("ParticipantCreditsEditor", () => {
  beforeEach(cleanup);

  it("shows the three visual role levels and lets the user reorder artists", () => {
    render(
      <ParticipantCreditsEditor
        releaseId="release-1"
        trackId="track-1"
        participants={[
          { artistId: "a", stageName: "Artista A", position: 1, billingRole: "principal" },
          { artistId: "b", stageName: "Artista B", position: 2, billingRole: "primary" },
          { artistId: "c", stageName: "Artista C", position: 5, billingRole: "featuring" },
        ]}
      />,
    );

    expect(screen.getByText("Artista A").closest("div.grid")).toHaveClass("bg-emerald-600");
    expect(screen.getByText("Artista B").closest("div.grid")).toHaveClass("bg-emerald-100");
    expect(screen.getByText("Artista C").closest("div.grid")).toHaveClass("bg-blue-100");

    fireEvent.click(screen.getByRole("button", { name: /editar ordem e papeis/i }));
    fireEvent.click(screen.getByRole("button", { name: /subir artista b/i }));

    expect(screen.getByText("Artista B").closest("div.grid")).toHaveTextContent("#1");
    expect(screen.getByText("Artista B").closest("div.grid")).toHaveTextContent("Principal");
    expect(screen.getByLabelText("Papel de Artista A")).toHaveValue("primary");
  });
});
