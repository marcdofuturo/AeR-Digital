export type InviteSession = {
  accessToken: string;
  refreshToken: string;
};

export function parseInviteSession(hash: string): InviteSession | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("type") !== "invite") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function safeInviteDestination(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
