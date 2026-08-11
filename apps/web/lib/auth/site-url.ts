type HeaderReader = Pick<Headers, "get">;

export function resolveSiteUrl(
  configuredUrl: string | undefined,
  requestHeaders: HeaderReader,
  fallback = "http://localhost:3000",
): string {
  const configured = configuredUrl?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host")?.trim();
  if (!host) return fallback;

  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    "https";
  return `${protocol}://${host}`;
}
