import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getRelease } from "@/lib/data/releases";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { History } from "lucide-react";

const ACTOR_ICONS: Record<string, string> = {
  user: "U",
  system: "S",
  artist: "A",
  ai: "AI",
};

export default async function AtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;

  // Fetch activity log for this release and its tracks
  const supabase = await createClient();
  const entityIds = [r.id, ...((r.tracks ?? []) as any[]).map((t: any) => t.id)];
  const { data: activity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Linha do tempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activity?.length ? (
          <p className="text-sm text-fg-muted text-center py-8">Nenhuma atividade registrada</p>
        ) : (
          <div className="space-y-0">
            {activity.map((entry: any) => (
              <div key={entry.id} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px] bg-surface-2">
                    {ACTOR_ICONS[entry.actor_type] ?? "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">{entry.action}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {entry.actor_type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {entry.entity_type}
                    </Badge>
                    <span className="text-xs text-fg-muted">
                      {fmtDate(entry.created_at, "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Diff toggle — show changes */}
                {entry.before && entry.after && (
                  <details className="text-xs text-fg-muted shrink-0">
                    <summary className="cursor-pointer hover:text-fg">diff</summary>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                      <div className="bg-surface-2 rounded p-1">
                        <span className="text-danger">−</span> {JSON.stringify(entry.before)}
                      </div>
                      <div className="bg-surface-2 rounded p-1">
                        <span className="text-success">+</span> {JSON.stringify(entry.after)}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
