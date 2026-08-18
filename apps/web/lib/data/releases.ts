import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";
import { cache } from "react";

export async function getReleases(tenantId?: string) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("releases")
    .select(`
      *,
      tracks(
        id,
        title,
        isrc,
        audio_url,
        audio_duration_sec,
        audio_bpm,
        audio_key,
        explicit,
        track_participants(
          position,
          billing_role,
          is_producer,
          is_composer,
          is_performer,
          artists(id, stage_name)
        ),
        registrations(kind, status, entity, external_id, due_at)
      ),
      authorizations(
        status,
        authorization_recipients(status, name, email)
      )
    `)
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .order("release_date", { ascending: true });

  return data ?? [];
}

export const getRelease = cache(async function getRelease(tenantId: string, releaseId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("releases")
    .select("*, tracks(*, track_participants(*, artists!inner(*)), registrations(*), splits(*), pitches(*), presentation_jobs(*)), authorizations(*, authorization_recipients(*))")
    .eq("tenant_id", tenantId)
    .eq("id", releaseId)
    .single();

  return data;
});
