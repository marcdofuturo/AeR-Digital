import { describe, expect, it } from "vitest";
import { formatTrackDuration, parseTrackDuration } from "./duration";

describe("track duration", () => {
  it("formats seconds as zero-padded minutes and seconds", () => {
    expect(formatTrackDuration(125)).toBe("02:05");
    expect(formatTrackDuration(59)).toBe("00:59");
    expect(formatTrackDuration(3600)).toBe("60:00");
  });

  it("parses MM:SS back to seconds", () => {
    expect(parseTrackDuration("02:05")).toBe(125);
    expect(parseTrackDuration("60:00")).toBe(3600);
    expect(parseTrackDuration("")).toBeNull();
  });

  it("rejects invalid seconds", () => {
    expect(() => parseTrackDuration("02:75")).toThrow(/dura/i);
  });
});
