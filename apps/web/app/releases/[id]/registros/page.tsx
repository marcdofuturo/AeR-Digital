import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { CheckCheck, Clock, AlertTriangle, XCircle } from "lucide-react";

const REG_LABELS: Record<string, string> = {
  obra_ecad: "Obra ECAD",
  fonograma_ecad: "Fonograma ECAD",
  isrc: "ISRC",
  distribuicao: "Distribuição",
  youtube_cid: "YouTube CID",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "danger"> = {
  pendente: "secondary",
  em_andamento: "warning",
  concluido: "success",
  rejeitado: "danger",
  na: "secondary",
};

export default async function RegistrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];

  return (
    <div className="space-y-6">
      {tracks.map((track: any) => {
        const regs = track.registrations ?? [];
        const byKind: Record<string, any> = {};
        for (const reg of regs) byKind[reg.kind] = reg;

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["obra_ecad", "fonograma_ecad", "isrc", "distribuicao", "youtube_cid"].map((kind) => {
                  const reg = byKind[kind];
                  const status = reg?.status ?? "pendente";
                  return (
                    <div key={kind} className="flex items-center justify-between p-3 rounded-md bg-bg border border-border/50">
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
                          <p className="text-sm text-fg font-medium">{REG_LABELS[kind]}</p>
                          {reg?.external_id && (
                            <p className="text-xs text-fg-muted font-mono mt-0.5">{reg.external_id}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {reg?.due_at && (
                          <span className="text-xs text-fg-muted">Venc: {fmtDate(reg.due_at, "dd/MM")}</span>
                        )}
                        {reg?.entity && (
                          <span className="text-xs text-fg-muted">{reg.entity}</span>
                        )}
                        <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className="text-xs">
                          {status === "em_andamento" ? "em andamento" : status}
                        </Badge>
                      </div>
                    </div>
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
