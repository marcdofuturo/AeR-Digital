import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/forms/save-button";
import { EditableActionForm } from "@/components/forms/editable-action-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import {
  ensureReleaseAuthorizationChecklist,
  markAuthorizationRecipientApproved,
  saveAuthorizationRecipientEmail,
  setAuthorizationRecipientStatus,
  setReleaseStageFromForm,
} from "@/app/releases/actions";
import {
  FileText,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { AuthorizationStatusButton } from "@/components/releases/authorization-status-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_ICONS: Record<string, React.ReactNode> = {
  rascunho: <FileText className="text-fg-muted h-4 w-4" />,
  enviado: <Mail className="text-warning h-4 w-4" />,
  parcial: <AlertTriangle className="text-warning h-4 w-4" />,
  aprovado: <CheckCircle className="text-success h-4 w-4" />,
  recusado: <XCircle className="text-danger h-4 w-4" />,
  expirado: <Clock className="text-danger h-4 w-4" />,
};

const RECIPIENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "danger"
> = {
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

  const ensuredAuthorizations = await ensureReleaseAuthorizationChecklist(tenantId, id);
  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const releaseAuthorizations = r.authorizations ?? [];
  const hasReleaseRecipients = releaseAuthorizations.some(
    (auth: any) => (auth.authorization_recipients ?? []).length > 0,
  );
  const authorizations = hasReleaseRecipients ? releaseAuthorizations : ensuredAuthorizations;
  const recipients = authorizations.flatMap((auth: any) =>
    (auth.authorization_recipients ?? []).map((recipient: any) => ({
      ...recipient,
      authorizationStatus: auth.status,
    })),
  );
  const allApproved =
    recipients.length > 0 && recipients.every((recipient: any) => recipient.status === "aprovado");

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
            <div className="border-border rounded-lg border border-dashed p-8 text-center">
              <FileText className="text-fg-muted mx-auto mb-3 h-10 w-10" />
              <p className="text-fg-muted mb-1">Nenhuma autorização gerada</p>
              <p className="text-fg-muted text-sm">
                Gere o documento e adicione destinatários antes de mover para o próximo passo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipients.map((recipient: any) => {
                const approved = recipient.status === "aprovado";
                return (
                  <div
                    key={recipient.id}
                    className="border-border/50 bg-bg flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle
                        className={`mt-0.5 h-4 w-4 ${approved ? "text-success" : "text-fg-muted"}`}
                      />
                      <div>
                        <p className="text-fg text-sm font-medium">{recipient.name}</p>
                        <p className="text-fg-muted text-xs">
                          {String(recipient.email).endsWith("@aerdigital.local")
                            ? "Email não cadastrado"
                            : recipient.email}
                        </p>
                        {recipient.responded_at && (
                          <p className="text-fg-muted mt-1 text-[11px]">
                            OK em {fmtDate(recipient.responded_at, "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={RECIPIENT_STATUS_VARIANT[recipient.status] ?? "secondary"}
                        className="text-xs"
                      >
                        {recipient.status}
                      </Badge>
                      <AuthorizationStatusButton
                        releaseId={id}
                        recipientId={recipient.id}
                        approved={approved}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {recipients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emails de liberação por artista</CardTitle>
            <CardDescription>
              Salve o email uma vez para o artista; ele será reutilizado em novos lançamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={recipients[0]?.id} className="space-y-3">
              <TabsList className="flex h-auto flex-wrap justify-start">
                {recipients.map((recipient: any) => (
                  <TabsTrigger key={recipient.id} value={recipient.id} className="text-xs">
                    {recipient.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {recipients.map((recipient: any) => {
                const approved = recipient.status === "aprovado";
                const emailMissing = String(recipient.email).endsWith("@aerdigital.local");
                return (
                  <TabsContent key={recipient.id} value={recipient.id}>
                    <div className="border-border/50 bg-bg rounded-md border p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-fg text-sm font-medium">{recipient.name}</p>
                          <p className="text-fg-muted text-xs">
                            {emailMissing ? "Email não cadastrado" : recipient.email}
                          </p>
                        </div>
                        <Badge
                          variant={RECIPIENT_STATUS_VARIANT[recipient.status] ?? "secondary"}
                          className="text-xs"
                        >
                          {recipient.status}
                        </Badge>
                      </div>

                      <EditableActionForm
                        action={saveAuthorizationRecipientEmail}
                        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                        fieldsClassName="grid gap-2"
                        controlsClassName="flex justify-end gap-2"
                        editLabel="Editar email"
                        saveLabel="Salvar email"
                        savedLabel="Email salvo"
                        hiddenFields={
                          <>
                            <input type="hidden" name="release_id" value={id} />
                            <input type="hidden" name="recipient_id" value={recipient.id} />
                            <input
                              type="hidden"
                              name="artist_id"
                              value={recipient.artist_id ?? ""}
                            />
                          </>
                        }
                      >
                        <label className="text-fg-muted text-xs">
                          Email de liberação
                          <input
                            name="email"
                            type="email"
                            defaultValue={emailMissing ? "" : recipient.email}
                            placeholder="artista@email.com"
                            className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
                          />
                        </label>
                      </EditableActionForm>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {approved ? (
                          <form action={setAuthorizationRecipientStatus}>
                            <input type="hidden" name="release_id" value={id} />
                            <input type="hidden" name="recipient_id" value={recipient.id} />
                            <input type="hidden" name="status" value="pendente" />
                            <SaveButton
                              size="sm"
                              variant="outline"
                              pendingLabel="Atualizando..."
                              savedLabel="Pendente"
                            >
                              Retirar OK
                            </SaveButton>
                          </form>
                        ) : (
                          <form action={markAuthorizationRecipientApproved}>
                            <input type="hidden" name="release_id" value={id} />
                            <input type="hidden" name="recipient_id" value={recipient.id} />
                            <SaveButton
                              size="sm"
                              variant="outline"
                              pendingLabel="Atualizando..."
                              savedLabel="Marcado OK"
                            >
                              Marcar OK
                            </SaveButton>
                          </form>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

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
              <SaveButton pendingLabel="Avançando...">Registrar obra</SaveButton>
            </form>
            <form action={setReleaseStageFromForm}>
              <input type="hidden" name="release_id" value={id} />
              <input type="hidden" name="stage" value="registrar_fonograma" />
              <SaveButton variant="outline" pendingLabel="Avançando...">
                Pular obra
              </SaveButton>
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
                  <CardTitle className="flex items-center gap-2 text-base">
                    {STATUS_ICONS[auth.status] ?? null}
                    Documento de autorização
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Criado em {fmtDate(auth.created_at, "dd/MM/yyyy HH:mm")}
                    {auth.sent_at && ` · enviado em ${fmtDate(auth.sent_at, "dd/MM/yyyy HH:mm")}`}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    auth.status === "aprovado"
                      ? "success"
                      : auth.status === "recusado" || auth.status === "expirado"
                        ? "danger"
                        : "warning"
                  }
                >
                  {auth.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/releases/${id}/autorizacao/${auth.id}/documento`}>
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/releases/${id}/authorizations/${auth.id}/document`}>
                    <Download className="h-4 w-4" />
                    Baixar DOCX
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/releases/${id}/authorizations/${auth.id}/document?format=pdf`}>
                    <Download className="h-4 w-4" />
                    Baixar PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
