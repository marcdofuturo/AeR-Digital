import { describe, it, expect } from "vitest";
import { sql } from ".";

describe("@ar/db", () => {
  it("exports sql helper", () => {
    expect(sql).toBeDefined();
  });
});
