import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";

describe("global Tailwind stylesheet", () => {
  it("keeps PostCSS in a config filename that Next.js loads", async () => {
    await expect(
      fs.access(path.join(__dirname, "..", "postcss.config.mjs")),
    ).resolves.toBeUndefined();

    await expect(
      fs.access(path.join(__dirname, "..", "postcss.config.ts")),
    ).rejects.toThrow();
  });

  it("emits utilities used by the production app shell", async () => {
    const globalsPath = path.join(__dirname, "globals.css");
    const css = await fs.readFile(globalsPath, "utf8");

    const result = await postcss([tailwindcss()]).process(css, {
      from: globalsPath,
    });

    expect(result.css).toContain(".flex");
    expect(result.css).toContain(".w-64");
    expect(result.css).toContain(".bg-bg");
    expect(result.css).toContain(".bg-surface");
    expect(result.css).toContain(".border-border");
    expect(result.css).toContain(".rounded-md");
    expect(result.css).toContain(".font-sans");
  }, 30000);
});
