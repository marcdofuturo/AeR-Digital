const RELEASE_ASSET_PATH = "/storage/v1/object/public/release-assets/";

export function isUsablePresentationAudioUrl(
  value: unknown,
  configuredProjectUrl: string | undefined,
): value is string {
  if (typeof value !== "string" || !value.trim() || !configuredProjectUrl?.trim()) return false;

  try {
    const url = new URL(value.trim());
    const project = new URL(configuredProjectUrl.trim());
    return (
      url.protocol === "https:" &&
      url.origin === project.origin &&
      url.pathname.startsWith(RELEASE_ASSET_PATH)
    );
  } catch {
    return false;
  }
}
