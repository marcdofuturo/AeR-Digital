import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMiddlewareClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  createMiddlewareClient: mocks.createMiddlewareClient,
}));

import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";

describe("middleware public routes", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
    mocks.createMiddlewareClient.mockReset().mockReturnValue({
      supabase: { auth: { getUser: mocks.getUser } },
      response: NextResponse.next(),
    });
  });

  it("does not call Supabase Auth for a temporary upload page", async () => {
    const request = new NextRequest("https://aerdigital.pages.dev/envio/grant");

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mocks.createMiddlewareClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("still checks authentication for CRM routes", async () => {
    const request = new NextRequest("https://aerdigital.pages.dev/releases");

    const response = await middleware(request);

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?redirect=%2Freleases");
  });
});
