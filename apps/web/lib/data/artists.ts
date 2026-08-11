import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getArtists(tenantId?: string, search?: string) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = await createClient();
  let query = supabase
    .from("artists")
    .select("*, track_participants(count)")
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("artists")
    .select("*, artist_contacts(*), track_participants(track_id, tracks!inner(title, release_id, releases!inner(title, release_date, stage)))")
    .eq("tenant_id", tenantId)
    .eq("id", artistId)
    .single();

  return data;
}
