import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";

/** Raw row from the mv_pipeline materialized view */
interface PipelineRow {
  stage: string;
  total: number;
  dias_medio: number | null;
}

export async function getDashboardStats() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const supabase = createAdminClient();

  const { data: releaseStages } = await supabase
    .from("releases")
    .select("stage, stage_since")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const pipelineMap: Record<string, { total: number; days: number }> = {};
  const now = Date.now();
  for (const release of releaseStages ?? []) {
    const stage = release.stage;
    if (!pipelineMap[stage]) pipelineMap[stage] = { total: 0, days: 0 };
    pipelineMap[stage].total += 1;
    if (release.stage_since) {
      pipelineMap[stage].days += Math.max(0, (now - new Date(release.stage_since).getTime()) / 86400000);
    }
  }

  const pipeline: PipelineRow[] = Object.entries(pipelineMap).map(([stage, value]) => ({
    stage,
    total: value.total,
    dias_medio: value.total > 0 ? value.days / value.total : null,
  }));

  // Count releases
  const { count: totalReleases } = await supabase
    .from("releases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // Count pending authorizations
  const { count: pendingAuth } = await supabase
    .from("authorizations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("status", ["rascunho", "enviado", "parcial"]);

  // Count pending registrations
  const { count: pendingReg } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("status", ["pendente", "em_andamento"]);

  // Active releases (not archived)
  const { count: activeReleases } = await supabase
    .from("releases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("stage", "arquivado");

  return {
    totalReleases: totalReleases ?? 0,
    activeReleases: activeReleases ?? 0,
    pendingAuth: pendingAuth ?? 0,
    pendingReg: pendingReg ?? 0,
    pipeline: pipeline ?? [],
  };
}

export async function getCatalogGrowth() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("releases")
    .select("created_at, stage")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  // Aggregate by month
  const byMonth: Record<string, { month: string; total: number; ativos: number }> = {};
  for (const r of data) {
    const month = r.created_at.slice(0, 7); // "2027-03"
    if (!byMonth[month]) {
      byMonth[month] = { month, total: 0, ativos: 0 };
    }
    byMonth[month].total += 1;
    if (r.stage !== "arquivado") byMonth[month].ativos += 1;
  }

  return Object.values(byMonth).slice(-12); // last 12 months
}

export async function getPipelineFunnel() {
  const stats = await getDashboardStats();
  if (!stats?.pipeline.length) return [];

  return stats.pipeline.map((row) => ({
    stage: row.stage,
    count: row.total,
    avgDays: row.dias_medio ? Math.round(row.dias_medio * 10) / 10 : null,
  }));
}

export async function getUrgentTasks() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tasks")
    .select("*, profiles(full_name)")
    .eq("tenant_id", tenantId)
    .neq("status", "concluida")
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true })
    .limit(10);

  return data ?? [];
}

export async function getRecentActivity() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  return data ?? [];
}
