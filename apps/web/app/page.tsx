import { StatsGrid } from "@/components/dashboard/stats-grid";
import { CatalogGrowthChart } from "@/components/dashboard/catalog-growth-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { UrgentTasks } from "@/components/dashboard/urgent-tasks";
import { IntakeWhatsappLink } from "@/components/dashboard/intake-whatsapp-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogGrowth, getPipelineFunnel, getRecentActivity } from "@/lib/data/dashboard";
import { getTenant } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";

export default async function DashboardPage() {
  const [tenant, growth, funnel, activity, statsGrid, urgentTasks] = await Promise.all([
    getTenant(),
    getCatalogGrowth(),
    getPipelineFunnel(),
    getRecentActivity(),
    StatsGrid(),
    UrgentTasks(),
  ]);

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">{tenant?.name ?? "Carregando..."}</p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted">
          Plano {tenant?.plan ?? "trial"}
        </div>
      </div>

      <div className="mb-8">{statsGrid}</div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CatalogGrowthChart data={growth} />
        <PipelineFunnel data={funnel} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {urgentTasks}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent>
            {!activity.length ? (
              <p className="py-8 text-center text-sm text-fg-muted">
                Nenhuma atividade ainda.
                <br />
                <span className="text-xs">
                  Compartilhe o link de WhatsApp com seus artistas para começar.
                </span>
              </p>
            ) : (
              <div className="space-y-3">
                {activity.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">{item.action}</p>
                      <p className="text-xs text-fg-muted">
                        {fmtDate(item.created_at, "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {tenant && <IntakeWhatsappLink code={tenant.intake_code} />}
    </div>
  );
}
