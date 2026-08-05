import { describe, it, expect } from "vitest";
import { distributeEvenly, distributeByWeight, reconcile, fmt } from "./math";
import type { SplitLine } from "./types";

describe("distributeEvenly", () => {
  it("distributes 10000 between 2 items", () => {
    const result = distributeEvenly(["A", "B"], 10_000);
    expect(result.map(r => r.bps100)).toEqual([5000, 5000]);
  });

  it("distributes 10000 between 3 items", () => {
    const result = distributeEvenly(["A", "B", "C"], 10_000);
    expect(result.map(r => r.bps100)).toEqual([3334, 3333, 3333]);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(10_000);
  });

  it("distributes 10000 between 4 items", () => {
    const result = distributeEvenly(["A", "B", "C", "D"], 10_000);
    expect(result.every(r => r.bps100 === 2500)).toBe(true);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(10_000);
  });

  it("handles empty array", () => {
    const result = distributeEvenly([], 10_000);
    expect(result).toHaveLength(0);
  });

  it("handles zero pool", () => {
    const result = distributeEvenly(["A", "B"], 0);
    expect(result.map(r => r.bps100)).toEqual([0, 0]);
  });
});

describe("distributeByWeight", () => {
  it("weighted distribution works", () => {
    const items = [
      { item: "A", w: 2 },
      { item: "B", w: 1 },
    ];
    const result = distributeByWeight(items, 10_000);
    // A gets 6667, B gets 3333 (rounded)
    expect(result[0]!.bps100).toBe(6667);
    expect(result[1]!.bps100).toBe(3333);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(10_000);
  });
});

describe("reconcile", () => {
  it("passes through if total is already 10000", () => {
    const lines: SplitLine[] = [
      { holder_type: "artist", role_label: "A", name: "X", bps100: 5000 },
      { holder_type: "artist", role_label: "B", name: "Y", bps100: 5000 },
    ];
    expect(reconcile(lines)).toEqual(lines);
  });

  it("adjusts largest if total is off", () => {
    const lines: SplitLine[] = [
      { holder_type: "artist", role_label: "A", name: "X", bps100: 3333 },
      { holder_type: "artist", role_label: "B", name: "Y", bps100: 3333 },
      { holder_type: "artist", role_label: "C", name: "Z", bps100: 3333 },
    ];
    const result = reconcile(lines);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(10_000);
  });
});

describe("fmt", () => {
  it("formats bps100 as percentage", () => {
    expect(fmt(5000)).toBe("50,00%");
    expect(fmt(4170)).toBe("41,70%");
    expect(fmt(1660)).toBe("16,60%");
    expect(fmt(10000)).toBe("100,00%");
  });
});
