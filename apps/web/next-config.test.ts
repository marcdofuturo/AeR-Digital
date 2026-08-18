import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Next.js upload configuration", () => {
  it("accepts authenticated audio uploads up to 64 MB", () => {
    const source = readFileSync("next.config.ts", "utf8");

    expect(source).toContain('bodySizeLimit: "64mb"');
  });
});
