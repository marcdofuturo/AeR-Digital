import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/releases/actions", () => ({ saveTrackOverview: vi.fn() }));
vi.mock("./track-media-controls", () => ({
  TrackMediaControls: () => <div>Player da faixa</div>,
}));

import { TrackMetadataForm } from "./track-metadata-form";

describe("TrackMetadataForm", () => {
  it("makes every track metadata field editable and exposes an explicit save", () => {
    render(
      <TrackMetadataForm
        releaseId="release-1"
        track={{
          id: "track-1",
          title: "Acordei feliz",
          isrc: "",
          explicit: false,
          audioDurationSec: 174,
          audioBpm: 129.2,
          audioKey: "F# major",
          audioEnergy: 1,
          lyricsTranscript: "Transcrição salva",
          audioAvailable: true,
          audioVersion: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Faixa")).toBeDisabled();
    expect(screen.getByLabelText("Transcrição da letra")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /editar dados da faixa/i }));

    expect(screen.getByLabelText("Faixa")).toBeEnabled();
    expect(screen.getByLabelText("ISRC")).toBeEnabled();
    expect(screen.getByLabelText("Duração (segundos)")).toBeEnabled();
    expect(screen.getByLabelText("BPM")).toBeEnabled();
    expect(screen.getByLabelText("Tom")).toBeEnabled();
    expect(screen.getByLabelText("Energia (0 a 1)")).toBeEnabled();
    expect(screen.getByLabelText("Transcrição da letra")).toBeEnabled();
    expect(screen.getByRole("button", { name: /salvar dados da faixa/i })).toBeEnabled();
  });
});
