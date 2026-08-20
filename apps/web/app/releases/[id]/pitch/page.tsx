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
import { isUsablePresentationAudioUrl } from "@/lib/presentation/audio";

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
  const hasActiveJobs = tracks.some((track: any) =>
    (track.presentation_jobs ?? []).some((job: any) =>
      ["queued", "processing"].includes(job.status),
    ),
  );

  return (
    <div className="space-y-6">
      <PresentationJobRefresh active={hasActiveJobs} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="text-brand h-4 w-4" />
            Apresentação com IA
          </CardTitle>
          <CardDescription>
            Cada faixa recebe duas apresentações incluídas. A terceira e as seguintes usam{" "}
            {AI_CREDIT_COST} créditos. Saldo: {credits}.
          </CardDescription>
        </CardHeader>
      </Card>

      {tracks.map((track: any) => {
        const presentations = [...(track.pitches ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
        );
        const jobs = [...(track.presentation_jobs ?? [])].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const activeJob = jobs.find((job: any) => ["queued", "processing"].includes(job.status));
        const latestJob = jobs[0];
        const hasUsableAudio = isUsablePresentationAudioUrl(
          track.audio_url,
          process.env.NEXT_PUBLIC_SUPABASE_URL,
        );
        const includedGeneration = presentations.length < 2;
        const canGenerate = hasUsableAudio && (includedGeneration || credits >= AI_CREDIT_COST);

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {presentations.length === 0
                  ? "Nenhuma apresentação gerada"
                  : `${presentations.length} apresentação(ões) gerada(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                action={generatePresentationForTrack}
                className="border-border/50 bg-bg rounded-md border p-3"
              >
                <input type="hidden" name="release_id" value={id} />
                <input type="hidden" name="track_id" value={track.id} />
                <label className="text-fg-muted block text-xs font-medium">
                  Pedido de melhoria ou direcionamento
                  <textarea
                    name="user_guidance"
                    rows={3}
                    placeholder="Ex.: deixe mais direto, destaque o refrão e a energia da faixa..."
                    className="border-border bg-surface text-fg mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-fg-muted text-xs">
                    {hasUsableAudio
                      ? "Sem texto, a IA gera uma primeira apresentação da música. Com texto, gera nova versão seguindo suas dicas."
                      : "Envie ou substitua o áudio por um arquivo válido antes de gerar a apresentação."}
                  </p>
                  <SaveButton
                    size="sm"
                    disabled={!canGenerate || Boolean(activeJob)}
                    pendingLabel="Enfileirando..."
                    savedLabel="Na fila"
                  >
                    <Sparkles className="h-4 w-4" />
                    {!hasUsableAudio
                      ? "Áudio necessário"
                      : includedGeneration
                        ? "Gerar apresentação incluída"
                        : `Gerar nova apresentação · ${AI_CREDIT_COST} créditos`}
                  </SaveButton>
                </div>
              </form>

              {latestJob && latestJob.status !== "completed" ? (
                <div className="border-border bg-surface-2/40 text-fg-muted flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs">
                  <Badge
                    variant={
                      latestJob.status === "failed"
                        ? "danger"
                        : latestJob.status === "processing"
                          ? "warning"
                          : "info"
                    }
                  >
                    {latestJob.status === "queued"
                      ? "Na fila"
                      : latestJob.status === "processing"
                        ? "Gerando apresentação"
                        : "Falhou"}
                  </Badge>
                  <span>
                    {latestJob.status === "failed"
                      ? (latestJob.last_error ?? "Nao foi possivel concluir a apresentacao.")
                      : "A pagina atualiza automaticamente quando o pitching estiver pronto."}
                  </span>
                </div>
              ) : null}

              {presentations.length === 0 ? (
                <div className="py-8 text-center">
                  <Sparkles className="text-fg-muted mx-auto mb-2 h-8 w-8" />
                  <p className="text-fg-muted text-sm">
                    Gere uma apresentação para curadoria, parceiros e distribuição.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {presentations.map((presentation: any, idx: number) => (
                    <Card key={presentation.id ?? idx} className="border-border border-2">
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
                      </CardHeader>
                      <CardContent>
                        <p className="text-fg text-sm leading-relaxed whitespace-pre-wrap">
                          {presentation.option_a}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
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
  const [{ data: generated }, { data: active }] = await Promise.all([
    supabase.from("pitches").select("credit_cost").eq("tenant_id", tenantId),
    supabase
      .from("presentation_jobs")
      .select("credit_cost")
      .eq("tenant_id", tenantId)
      .in("status", ["queued", "processing"]),
  ]);

  return [...(generated ?? []), ...(active ?? [])].reduce(
    (total, row) => total + Number(row.credit_cost ?? 0),
    0,
  );
}
