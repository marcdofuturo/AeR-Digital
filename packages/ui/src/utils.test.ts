import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditionals", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("handles undefined", () => {
    expect(cn("a", undefined, null)).toBe("a");
  });
});
