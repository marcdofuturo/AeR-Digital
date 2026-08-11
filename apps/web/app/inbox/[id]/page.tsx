import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSubmission } from "@/lib/data/inbox";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { ArrowLeft, MessageCircle, User, Music } from "lucide-react";

interface InboxDetailPageProps {
  params: Promise<{ id: string }>;
}

async function SubmissionDetail({ submissionId }: { submissionId: string }) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const submission = await getSubmission(tenantId, submissionId);
  if (!submission) notFound();

  const draft = (submission as any).whatsapp_sessions?.draft ?? {};
  const messages = (submission as any).submission_messages ?? [];
  const artists = draft.artists ?? [];
  const producers = draft.producers ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Conversation */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversa
          </CardTitle>
          <Badge variant="secondary">{messages.length} mensagens</Badge>
        </CardHeader>
        <CardContent>
          {!messages.length ? (
            <p className="text-sm text-fg-muted text-center py-8">Nenhuma mensagem registrada</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "in" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.direction === "in"
                        ? "bg-success/10 text-fg border border-success/20"
                        : "bg-surface-2 text-fg border border-border"
                    }`}
                  >
                    <p>{msg.content ?? (msg.has_media ? "[Mídia]" : "")}</p>
                    <p className="text-xs text-fg-muted mt-1">
                      {fmtDate(msg.created_at, "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Details */}
      <div className="space-y-6">
        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" />
              Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-xs text-fg-muted">Título</span>
              <p className="text-sm text-fg font-medium">{draft.title ?? "—"}</p>
            </div>
            {draft.genres && (
              <div>
                <span className="text-xs text-fg-muted">Gêneros</span>
                <div className="flex gap-1 mt-1">
                  {draft.genres.map((g: string) => (
                    <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                  ))}
                </div>
              </div>
            )}
            {draft.release_date && (
              <div>
                <span className="text-xs text-fg-muted">Data de lançamento</span>
                <p className="text-sm text-fg">{fmtDate(draft.release_date)}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-fg-muted">Status</span>
              <p className="text-sm text-fg">{(submission as any).status}</p>
            </div>
          </CardContent>
        </Card>

        {/* Artists */}
        {artists.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Participantes ({artists.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {artists.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-fg">{a.stage_name ?? a.input_name}</span>
                      {a.legal_name && (
                        <span className="text-fg-muted ml-1">({a.legal_name})</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {a.billing_role === "primary" ? "Principal" : "Feat."}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Producers */}
        {producers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produtores ({producers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {producers.map((p: any, i: number) => (
                  <p key={i} className="text-sm text-fg">{p.name}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default async function InboxDetailPage({ params }: InboxDetailPageProps) {
  const { id } = await params;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inbox">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-fg">Submissão</h1>
          <p className="text-sm text-fg-muted mt-1">Detalhes da submissão pelo WhatsApp</p>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <SubmissionDetail submissionId={id} />
      </Suspense>
    </div>
  );
}
