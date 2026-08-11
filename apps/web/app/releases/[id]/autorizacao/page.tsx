import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import {
  markAuthorizationRecipientApproved,
  setReleaseStageFromForm,
} from "@/app/releases/actions";
import { FileText, Mail, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  rascunho: <FileText className="h-4 w-4 text-fg-muted" />,
  enviado: <Mail className="h-4 w-4 text-warning" />,
  parcial: <AlertTriangle className="h-4 w-4 text-warning" />,
  aprovado: <CheckCircle className="h-4 w-4 text-success" />,
  recusado: <XCircle className="h-4 w-4 text-danger" />,
  expirado: <Clock className="h-4 w-4 text-danger" />,
};

const RECIPIENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  pendente: "secondary",
  enviado: "warning",
  entregue: "warning",
  aberto: "warning",
  aprovado: "success",
  recusado: "danger",
  bounce: "danger",
};

export default async function AutorizacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const authorizations = r.authorizations ?? [];
  const recipients = authorizations.flatMap((auth: any) =>
    (auth.authorization_recipients ?? []).map((recipient: any) => ({
      ...recipient,
      authorizationStatus: auth.status,
    })),
  );
  const allApproved = recipients.length > 0 && recipients.every((recipient: any) => recipient.status === "aprovado");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de autorização</CardTitle>
          <CardDescription>
            Marque cada artista/responsável como OK somente depois de conferir a autorização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="h-10 w-10 text-fg-muted mx-auto mb-3" />
              <p className="text-fg-muted mb-1">Nenhuma autorização gerada</p>
              <p className="text-sm text-fg-muted">
                Gere o documento e adicione destinatários antes de mover para o próximo passo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipients.map((recipient: any) => {
                const approved = recipient.status === "aprovado";
                return (
                  <div key={recipient.id} className="flex flex-col gap-3 rounded-md border border-border/50 bg-bg p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`mt-0.5 h-4 w-4 ${approved ? "text-success" : "text-fg-muted"}`} />
                      <div>
                        <p className="text-sm font-medium text-fg">{recipient.name}</p>
                        <p className="text-xs text-fg-muted">{recipient.email}</p>
                        {recipient.responded_at && (
                          <p className="mt-1 text-[11px] text-fg-muted">
                            OK em {fmtDate(recipient.responded_at, "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={RECIPIENT_STATUS_VARIANT[recipient.status] ?? "secondary"} className="text-xs">
                        {recipient.status}
                      </Badge>
                      {!approved && (
                        <form action={markAuthorizationRecipientApproved}>
                          <input type="hidden" name="release_id" value={id} />
                          <input type="hidden" name="recipient_id" value={recipient.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Marcar OK
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {allApproved && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Autorizações completas</CardTitle>
            <CardDescription>
              Escolha se este lançamento terá registro de obra antes do fonograma.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="registrar_obra" />
              <Button type="submit">Registrar obra</Button>
            </form>
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="registrar_fonograma" />
              <Button type="submit" variant="outline">Pular obra</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {authorizations.length > 0 && (
        <div className="space-y-3">
          {authorizations.map((auth: any) => (
            <Card key={auth.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {STATUS_ICONS[auth.status] ?? null}
                    Documento de autorização
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Criado em {fmtDate(auth.created_at, "dd/MM/yyyy HH:mm")}
                    {auth.sent_at && ` · enviado em ${fmtDate(auth.sent_at, "dd/MM/yyyy HH:mm")}`}
                  </CardDescription>
                </div>
                <Badge variant={auth.status === "aprovado" ? "success" : auth.status === "recusado" || auth.status === "expirado" ? "danger" : "warning"}>
                  {auth.status}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
