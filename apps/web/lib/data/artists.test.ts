import { describe, expect, it } from "vitest";
import { mapArtistReleases } from "./artists";

describe("mapArtistReleases", () => {
  it("maps every participant track to its release id and track title", () => {
    const releases = mapArtistReleases([
      {
        track_id: "track-1",
        tracks: {
          id: "track-1",
          title: "Acordei feliz",
          release_id: "release-1",
          releases: {
            id: "release-1",
            title: "EP Teste",
            release_date: "2026-09-15",
            stage: "em_analise",
          },
        },
      },
    ]);

    expect(releases).toEqual([
      {
        id: "release-1",
        title: "EP Teste",
        release_date: "2026-09-15",
        stage: "em_analise",
        track_title: "Acordei feliz",
      },
    ]);
  });
});

