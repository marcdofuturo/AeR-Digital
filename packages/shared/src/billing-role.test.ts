import { describe, expect, it } from "vitest";
import { defaultBillingRole, normalizeBillingRoles } from "./types";

describe("billing roles", () => {
  it("assigns principal, primary and featuring by position", () => {
    expect([1, 2, 4, 5].map(defaultBillingRole)).toEqual([
      "principal",
      "primary",
      "primary",
      "featuring",
    ]);
  });

  it("keeps one principal at the first position while preserving role overrides", () => {
    expect(
      normalizeBillingRoles([
        { artistId: "b", position: 2, billingRole: "featuring" },
        { artistId: "a", position: 1, billingRole: "primary" },
      ]),
    ).toEqual([
      { artistId: "a", position: 1, billingRole: "principal" },
      { artistId: "b", position: 2, billingRole: "featuring" },
    ]);
  });
});
