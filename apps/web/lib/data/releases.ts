import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getReleases(tenantId?: string) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("*, tracks(id, track_participants(position, billing_role, artists(stage_name)))")
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .order("release_date", { ascending: true });

  return data ?? [];
}

export async function getRelease(tenantId: string, releaseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("*, tracks(*, track_participants(*, artists!inner(*)), registrations(*), splits(*), pitches(*)), authorizations(*, authorization_recipients(*))")
    .eq("tenant_id", tenantId)
    .eq("id", releaseId)
    .single();

  return data;
}
