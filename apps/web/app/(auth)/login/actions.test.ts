import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSignInWithPassword = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("login action", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockRedirect.mockClear();
  });

  it("signs in with email and password and preserves redirect", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "marc@audiolinkbrasil.com");
    formData.set("password", "secret");
    formData.set("redirect", "/releases");

    const { login } = await import("./actions");

    await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/releases");
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "marc@audiolinkbrasil.com",
      password: "secret",
    });
  });
});
