import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getTasks(tenantId?: string, filters?: {
  status?: string;
  priority?: string;
}) {
  const tid = tenantId ?? (await getCurrentTenantId());
  if (!tid) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("tasks")
    .select("*, profiles(full_name), releases!inner(title)")
    .eq("tenant_id", tid)
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true })
    .limit(100);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }

  const { data } = await query;
  return data ?? [];
}
