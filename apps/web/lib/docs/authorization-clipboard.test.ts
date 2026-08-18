import { describe, expect, it } from "vitest";
import { buildAuthorizationClipboardPayload } from "./authorization-clipboard";

describe("buildAuthorizationClipboardPayload", () => {
  it("builds portable black text HTML and plain text", () => {
    const payload = buildAuthorizationClipboardPayload({
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
      splits: {
        obra: [{ id: 1, artist: "Artista Teste", role: "Autor", percent: "100,00%" }],
        fonograma: [],
        digital: [],
      },
    });

    expect(payload.html).toContain("color:#000000");
    expect(payload.html).toContain("background:transparent");
    expect(payload.html).toContain("<table");
    expect(payload.html).toContain("Faixa Teste");
    expect(payload.html).not.toContain("#111418");
    expect(payload.text).toMatch(/Autoriza..o de Distribui..o Digital/);
    expect(payload.text).toContain("Faixa Teste");
  });
});
