import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTenant } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { Building2, Hash, Link2, Calendar } from "lucide-react";

export default async function SeloConfigPage() {
  const tenant = await getTenant();
  if (!tenant) return null;

  const t = tenant as any;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Dados do Selo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-fg-muted">Nome</span>
              <p className="text-sm text-fg font-medium">{t.name}</p>
            </div>
            <div>
              <span className="text-xs text-fg-muted">Slug</span>
              <p className="text-sm text-fg font-mono">{t.slug}</p>
            </div>
          </div>
          {t.legal_name && (
            <div>
              <span className="text-xs text-fg-muted">Razão Social</span>
              <p className="text-sm text-fg">{t.legal_name}</p>
            </div>
          )}
          {t.cnpj && (
            <div>
              <span className="text-xs text-fg-muted">CNPJ</span>
              <p className="text-sm text-fg font-mono">{t.cnpj}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Código de Intake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg-muted mb-3">
            Artistas usam este código no WhatsApp para enviar lançamentos ao seu selo:
          </p>
          <code className="block bg-bg border border-border rounded-lg px-4 py-3 text-base text-brand font-mono text-center">
            {t.intake_code}
          </code>
          <p className="text-xs text-fg-muted mt-2">
            Compartilhe: <span className="font-mono">https://wa.me/5511948059297?text={t.intake_code}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-muted">Plano atual</span>
            <Badge variant={t.plan === "trial" ? "warning" : "success"} className="text-xs">
              {t.plan}
            </Badge>
          </div>
          <p className="text-xs text-fg-muted mt-2">
            Selo ativo desde {fmtDate(t.created_at, "dd/MM/yyyy")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
