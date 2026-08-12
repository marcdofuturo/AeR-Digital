import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";

export type ArtistReleaseSummary = {
  id: string;
  title: string;
  release_date: string;
  stage: string;
  track_title: string;
};

type ArtistTrackParticipation = {
  track_id?: string | null;
  tracks?: {
    id?: string | null;
    title?: string | null;
    release_id?: string | null;
    releases?: {
      id?: string | null;
      title?: string | null;
      release_date?: string | null;
      stage?: string | null;
    } | null;
  } | null;
};

export function mapArtistReleases(participations: ArtistTrackParticipation[]): ArtistReleaseSummary[] {
  const releaseMap = new Map<string, ArtistReleaseSummary>();

  for (const tp of participations) {
    const track = tp.tracks;
    const release = track?.releases;
    const releaseId = release?.id ?? track?.release_id;
    if (!track || !release || !releaseId) continue;

    releaseMap.set(`${releaseId}:${track.id ?? tp.track_id ?? track.title}`, {
      id: releaseId,
      title: release.title ?? "-",
      release_date: release.release_date ?? "",
      stage: release.stage ?? "em_analise",
      track_title: track.title ?? "-",
    });
  }

  return Array.from(releaseMap.values()).sort(
    (a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime(),
  );
}

export async function getArtists(tenantId?: string, search?: string) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("artists")
    .select("*, track_participants(track_id, tracks(id, title, release_id, releases(id, title)))")
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .order("stage_name", { ascending: true });

  if (search) {
    query = query.or(`stage_name.ilike.%${search}%,legal_name.ilike.%${search}%`);
  }

  const { data } = await query.limit(100);
  return data ?? [];
}

export async function getArtist(tenantId: string, artistId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("artists")
    .select("*, artist_contacts(*), track_participants(track_id, tracks!inner(id, title, release_id, releases!inner(id, title, release_date, stage)))")
    .eq("tenant_id", tenantId)
    .eq("id", artistId)
    .single();

  return data;
}
