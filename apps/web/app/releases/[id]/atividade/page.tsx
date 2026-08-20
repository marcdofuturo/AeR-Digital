import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getRelease } from "@/lib/data/releases";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { History } from "lucide-react";

const ACTOR_ICONS: Record<string, string> = { user: "U", system: "S", artist: "A", ai: "IA" };

export default async function AtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const supabase = createAdminClient();
  const entityIds = [r.id, ...((r.tracks ?? []) as any[]).map((track: any) => track.id)];
  const { data: activity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(100);
  const actorIds = [
    ...new Set(
      (activity ?? [])
        .filter((entry: any) => entry.actor_type === "user" && entry.actor_id)
        .map((entry: any) => entry.actor_id),
    ),
  ];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Historico de atividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activity?.length ? (
          <p className="text-fg-muted py-8 text-center text-sm">Nenhuma atividade registrada</p>
        ) : (
          <div>
            {activity.map((entry: any) => {
              const profile = profilesById.get(entry.actor_id) as
                { full_name?: string; email?: string } | undefined;
              return (
                <div
                  key={entry.id}
                  className="border-border/50 flex flex-col gap-3 border-b py-3 last:border-0 sm:flex-row"
                >
                  <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-surface-2 text-[10px]">
                      {ACTOR_ICONS[entry.actor_type] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm">{entry.action}</p>
                    <p className="text-fg-muted mt-0.5 text-xs">{actorLabel(entry, profile)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        {entry.entity_type}
                      </Badge>
                      <span className="text-fg-muted text-xs">
                        {fmtDate(entry.created_at, "dd/MM/yyyy HH:mm:ss")}
                      </span>
                    </div>
                  </div>
                  {entry.before || entry.after ? (
                    <details className="text-fg-muted text-xs sm:max-w-xl sm:shrink-0">
                      <summary className="hover:text-fg cursor-pointer">Ver alteracoes</summary>
                      <div className="mt-1 grid gap-1 text-[11px] sm:grid-cols-2">
                        {entry.before ? <ChangeBlock label="Antes" value={entry.before} /> : null}
                        {entry.after ? <ChangeBlock label="Depois" value={entry.after} /> : null}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function actorLabel(entry: any, profile?: { full_name?: string; email?: string }) {
  if (entry.actor_type === "user")
    return profile?.full_name || profile?.email || "Usuario do painel";
  if (entry.actor_type === "ai") return "Gerador de apresentacoes com IA";
  if (entry.actor_type === "artist") return "Artista";
  return "Sistema";
}

function ChangeBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div className="bg-surface-2 rounded p-2">
      <p className="text-fg mb-1 font-medium">{label}</p>
      {Object.entries(value).map(([key, item]) => (
        <p key={key} className="break-words">
          <span className="text-fg">{key.replaceAll("_", " ")}:</span> {formatValue(item)}
        </p>
      ))}
    </div>
  );
}

function formatValue(value: unknown) {
  if (value == null || value === "") return "vazio";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
