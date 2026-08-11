import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { KANBAN_STAGES, formatDaysInStage } from "@ar/ai/crm";
import { fmtDate } from "@ar/shared";
import { Calendar, Clock, Disc3, Users, Wrench } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

export default async function ReleaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];
  const daysInStage = r.stage_since
    ? Math.floor((Date.now() - new Date(r.stage_since).getTime()) / 86400000)
    : 0;

  // Gather all unique participants across tracks
  const participantMap = new Map<string, { stage_name: string; position: number; billing_role: string; tracks: string[] }>();
  for (const track of tracks) {
    for (const tp of track.track_participants ?? []) {
      const a = tp.artists;
      if (!a) continue;
      if (participantMap.has(a.id)) {
        // Don't duplicate track names
      } else {
        participantMap.set(a.id, { stage_name: a.stage_name, position: tp.position, billing_role: tp.billing_role, tracks: [] });
      }
    }
  }

  const participants = Array.from(participantMap.values()).sort((a, b) => a.position - b.position);

  // Registration status counts
  const regs = tracks.flatMap((t: any) => t.registrations ?? []);
  const regByKind: Record<string, any> = {};
  for (const reg of regs) {
    regByKind[reg.kind] = reg;
  }

  const REG_KINDS = ["obra_ecad", "fonograma_ecad", "isrc", "distribuicao", "youtube_cid"];
  const regLabels: Record<string, string> = {
    obra_ecad: "Obra ECAD", fonograma_ecad: "Fonograma ECAD", isrc: "ISRC",
    distribuicao: "Distribuição", youtube_cid: "YouTube CID",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main info */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Disc3 className="h-4 w-4" />
            Faixas ({tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhuma faixa cadastrada</p>
          ) : (
            <div className="space-y-3">
              {tracks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-fg">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {t.audio_duration_sec && (
                        <span className="text-xs text-fg-muted">
                          {Math.floor(t.audio_duration_sec / 60)}:{String(t.audio_duration_sec % 60).padStart(2, "0")}
                        </span>
                      )}
                      {t.isrc && <span className="text-xs text-fg-muted font-mono">ISRC: {t.isrc}</span>}
                      {t.audio_bpm && <span className="text-xs text-fg-muted">{t.audio_bpm} BPM</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {t.track_participants?.length ?? 0} participantes
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                No estágio
              </span>
              <span className="text-sm text-fg tabular-nums">{formatDaysInStage(daysInStage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Lançamento
              </span>
              <span className="text-sm text-fg">{fmtDate(r.release_date)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participantes ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{p.stage_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.billing_role === "primary" ? "Principal" : "Feat."}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Registration checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {REG_KINDS.map((kind) => {
                const reg = regByKind[kind];
                const status = reg?.status ?? "pendente";
                const variant =
                  status === "concluido" ? "success" :
                  status === "em_andamento" ? "warning" :
                  status === "rejeitado" ? "danger" : "secondary";
                return (
                  <div key={kind} className="flex items-center justify-between text-sm">
                    <span className="text-fg-muted">{regLabels[kind]}</span>
                    <Badge variant={variant} className="text-[10px]">
                      {status === "em_andamento" ? "em andamento" : status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
