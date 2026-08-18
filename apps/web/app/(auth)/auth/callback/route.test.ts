import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
    },
  }),
}));

import { GET } from "./route";

describe("auth callback", () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
    mocks.verifyOtp.mockReset();
  });

  it("accepts token_hash magic links and redirects to the requested page", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(
      new Request("https://aerdigital.pages.dev/auth/callback?token_hash=hash123&next=/releases"),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash123",
      type: "email",
    });
    expect(response.headers.get("location")).toBe("https://aerdigital.pages.dev/releases");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("preserves the invite OTP type supplied by Supabase", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });

    await GET(new Request(
      "https://aerdigital.pages.dev/auth/callback?token_hash=invite123&type=invite&next=/config/equipe",
    ));

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "invite123",
      type: "invite",
    });
  });

  it.each(["https://evil.example/phishing", "//evil.example/phishing", "/\\evil.example/phishing"])(
    "rejects the external next destination %s",
    async (destination) => {
      mocks.verifyOtp.mockResolvedValue({ error: null });

      const url = new URL("https://aerdigital.pages.dev/auth/callback");
      url.searchParams.set("token_hash", "hash123");
      url.searchParams.set("next", destination);
      const response = await GET(new Request(url));

      expect(response.headers.get("location")).toBe("https://aerdigital.pages.dev/");
    },
  );
});
