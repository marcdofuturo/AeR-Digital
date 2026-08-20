import { describe, expect, it } from "vitest";
import { AUTHORIZATION_TRACK_SELECT } from "./authorization-document-source";

describe("authorization document data source", () => {
  it("loads only document fields and excludes large presentation/media payloads", () => {
    expect(AUTHORIZATION_TRACK_SELECT).toMatch(/track_participants/i);
    expect(AUTHORIZATION_TRACK_SELECT).toMatch(/splits/i);
    expect(AUTHORIZATION_TRACK_SELECT).not.toMatch(
      /audio_url|lyrics_transcript|pitches|presentation_jobs/i,
    );
  });
});
