import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CatalogGrowthChart", () => {
  it("keeps the period tooltip without a contrasting hover rectangle", () => {
    const source = readFileSync("components/dashboard/catalog-growth-chart.tsx", "utf8");
    expect(source).toContain("cursor={false}");
    expect(source).toContain("<Tooltip");
  });
});
