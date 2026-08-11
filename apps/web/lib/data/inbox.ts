import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getSubmissions(tenantId?: string, filters?: {
  status?: string;
}) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = await createClient();
  let query = supabase
    .from("submissions")
    .select("*, whatsapp_sessions!inner(phone, step, draft), whatsapp_identities(phone_e164), artists(stage_name)")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data } = await query.limit(50);
  return data ?? [];
}

export async function getSubmission(tenantId: string, submissionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select("*, submission_messages(*), whatsapp_sessions(*)")
    .eq("tenant_id", tenantId)
    .eq("id", submissionId)
    .single();

  return data;
}
