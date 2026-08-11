import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { saveRegistrationStatus, setReleaseStageFromForm } from "@/app/releases/actions";
import { CheckCheck, Clock, AlertTriangle, XCircle } from "lucide-react";

const REG_LABELS: Record<string, string> = {
  obra_ecad: "Registrar obra",
  fonograma_ecad: "Registrar fonograma",
  isrc: "ISRC",
  distribuicao: "Distribuição",
  youtube_cid: "YouTube Content ID",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  pendente: "secondary",
  em_andamento: "warning",
  concluido: "success",
  rejeitado: "danger",
  na: "secondary",
};

const REGISTRATION_ORDER = ["obra_ecad", "fonograma_ecad", "isrc", "distribuicao", "youtube_cid"];

export default async function RegistrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];
  const allObrasDone = tracks.length > 0 && tracks.every((track: any) =>
    (track.registrations ?? []).some((reg: any) => reg.kind === "obra_ecad" && reg.status === "concluido"),
  );
  const allFonogramasDone = tracks.length > 0 && tracks.every((track: any) =>
    (track.registrations ?? []).some((reg: any) => reg.kind === "fonograma_ecad" && reg.status === "concluido"),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de registros</CardTitle>
          <CardDescription>
            Obra registra autores/compositores e splits. Fonograma usa compositores como autores, produtores como músicos acompanhantes e o selo do painel como produtor fonográfico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allObrasDone && r.stage === "registrar_obra" && (
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="registrar_fonograma" />
              <Button type="submit" size="sm">Avançar para registrar fonograma</Button>
            </form>
          )}

          {allFonogramasDone && r.stage === "registrar_fonograma" && (
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="pronto_p_distribuir" />
              <Button type="submit" size="sm">Avançar para pronto p/ distribuir</Button>
            </form>
          )}

          {tracks.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">Nenhuma faixa cadastrada</p>
          ) : null}
        </CardContent>
      </Card>

      {tracks.map((track: any) => {
        const regs = track.registrations ?? [];
        const byKind: Record<string, any> = {};
        for (const reg of regs) byKind[reg.kind] = reg;
        const participants = track.track_participants ?? [];
        const composers = participants.filter((tp: any) => tp.is_composer);
        const producers = participants.filter((tp: any) => tp.is_producer);

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {composers.length} autor(es) · {producers.length} produtor(es) marcado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/50 bg-bg p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Autores da obra</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {composers.map((tp: any) => (
                    <div key={tp.id} className="text-sm text-fg">
                      {tp.artists?.legal_name ?? tp.artists?.stage_name ?? "Autor"}
                      <span className="ml-2 text-xs text-fg-muted">split pro-rata</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {REGISTRATION_ORDER.map((kind) => {
                  const reg = byKind[kind];
                  const status = reg?.status ?? "pendente";
                  const isObraDone = kind === "obra_ecad" && status === "concluido";
                  return (
                    <form key={kind} action={saveRegistrationStatus} className="rounded-md border border-border/50 bg-bg p-3">
                      <input type="hidden" name="release_id" value={id} />
                      <input type="hidden" name="track_id" value={track.id} />
                      <input type="hidden" name="kind" value={kind} />

                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          {status === "concluido" ? (
                            <CheckCheck className="h-4 w-4 text-success" />
                          ) : status === "em_andamento" ? (
                            <Clock className="h-4 w-4 text-warning" />
                          ) : status === "rejeitado" ? (
                            <XCircle className="h-4 w-4 text-danger" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-fg-muted" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-fg">{REG_LABELS[kind]}</p>
                            {isObraDone && reg?.due_at && (
                              <p className="text-xs text-warning">
                                Verificar aceite/ISWC em {fmtDate(reg.due_at, "dd/MM/yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className="w-fit text-xs">
                          {status === "em_andamento" ? "em andamento" : status}
                        </Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4">
                        <label className="text-xs text-fg-muted">
                          Status
                          <select name="status" defaultValue={status} className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg">
                            <option value="pendente">Pendente</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="concluido">Concluído</option>
                            <option value="rejeitado">Rejeitado</option>
                            <option value="na">N/A</option>
                          </select>
                        </label>
                        <label className="text-xs text-fg-muted">
                          Associação / entidade
                          <input name="entity" defaultValue={reg?.entity ?? ""} placeholder="UBC, Abramus, Audiolink" className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg" />
                        </label>
                        <label className="text-xs text-fg-muted">
                          Número externo
                          <input name="external_id" defaultValue={reg?.external_id ?? ""} placeholder="ISWC, ISRC, protocolo" className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg" />
                        </label>
                        <label className="text-xs text-fg-muted">
                          Observação
                          <input name="notes" defaultValue={reg?.notes ?? ""} placeholder="Detalhes do cadastro" className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg" />
                        </label>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button type="submit" size="sm" variant="outline">Salvar</Button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
