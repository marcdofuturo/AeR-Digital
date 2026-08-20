import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTrackAudioUpload, completeTrackAudioUpload, uploadToSignedUrl, refresh } = vi.hoisted(
  () => ({
    createTrackAudioUpload: vi.fn(),
    completeTrackAudioUpload: vi.fn(),
    uploadToSignedUrl: vi.fn(),
    refresh: vi.fn(),
  }),
);

vi.mock("@/app/releases/actions", () => ({
  createTrackAudioUpload,
  completeTrackAudioUpload,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl }),
    },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { TrackAudioUploadButton } from "./track-audio-upload-button";

describe("TrackAudioUploadButton", () => {
  beforeEach(() => {
    createTrackAudioUpload.mockReset().mockResolvedValue({
      bucket: "release-assets",
      path: "tenant-1/release-1/audio-file.wav",
      token: "signed-token",
    });
    uploadToSignedUrl.mockReset().mockResolvedValue({ error: null });
    completeTrackAudioUpload
      .mockReset()
      .mockResolvedValue({ updatedAt: "2026-08-19T20:00:00.000Z" });
    refresh.mockReset();
  });

  it("uploads the file directly with a signed token before saving its path", async () => {
    const { container } = render(
      <form>
        <TrackAudioUploadButton releaseId="release-1" trackId="track-1" />
      </form>,
    );
    const file = new File(["audio"], "faixa.wav", { type: "audio/wav" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(createTrackAudioUpload).toHaveBeenCalledWith({
      releaseId: "release-1",
      trackId: "track-1",
      fileName: "faixa.wav",
      contentType: "audio/wav",
      size: file.size,
    });
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      "tenant-1/release-1/audio-file.wav",
      "signed-token",
      file,
      { contentType: "audio/wav" },
    );
    expect(completeTrackAudioUpload).toHaveBeenCalledWith({
      releaseId: "release-1",
      trackId: "track-1",
      path: "tenant-1/release-1/audio-file.wav",
    });
    expect(screen.getByRole("button", { name: "Áudio enviado" })).toBeVisible();
  });

  it("shows an upload error without persisting the track", async () => {
    uploadToSignedUrl.mockResolvedValueOnce({ error: new Error("storage unavailable") });
    const { container } = render(
      <TrackAudioUploadButton releaseId="release-1" trackId="track-1" />,
    );
    const file = new File(["audio"], "faixa.wav", { type: "audio/wav" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar o áudio");
    expect(completeTrackAudioUpload).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Substituir áudio" })).toBeEnabled();
  });
});
