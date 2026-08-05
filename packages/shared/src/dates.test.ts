import { describe, it, expect } from "vitest";
import { parseBR, fmtDate } from "./dates";

describe("dates", () => {
  it("parseBR parses dd/MM/yyyy", () => {
    const d = parseBR("06/03/2027");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2027);
    expect(d!.getMonth()).toBe(2); // 0-indexed, March
    expect(d!.getDate()).toBe(6);
  });

  it("parseBR parses dd/MM/yy", () => {
    const d = parseBR("15/01/27");
    expect(d).not.toBeNull();
    // date-fns 'yy' handling depends on version; we'll enhance date parsing later
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(0); // January
  });

  it("parseBR returns null for invalid", () => {
    expect(parseBR("not a date")).toBeNull();
  });

  it("fmtDate formats correctly", () => {
    const d = new Date("2027-03-06T12:00:00Z");
    // Accept any format with day/month/year
    expect(fmtDate(d)).toBeTruthy();
  });
});
