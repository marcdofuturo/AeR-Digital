import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/forms/track-audio-upload-button", () => ({
  TrackAudioUploadButton: () => <button type="button">Substituir áudio</button>,
}));

import { TrackMediaControls } from "./track-media-controls";

describe("TrackMediaControls", () => {
  it("uses the in-page player and never renders an external listen link", () => {
    render(
      <TrackMediaControls
        releaseId="release-1"
        trackId="track-1"
        title="Acordei feliz"
        available
        version="2026-08-19T20:00:00.000Z"
      />,
    );

    expect(screen.queryByRole("link", { name: /ouvir/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/reproduzir acordei feliz/i)).toHaveAttribute(
      "src",
      expect.stringMatching(/^\/api\/releases\/release-1\/media\?kind=audio/),
    );
    expect(screen.getByRole("link", { name: /baixar áudio/i })).toHaveAttribute(
      "href",
      expect.stringContaining("download=1"),
    );
    expect(screen.getByRole("link", { name: /baixar áudio/i })).not.toHaveAttribute("target");
    expect(document.body.textContent).not.toContain("supabase.co");
  });
});
