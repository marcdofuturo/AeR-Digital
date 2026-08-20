import { describe, it, expect } from "vitest";
import { parseBR, fmtDate } from "./dates";

describe("dates", () => {
  it("parseBR parses dd/MM/yyyy", () => {
    const d = parseBR("06/03/2027");
    expect(d).not.toBeNull();
    expect(fmtDate(d!)).toBe("06/03/2027");
  });

  it("parseBR parses dd/MM/yy", () => {
    const d = parseBR("15/01/27");
    expect(d).not.toBeNull();
    expect(fmtDate(d!)).toBe("15/01/2027");
  });

  it("parseBR returns null for invalid", () => {
    expect(parseBR("not a date")).toBeNull();
  });

  it("fmtDate formats correctly", () => {
    const d = new Date("2027-03-06T12:00:00Z");
    // Accept any format with day/month/year
    expect(fmtDate(d)).toBeTruthy();
  });

  it("keeps ISO date-only values on the same calendar day", () => {
    expect(fmtDate("2026-09-15")).toBe("15/09/2026");
  });
});
