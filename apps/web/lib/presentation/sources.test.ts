import { describe, expect, it } from "vitest";
import {
  PRESENTATION_SOURCE_DISPLAY_LIMIT,
  summarizePresentationSources,
} from "./sources";

describe("presentation source summary", () => {
  it("keeps unique HTTPS sources and caps the rendered list", () => {
    const sources = Array.from({ length: PRESENTATION_SOURCE_DISPLAY_LIMIT + 4 }, (_, index) => ({
      titulo: `Fonte ${index + 1}`,
      url: `https://example.com/source-${index + 1}`,
    }));

    const result = summarizePresentationSources([
      ...sources,
      sources[0],
      { titulo: "Insegura", url: "http://example.com/insecure" },
      { titulo: "", url: "https://example.com/untitled" },
    ]);

    expect(result.total).toBe(PRESENTATION_SOURCE_DISPLAY_LIMIT + 4);
    expect(result.visible).toHaveLength(PRESENTATION_SOURCE_DISPLAY_LIMIT);
    expect(result.visible[0]).toEqual(sources[0]);
  });
});
