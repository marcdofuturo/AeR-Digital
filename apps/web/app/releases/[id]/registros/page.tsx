import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/forms/save-button";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { addTrackParticipant, saveRegistrationStatus, setReleaseStageFromForm } from "@/app/releases/actions";
import { AlertTriangle, CheckCheck, Clock, Plus, XCircle } from "lucide-react";
import {
  normalizeRegistrationStatus,
} from "@/lib/registration-status";

const REG_LABELS: Record<string, string> = {
  obra_ecad: "Status da obra",
  fonograma_ecad: "Status do fonograma",
  isrc: "ISRC",
  distribuicao: "Distribuição",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  pendente: "secondary",
  em_andamento: "warning",
  concluido: "success",
  rejeitado: "danger",
};

const REGISTRATION_ORDER = ["obra_ecad", "fonograma_ecad", "isrc", "distribuicao"];

export default async function RegistrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const [release, tenant] = await Promise.all([getRelease(tenantId, id), getTenant()]);
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
            Obra usa todos os participantes como autores/compositores. Fonograma usa produtores como músicos acompanhantes e o selo como produtor fonográfico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allObrasDone && r.stage === "registrar_obra" && (
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="registrar_fonograma" />
              <SaveButton size="sm" pendingLabel="Avançando...">Avançar para registrar fonograma</SaveButton>
            </form>
          )}

          {allFonogramasDone && r.stage === "registrar_fonograma" && (
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="pronto_p_distribuir" />
              <SaveButton size="sm" pendingLabel="Avançando...">Avançar para pronto p/ distribuir</SaveButton>
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
        const participants = [...(track.track_participants ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        const producers = participants.filter((tp: any) => tp.is_producer);
        const performers = participants.filter((tp: any) => tp.is_performer && !tp.is_producer);

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {participants.length} participante(s) · {producers.length} produtor(es) marcado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/50 bg-bg p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Registrar obra</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {participants.map((tp: any) => (
                    <div key={tp.id} className="text-sm text-fg">
                      {tp.artists?.legal_name ?? tp.artists?.stage_name ?? "Autor"}
                      <span className="ml-2 text-xs text-fg-muted">Autor/compositor</span>
                    </div>
                  ))}
                </div>
                <AddParticipantPanel releaseId={id} trackId={track.id} defaultComposer defaultPerformer />
              </div>

              <div className="rounded-md border border-border/50 bg-bg p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Registrar fonograma</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="text-sm text-fg">
                    {tenant?.name ?? "Audiolink Brasil"}
                    <span className="ml-2 text-xs text-fg-muted">Produtor fonográfico</span>
                  </div>
                  {performers.map((tp: any) => (
                    <div key={tp.id} className="text-sm text-fg">
                      {tp.artists?.legal_name ?? tp.artists?.stage_name ?? "Intérprete"}
                      <span className="ml-2 text-xs text-fg-muted">Intérprete</span>
                    </div>
                  ))}
                  {producers.map((tp: any) => (
                    <div key={tp.id} className="text-sm text-fg">
                      {tp.artists?.legal_name ?? tp.artists?.stage_name ?? "Produtor"}
                      <span className="ml-2 text-xs text-fg-muted">Músico acompanhante</span>
                    </div>
                  ))}
                </div>
                <AddParticipantPanel releaseId={id} trackId={track.id} defaultProducer />
              </div>

              <div className="space-y-3">
                {REGISTRATION_ORDER.map((kind) => {
                  const reg = byKind[kind];
                  const status = normalizeRegistrationStatus(reg?.status);
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
                          </select>
                        </label>
                        <Field name="entity" label={kind === "distribuicao" ? "Agregadora" : "Associação / entidade"} defaultValue={reg?.entity ?? ""} placeholder={kind === "distribuicao" ? "Altafonte, ONErpm, Tratore" : "UBC, Abramus, Audiolink"} />
                        <Field name="external_id" label={kind === "distribuicao" ? "UPC" : "Número externo"} defaultValue={reg?.external_id ?? ""} placeholder={kind === "distribuicao" ? "UPC" : "ISWC, ISRC, protocolo"} />
                        <Field name="notes" label="Observação" defaultValue={reg?.notes ?? ""} placeholder="Detalhes do cadastro" />
                      </div>

                      <div className="mt-3 flex justify-end">
                        <SaveButton size="sm" variant="outline">Salvar</SaveButton>
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

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="text-xs text-fg-muted">
      {label}
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg" />
    </label>
  );
}

function AddParticipantPanel({
  releaseId,
  trackId,
  defaultComposer = false,
  defaultPerformer = false,
  defaultProducer = false,
}: {
  releaseId: string;
  trackId: string;
  defaultComposer?: boolean;
  defaultPerformer?: boolean;
  defaultProducer?: boolean;
}) {
  return (
    <details className="mt-3 rounded-md border border-dashed border-border/70 bg-surface/40 p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-brand">
        <Plus className="h-4 w-4" />
        Adicionar participante
      </summary>
      <form action={addTrackParticipant} className="mt-3 grid gap-3 md:grid-cols-5">
        <input type="hidden" name="release_id" value={releaseId} />
        <input type="hidden" name="track_id" value={trackId} />
        <Field name="stage_name" label="Nome artístico" defaultValue="" placeholder="Nome no crédito" />
        <Field name="legal_name" label="Nome Completo" defaultValue="" placeholder="Nome civil" />
        <Field name="ecad_code" label="Código ECAD" defaultValue="" placeholder="ECAD" />
        <label className="text-xs text-fg-muted">
          Papel
          <select name="billing_role" defaultValue="primary" className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-fg">
            <option value="primary">Principal</option>
            <option value="featuring">Feat.</option>
          </select>
        </label>
        <div className="space-y-1 text-xs text-fg-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_composer" defaultChecked={defaultComposer} className="accent-brand" />
            Compositor
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_performer" defaultChecked={defaultPerformer} className="accent-brand" />
            Intérprete
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_producer" defaultChecked={defaultProducer} className="accent-brand" />
            Produtor
          </label>
          <SaveButton size="sm" className="mt-2 w-full" pendingLabel="Adicionando..." savedLabel="Adicionado">Adicionar</SaveButton>
        </div>
      </form>
    </details>
  );
}
