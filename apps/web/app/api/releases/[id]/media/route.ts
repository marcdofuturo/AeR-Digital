import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/require-membership";

type MediaKind = "cover" | "audio";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let membership: Awaited<ReturnType<typeof requireMembership>>;
  try {
    membership = await requireMembership();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: releaseId } = await params;
  const search = new URL(request.url).searchParams;
  const kind = search.get("kind") as MediaKind | null;
  if (kind !== "cover" && kind !== "audio") {
    return new Response("Invalid media kind", { status: 400 });
  }

  const media = await findMedia({
    kind,
    releaseId,
    trackId: search.get("track_id"),
    tenantId: membership.tenantId,
  });
  if (!media || !isAllowedStorageUrl(media.url)) {
    return new Response("Media not found", { status: 404 });
  }

  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(media.url, {
      headers: range ? { range } : {},
      signal: request.signal,
    });
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    await upstream.body?.cancel().catch(() => undefined);
    return new Response("Media unavailable", { status: upstream.status === 404 ? 404 : 502 });
  }

  const extension = extensionFromUrl(media.url, kind);
  const fileName = `${safeFileName(media.title)}.${extension}`;
  const disposition = search.get("download") === "1" ? "attachment" : "inline";
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-disposition": `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "x-content-type-options": "nosniff",
  });
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

async function findMedia({
  kind,
  releaseId,
  trackId,
  tenantId,
}: {
  kind: MediaKind;
  releaseId: string;
  trackId: string | null;
  tenantId: string;
}) {
  const admin = createAdminClient();
  if (kind === "cover") {
    const { data, error } = await admin
      .from("releases")
      .select("title, cover_url")
      .eq("tenant_id", tenantId)
      .eq("id", releaseId)
      .single();
    if (error || !data?.cover_url) return null;
    return { title: data.title, url: data.cover_url };
  }

  if (!trackId) return null;
  const { data, error } = await admin
    .from("tracks")
    .select("title, audio_url")
    .eq("tenant_id", tenantId)
    .eq("release_id", releaseId)
    .eq("id", trackId)
    .single();
  if (error || !data?.audio_url) return null;
  return { title: data.title, url: data.audio_url };
}

function isAllowedStorageUrl(value: string) {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return false;
  try {
    const url = new URL(value);
    const supabase = new URL(configured);
    return (
      url.protocol === "https:" &&
      url.origin === supabase.origin &&
      url.pathname.startsWith("/storage/v1/object/public/release-assets/")
    );
  } catch {
    return false;
  }
}

function extensionFromUrl(value: string, kind: MediaKind) {
  try {
    const match = new URL(value).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {
    // The URL has already been validated. Keep a defensive fallback.
  }
  return kind === "cover" ? "jpg" : "wav";
}

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "arquivo";
}
