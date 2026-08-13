import { describe, expect, it } from "vitest";
import { isTenantSwitchCommand } from "./flow-commands";

describe("isTenantSwitchCommand", () => {
  it("recognizes requests to change the linked label", () => {
    expect(isTenantSwitchCommand("trocar selo")).toBe(true);
    expect(isTenantSwitchCommand("Trocar o selo")).toBe(true);
    expect(isTenantSwitchCommand("quero mudar de gravadora")).toBe(true);
  });

  it("does not treat normal intake answers as label switching", () => {
    expect(isTenantSwitchCommand("single")).toBe(false);
    expect(isTenantSwitchCommand("A7K9")).toBe(false);
  });
});
