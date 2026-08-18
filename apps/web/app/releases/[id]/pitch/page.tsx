import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/forms/save-button";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_CREDIT_COST, remainingAiCredits } from "@/lib/ai/presentation";
import { generatePresentationForTrack } from "@/app/releases/actions";
import { fmtDate } from "@ar/shared";
import { FileText, Sparkles } from "lucide-react";
import { PresentationJobRefresh } from "@/components/releases/presentation-job-refresh";

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const [release, usedCredits] = await Promise.all([
    getRelease(tenantId, id),
    countTenantPresentationUsage(tenantId),
  ]);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];
  const credits = remainingAiCredits(usedCredits);
  const canGenerate = credits >= AI_CREDIT_COST;
  const hasActiveJobs = tracks.some((track: any) =>
    (track.presentation_jobs ?? []).some((job: any) => ["queued", "processing"].includes(job.status)),
  );

  return (
    <div className="space-y-6">
      <PresentationJobRefresh active={hasActiveJobs} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand" />
            Apresentação com IA
          </CardTitle>
          <CardDescription>
            Você tem {credits} crédito(s) de IA. Cada geração usa {AI_CREDIT_COST} créditos.
          </CardDescription>
        </CardHeader>
      </Card>

      {tracks.map((track: any) => {
        const presentations = [...(track.pitches ?? [])].sort(
          (a: any, b: any) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
        );
        const jobs = [...(track.presentation_jobs ?? [])].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const activeJob = jobs.find((job: any) => ["queued", "processing"].includes(job.status));
        const latestJob = jobs[0];

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {presentations.length === 0 ? "Nenhuma apresentação gerada" : `${presentations.length} apresentação(ões) gerada(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={generatePresentationForTrack} className="rounded-md border border-border/50 bg-bg p-3">
                <input type="hidden" name="release_id" value={id} />
                <input type="hidden" name="track_id" value={track.id} />
                <label className="block text-xs font-medium text-fg-muted">
                  Pedido de melhoria ou direcionamento
                  <textarea
                    name="user_guidance"
                    rows={3}
                    placeholder="Ex.: deixe mais direto, cite o refrão, foque em playlists de funk..."
                    className="mt-1 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                  />
                </label>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-fg-muted">
                    Sem texto, a IA gera uma primeira apresentação da música. Com texto, gera nova versão seguindo suas dicas.
                  </p>
                  <SaveButton size="sm" disabled={!canGenerate || Boolean(activeJob)} pendingLabel="Enfileirando..." savedLabel="Na fila">
                    <Sparkles className="h-4 w-4" />
                    Gerar apresentação
                  </SaveButton>
                </div>
              </form>

              {latestJob && latestJob.status !== "completed" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/40 p-3 text-xs text-fg-muted">
                  <Badge variant={latestJob.status === "failed" ? "danger" : latestJob.status === "processing" ? "warning" : "info"}>
                    {latestJob.status === "queued" ? "Na fila" : latestJob.status === "processing" ? "Transcrevendo e pesquisando" : "Falhou"}
                  </Badge>
                  <span>
                    {latestJob.status === "failed"
                      ? latestJob.last_error ?? "Nao foi possivel concluir a apresentacao."
                      : "A pagina atualiza automaticamente quando o pitching estiver pronto."}
                  </span>
                </div>
              ) : null}

              {presentations.length === 0 ? (
                <div className="py-8 text-center">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-fg-muted" />
                  <p className="text-sm text-fg-muted">
                    Gere uma apresentação para curadoria, parceiros e distribuição.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {presentations.map((presentation: any, idx: number) => {
                    const analysis = presentation.analysis ?? {};
                    const guidance = analysis.user_guidance as string | null | undefined;

                    return (
                      <Card key={presentation.id ?? idx} className="border-2 border-border">
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4" />
                              Apresentação {presentations.length - idx}
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {fmtDate(presentation.generated_at, "dd/MM/yyyy HH:mm")}
                            </Badge>
                          </div>
                          {guidance && (
                            <CardDescription className="text-xs">
                              Pedido: {guidance}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
                            {presentation.option_a}
                          </p>
                          {Array.isArray(analysis.avisos) && analysis.avisos.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {analysis.avisos.map((warning: string) => (
                                <Badge key={warning} variant="outline" className="text-[10px]">
                                  {warning}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {Array.isArray(analysis.fontes) && analysis.fontes.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {analysis.fontes.map((source: { titulo?: string; url?: string }) =>
                                source.url?.startsWith("https://") ? (
                                  <a
                                    key={source.url}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-brand underline-offset-4 hover:underline"
                                  >
                                    {source.titulo || "Fonte da pesquisa"}
                                  </a>
                                ) : null,
                              )}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function countTenantPresentationUsage(tenantId: string) {
  const supabase = createAdminClient();
  const [{ count: generated }, { count: active }] = await Promise.all([
    supabase.from("pitches").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("presentation_jobs").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("status", ["queued", "processing"]),
  ]);

  return (generated ?? 0) + (active ?? 0);
}
