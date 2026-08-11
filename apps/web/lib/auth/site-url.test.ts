import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("uses the configured production URL without a trailing slash", () => {
    expect(
      resolveSiteUrl("https://aerdigital.pages.dev/", new Headers()),
    ).toBe("https://aerdigital.pages.dev");
  });

  it("derives the public URL from Cloudflare forwarded headers", () => {
    const requestHeaders = new Headers({
      host: "aerdigital.pages.dev",
      "x-forwarded-proto": "https",
    });

    expect(resolveSiteUrl(undefined, requestHeaders)).toBe(
      "https://aerdigital.pages.dev",
    );
  });

  it("keeps localhost as the development fallback without request headers", () => {
    expect(resolveSiteUrl(undefined, new Headers())).toBe("http://localhost:3000");
  });
});
