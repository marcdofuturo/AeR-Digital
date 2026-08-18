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
});
