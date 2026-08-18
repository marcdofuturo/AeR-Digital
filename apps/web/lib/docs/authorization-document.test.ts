import { describe, expect, it } from "vitest";
import {
  buildAuthorizationDocumentData,
  buildAuthorizationDocx,
  buildAuthorizationMarkdown,
  buildAuthorizationPdf,
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
    expect(markdown).not.toMatch(/[�ÃƒÃ‚]/);
  });

  it("repairs old mojibake values when building document data", () => {
    const repaired = buildAuthorizationDocumentData({
      tenant: { name: "Audiolink Brasil" },
      release: { title: "Minha MÃºsica IncrÃ­vel", release_date: "2026-09-20" },
      track: {
        title: "Minha MÃºsica IncrÃ­vel",
        track_participants: [
          { artist_id: "a1", position: 1, artists: { id: "a1", stage_name: "MC JoÃ£o", legal_name: "JoÃ£o Silva" } },
        ],
        splits: [
          { scope: "fonograma", holder_type: "label", artist_id: null, role_label: "Produtor fonogrÃ¡fico", bps100: 4170, version: 1 },
        ],
      },
    });

    expect(buildAuthorizationMarkdown(repaired)).toContain("Minha Música Incrível");
    expect(buildAuthorizationMarkdown(repaired)).toContain("Produtor fonográfico");
  });

  it("uses LucIA as the responsible person for SuperTime Digital", () => {
    const supertimeData = buildAuthorizationDocumentData({
      tenant: { name: "SuperTime Digital", legal_name: "SuperTime Digital" },
      release: { title: "Teste", release_date: "2026-09-20" },
      track: {
        title: "Teste",
        track_participants: [],
        splits: [],
      },
    });

    expect(supertimeData.representativeName).toBe("LucIA");
    expect(buildAuthorizationMarkdown(supertimeData)).toContain("Sou o LucIA");
  });

  it("builds a valid docx zip header", () => {
    const docx = buildAuthorizationDocx(data);
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
    expect(docx.byteLength).toBeGreaterThan(1000);
    const packageText = Buffer.from(docx).toString("utf8");
    expect(packageText).toContain("word/document.xml");
    expect(packageText).toMatch(/Minha M.sica Incr.vel/);
    expect(packageText).toContain("CPF");
    expect(packageText).toContain("Total:");
  });

  it("builds a valid pdf header with unicode content", () => {
    const pdf = buildAuthorizationPdf(data);
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
    const source = pdf.toString("binary");
    expect(source).toContain("CPF) Tj");
    expect(source).toContain("Total:");
  });
});
