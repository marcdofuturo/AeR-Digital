import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTenant } from "@/lib/tenant";
import { requireMembership } from "@/lib/auth/require-membership";
import { fmtDate } from "@ar/shared";
import { Building2, Link2, Calendar } from "lucide-react";
import { LabelSettingsForm } from "./label-settings-form";

export default async function SeloConfigPage() {
  const [tenant, membership] = await Promise.all([getTenant(), requireMembership()]);
  if (!tenant) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 aria-hidden />
            Dados do Selo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membership.role === "owner" ? (
            <LabelSettingsForm tenant={tenant} />
          ) : (
            <p className="text-sm text-fg-muted">Somente o owner pode editar os dados do selo.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 aria-hidden />
            Codigo de Intake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-fg-muted">Este codigo identifica o selo e nao pode ser alterado.</p>
          <code className="block rounded-lg border border-border bg-bg px-4 py-3 text-center font-mono text-base text-brand">
            {tenant.intake_code}
          </code>
          <p className="mt-2 text-xs text-fg-muted">Slug: <span className="font-mono">{tenant.slug}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar aria-hidden />
            Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-muted">Plano atual</span>
            <Badge variant={tenant.plan === "trial" ? "warning" : "success"}>{tenant.plan}</Badge>
          </div>
          {tenant.created_at ? (
            <p className="mt-2 text-xs text-fg-muted">Selo ativo desde {fmtDate(tenant.created_at, "dd/MM/yyyy")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
