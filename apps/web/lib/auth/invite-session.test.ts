import { describe, expect, it } from "vitest";
import { parseInviteSession, safeInviteDestination } from "./invite-session";

describe("invite session", () => {
  it("parses the Supabase invite session returned in the URL fragment", () => {
    expect(parseInviteSession(
      "#access_token=access-1&refresh_token=refresh-1&type=invite",
    )).toEqual({ accessToken: "access-1", refreshToken: "refresh-1" });
  });

  it("rejects non-invite fragments and external redirects", () => {
    expect(parseInviteSession("#access_token=a&refresh_token=r&type=recovery")).toBeNull();
    expect(safeInviteDestination("https://evil.example/path")).toBe("/");
    expect(safeInviteDestination("//evil.example/path")).toBe("/");
    expect(safeInviteDestination("/config/equipe")).toBe("/config/equipe");
  });
});
