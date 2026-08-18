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
  if (!value?.startsWith("/")) return "/";

  try {
    const internalOrigin = "https://aerdigital.internal";
    const destination = new URL(value, internalOrigin);
    if (destination.origin !== internalOrigin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
