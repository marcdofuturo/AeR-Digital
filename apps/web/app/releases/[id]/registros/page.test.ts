import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("registration guidance", () => {
  it("keeps ISWC with works, ISRC with recordings, and ECAD on both", () => {
    const source = registrationSource();

    expect(source).toContain(
      'REGISTRATION_ORDER = ["obra_ecad", "fonograma_ecad", "distribuicao"]',
    );
    expect(source).toContain('kind === "obra_ecad" ? "ISWC"');
    expect(source).toContain('kind === "fonograma_ecad" ? "ISRC"');
    expect(source).toContain('name="ecad_code"');
  });

  it("limits associations and distribution providers to the requested values", () => {
    const source = registrationSource();

    expect(source).toContain('<option value="UBC">UBC</option>');
    expect(source).toContain('<option value="Abramus">Abramus</option>');
    expect(source).toContain('placeholder="Audiolink Brasil"');
    expect(source).not.toContain("Altafonte");
    expect(source).not.toContain("ONErpm");
    expect(source).not.toContain("Tratore");
  });
});

function registrationSource() {
  return [
    readFileSync("app/releases/[id]/registros/page.tsx", "utf8"),
    readFileSync("components/releases/registration-form.tsx", "utf8"),
  ].join("\n");
}
