import { describe, expect, it } from "vitest";
import { normalizeRegistrationStatus, REGISTRATION_STATUS_OPTIONS } from "./registration-status";

describe("registration statuses", () => {
  it("normalizes historical na values to pending", () => {
    expect(normalizeRegistrationStatus("na")).toBe("pendente");
    expect(normalizeRegistrationStatus(null)).toBe("pendente");
  });

  it("does not offer N/A as an editable status", () => {
    expect(REGISTRATION_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      "pendente",
      "em_andamento",
      "concluido",
      "rejeitado",
    ]);
    expect(REGISTRATION_STATUS_OPTIONS.map((option) => option.label)).not.toContain("N/A");
  });
});
