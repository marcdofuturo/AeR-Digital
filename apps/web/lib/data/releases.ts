import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getReleases(tenantId?: string) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("*, tracks(count), track_participants(artist_id, artists!inner(stage_name))")
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .order("release_date", { ascending: true });

  return data ?? [];
}

export async function getRelease(tenantId: string, releaseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("*, tracks(*, track_participants(*, artists!inner(*)), registrations(*), splits(*), pitches(*)), authorizations(*)")
    .eq("tenant_id", tenantId)
    .eq("id", releaseId)
    .single();

  return data;
}
