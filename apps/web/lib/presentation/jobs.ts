import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueuePresentationJob(
  client: SupabaseClient,
  input: {
    tenantId: string;
    releaseId: string;
    trackId: string;
    userId: string;
    userGuidance: string | null;
  },
) {
  const { data, error } = await client
    .from("presentation_jobs")
    .insert({
      tenant_id: input.tenantId,
      release_id: input.releaseId,
      track_id: input.trackId,
      created_by: input.userId,
      user_guidance: input.userGuidance,
      status: "queued",
    })
    .select("id")
    .single();

  if (error?.code === "23505") throw new Error("Ja existe uma apresentacao em processamento para esta faixa");
  if (error || !data) throw new Error("Falha ao enfileirar a apresentacao");
  return data as { id: string };
}
