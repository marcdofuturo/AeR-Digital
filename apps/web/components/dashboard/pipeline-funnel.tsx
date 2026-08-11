import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KANBAN_STAGES } from "@ar/ai/crm";

interface PipelineFunnelProps {
  data: Array<{ stage: string; count: number; avgDays: number | null }>;
}

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg-muted text-center py-12">
            Nenhum lançamento no pipeline
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Build a lookup from the KANBAN_STAGES order
  const stageOrder = Object.fromEntries(
    KANBAN_STAGES.map((s, i) => [s.id, i]),
  );
  const stageLabels = Object.fromEntries(
    KANBAN_STAGES.map((s) => [s.id, s.label]),
  );
  const sorted = [...data].sort(
    (a, b) => (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map((item) => (
            <div key={item.stage} className="flex items-center gap-3">
              <div className="w-28 text-xs text-fg-muted text-right shrink-0">
                {stageLabels[item.stage] ?? item.stage}
              </div>
              <div className="flex-1 relative h-7">
                <div
                  className="absolute inset-y-0 left-0 bg-brand/40 rounded transition-all"
                  style={{ width: `${Math.max((item.count / maxCount) * 100, 2)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs text-fg font-medium">
                  {item.count}
                </span>
              </div>
              {item.avgDays != null && (
                <div className="w-20 text-xs text-fg-muted shrink-0">
                  {item.avgDays}d méd.
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
