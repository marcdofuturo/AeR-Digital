import { describe, expect, it } from "vitest";
import { isUsablePresentationAudioUrl } from "./audio";

describe("isUsablePresentationAudioUrl", () => {
  const projectUrl = "https://project.supabase.co";

  it.each([
    null,
    undefined,
    "",
    "received",
    "/storage/audio.wav",
    "ftp://project.supabase.co/storage/v1/object/public/release-assets/a.wav",
    "https://example.com/storage/v1/object/public/release-assets/a.wav",
    "https://project.supabase.co/audio.wav",
  ])("rejects unusable audio reference %s", (value) => {
    expect(isUsablePresentationAudioUrl(value, projectUrl)).toBe(false);
  });

  it("accepts a public release asset from the configured Supabase project", () => {
    expect(
      isUsablePresentationAudioUrl(
        "https://project.supabase.co/storage/v1/object/public/release-assets/tenant/release/audio.wav",
        projectUrl,
      ),
    ).toBe(true);
  });
});
