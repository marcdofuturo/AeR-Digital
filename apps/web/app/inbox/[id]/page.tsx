import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { billingRoleClasses, billingRoleLabel } from "@/lib/artists/billing-role";
import { Button } from "@/components/ui/button";
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Conversation */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" />
            Conversa
          </CardTitle>
          <Badge variant="secondary">{messages.length} mensagens</Badge>
        </CardHeader>
        <CardContent>
          {!messages.length ? (
            <p className="text-fg-muted py-8 text-center text-sm">Nenhuma mensagem registrada</p>
          ) : (
            <div className="max-h-[500px] space-y-3 overflow-y-auto">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "in" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.direction === "in"
                        ? "bg-success/10 text-fg border-success/20 border"
                        : "bg-surface-2 text-fg border-border border"
                    }`}
                  >
                    <p>{msg.content ?? (msg.has_media ? "[Mídia]" : "")}</p>
                    <p className="text-fg-muted mt-1 text-xs">{fmtDate(msg.created_at, "HH:mm")}</p>
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-fg-muted text-xs">Título</span>
              <p className="text-fg text-sm font-medium">{draft.title ?? "—"}</p>
            </div>
            {draft.genres && (
              <div>
                <span className="text-fg-muted text-xs">Gêneros</span>
                <div className="mt-1 flex gap-1">
                  {draft.genres.map((g: string) => (
                    <Badge key={g} variant="secondary" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {draft.release_date && (
              <div>
                <span className="text-fg-muted text-xs">Data de lançamento</span>
                <p className="text-fg text-sm">{fmtDate(draft.release_date)}</p>
              </div>
            )}
            <div>
              <span className="text-fg-muted text-xs">Status</span>
              <p className="text-fg text-sm">{(submission as any).status}</p>
            </div>
          </CardContent>
        </Card>

        {/* Artists */}
        {artists.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
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
                      {a.legal_name && <span className="text-fg-muted ml-1">({a.legal_name})</span>}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${billingRoleClasses(a.billing_role)}`}
                    >
                      {billingRoleLabel(a.billing_role)}
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
                  <p key={i} className="text-fg text-sm">
                    {p.name}
                  </p>
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
  const submissionDetail = await SubmissionDetail({ submissionId: id });

  return (
    <div className="max-w-[1400px] p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inbox">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-fg text-2xl font-bold">Submissão</h1>
          <p className="text-fg-muted mt-1 text-sm">Detalhes da submissão pelo WhatsApp</p>
        </div>
      </div>

      {submissionDetail}
    </div>
  );
}
