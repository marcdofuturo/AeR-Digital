import { describe, expect, it } from "vitest";
import {
  buildAuthorizationDocumentData,
  buildAuthorizationDocx,
  buildAuthorizationMarkdown,
} from "./authorization-document";

describe("authorization document", () => {
  const data = buildAuthorizationDocumentData({
    tenant: { name: "Audiolink Brasil", legal_name: "Audiolink Brasil" },
    release: {
      title: "Minha Música Incrível",
      release_date: "2026-09-20",
      distributor: "Agregadora X",
      upc: "789123456789",
      album_id_ext: null,
    },
    track: {
      title: "Minha Música Incrível",
      isrc: "BR-ABC-26-00001",
      audio_url: "https://example.com/audio.mp3",
      track_participants: [
        {
          artist_id: "a1",
          position: 1,
          artists: { id: "a1", stage_name: "MC João", legal_name: "João Silva" },
        },
      ],
      splits: [
        { scope: "obra", holder_type: "artist", artist_id: "a1", role_label: "Autor/compositor", bps100: 10000, version: 1 },
        { scope: "fonograma", holder_type: "label", artist_id: null, role_label: "Produtor fonográfico", bps100: 4170, version: 1 },
        { scope: "fonograma", holder_type: "artist", artist_id: "a1", role_label: "Intérprete", bps100: 5830, version: 1 },
        { scope: "digital", holder_type: "label", artist_id: null, role_label: "Selo", bps100: 5000, version: 1 },
        { scope: "digital", holder_type: "artist", artist_id: "a1", role_label: "Main Artist", bps100: 5000, version: 1 },
      ],
    },
  });

  it("fills the release authorization markdown without mojibake", () => {
    const markdown = buildAuthorizationMarkdown(data);

    expect(markdown).toContain("Autorização de Distribuição Digital");
    expect(markdown).toContain("Minha Música Incrível");
    expect(markdown).toContain("João Silva");
    expect(markdown).not.toContain("�");
  });

  it("builds a valid docx zip header", () => {
    const docx = buildAuthorizationDocx(data);
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
    expect(docx.byteLength).toBeGreaterThan(1000);
  });
});
