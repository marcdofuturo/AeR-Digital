import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
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

  return (
    <div className="space-y-6">
      {authorizations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 text-fg-muted mx-auto mb-3" />
            <p className="text-fg-muted mb-1">Nenhuma autorização gerada</p>
            <p className="text-sm text-fg-muted">
              Gere um documento de autorização para enviar aos participantes.
            </p>
          </CardContent>
        </Card>
      ) : (
        authorizations.map((auth: any) => (
          <Card key={auth.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {STATUS_ICONS[auth.status] ?? null}
                  Autorização — {auth.status}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Criada em {fmtDate(auth.created_at, "dd/MM/yyyy HH:mm")}
                  {auth.sent_at && ` · Enviada em ${fmtDate(auth.sent_at, "dd/MM/yyyy HH:mm")}`}
                </CardDescription>
              </div>
              <Badge variant={auth.status === "aprovado" ? "success" : auth.status === "recusado" || auth.status === "expirado" ? "danger" : "warning"}>
                {auth.status}
              </Badge>
            </CardHeader>

            {/* Recipients */}
            <CardContent>
              <div className="space-y-2">
                {auth.authorization_recipients?.map((recip: any) => (
                  <div key={recip.id} className="flex items-center justify-between p-2 rounded-md bg-bg border border-border/50">
                    <div>
                      <p className="text-sm text-fg">{recip.name}</p>
                      <p className="text-xs text-fg-muted">{recip.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {recip.attempts > 0 && (
                        <span className="text-xs text-fg-muted">{recip.attempts} tentativa(s)</span>
                      )}
                      <Badge variant={RECIPIENT_STATUS_VARIANT[recip.status] ?? "secondary"} className="text-xs">
                        {recip.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
