import { Suspense } from "react";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { CatalogGrowthChart } from "@/components/dashboard/catalog-growth-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { UrgentTasks } from "@/components/dashboard/urgent-tasks";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogGrowth, getPipelineFunnel, getRecentActivity } from "@/lib/data/dashboard";
import { getTenant } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { Link2 } from "lucide-react";

export default async function DashboardPage() {
  const tenant = await getTenant();
  const [growth, funnel, activity] = await Promise.all([
    getCatalogGrowth(),
    getPipelineFunnel(),
    getRecentActivity(),
  ]);

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
          <p className="text-sm text-fg-muted mt-1">{tenant?.name ?? "Carregando..."}</p>
        </div>
        <div className="text-xs text-fg-muted bg-surface border border-border px-3 py-1.5 rounded-full">
          Plano {tenant?.plan ?? "trial"}
        </div>
      </div>

      {/* Stats */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-9 w-20 mb-2" />
                  <Skeleton className="h-4 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <div className="mb-8">
          <StatsGrid />
        </div>
      </Suspense>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CatalogGrowthChart data={growth} />
        <PipelineFunnel data={funnel} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UrgentTasks />

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent>
            {!activity.length ? (
              <p className="text-sm text-fg-muted text-center py-8">
                Nenhuma atividade ainda.
                <br />
                <span className="text-xs">
                  Compartilhe o link de intake com seus artistas para começar.
                </span>
              </p>
            ) : (
              <div className="space-y-3">
                {activity.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-brand shrink-0" />
                    <div className="flex-1 min-w-0">
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

      {/* Intake link */}
      {tenant && (
        <div className="mt-8 bg-gradient-to-r from-brand/10 to-purple-900/20 border border-brand/20 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Link2 className="h-5 w-5 text-brand" />
            <h2 className="font-semibold text-fg">Link de Intake</h2>
          </div>
          <p className="text-sm text-fg-muted mb-3">
            Compartilhe este link com seus artistas para que eles enviem lançamentos pelo WhatsApp:
          </p>
          <code className="block bg-bg border border-border rounded-lg px-4 py-3 text-sm text-brand font-mono break-all">
            https://wa.me/5511948059297?text={tenant.intake_code}
          </code>
          <p className="text-xs text-fg-muted mt-2">
            O código <span className="text-brand font-mono">{tenant.intake_code}</span> identifica seu selo automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
