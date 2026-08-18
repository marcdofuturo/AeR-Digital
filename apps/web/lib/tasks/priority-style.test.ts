import { describe, expect, it } from "vitest";
import { priorityFilterClass, priorityVariant } from "./priority-style";

describe("task priority styles", () => {
  it("uses distinct semantic variants for all priority levels", () => {
    expect(priorityVariant("alta")).toBe("danger");
    expect(priorityVariant("media")).toBe("warning");
    expect(priorityVariant("baixa")).toBe("info");
  });

  it("colors active filter tags according to their priority", () => {
    expect(priorityFilterClass("alta", true)).toContain("danger");
    expect(priorityFilterClass("media", true)).toContain("warning");
    expect(priorityFilterClass("baixa", true)).toContain("info");
    expect(new Set([
      priorityFilterClass("alta", true),
      priorityFilterClass("media", true),
      priorityFilterClass("baixa", true),
    ]).size).toBe(3);
  });
});
