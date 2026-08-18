import { describe, expect, it } from "vitest";
import { buildSimplePdf } from "./simple-pdf";

describe("buildSimplePdf", () => {
  it("positions every line from the page origin", () => {
    const pdf = buildSimplePdf([
      { text: "First line" },
      { text: "Second line" },
      { text: "Third line" },
    ]).toString("binary");

    expect(pdf).toContain("1 0 0 1 56 770 Tm\n(First line) Tj");
    expect(pdf).toContain("1 0 0 1 56 753 Tm\n(Second line) Tj");
    expect(pdf).toContain("1 0 0 1 56 736 Tm\n(Third line) Tj");
    expect(pdf).not.toContain("56 770 Td");
  });

  it("declares WinAnsi encoding for accented Latin text", () => {
    const pdf = buildSimplePdf([{ text: "Autorizacao com acentos: olá, música, distribuição" }])
      .toString("binary");

    expect(pdf.match(/\/Encoding \/WinAnsiEncoding/g)).toHaveLength(2);
  });
});
