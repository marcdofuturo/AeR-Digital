import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantSplitSettings } from "@/lib/tenant";
import { getTenant } from "@/lib/tenant";

export default async function SplitsConfigPage() {
  const [tenant, splitSettings] = await Promise.all([
    getTenant(),
    getTenantSplitSettings(),
  ]);

  const digitalMode = splitSettings?.digital_mode ?? "fixo";
  const labelBps100 = splitSettings?.digital_label_bps100 ?? 2500;
  const weightPrimary = splitSettings?.digital_weight_primary ?? 100;
  const weightFeaturing = splitSettings?.digital_weight_featuring ?? 100;

  return (
    <div className="space-y-6">
      {/* Fixed rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras Fixas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-surface-2/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-fg mb-2">Obra (composição)</h3>
            <p className="text-sm text-fg-muted">
              Pro-rata igualitário entre todos os compositores. Cada autor recebe o mesmo percentual.
            </p>
            <p className="text-xs text-fg-muted mt-1">Ex: 4 compositores → 25,00% cada</p>
          </div>

          <div className="bg-surface-2/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-fg mb-2">Fonograma (gravação)</h3>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-xl font-bold text-brand font-mono tabular-nums">41,70%</div>
                <div className="text-xs text-fg-muted mt-1">Produtor Fonográfico</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-success font-mono tabular-nums">41,70%</div>
                <div className="text-xs text-fg-muted mt-1">Intérpretes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-warning font-mono tabular-nums">16,60%</div>
                <div className="text-xs text-fg-muted mt-1">Músicos</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digital — configurable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Digital (streaming)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">Modo atual</span>
            <span className="text-fg font-medium font-mono">
              {digitalMode === "fixo" ? "Percentual Fixo" : "Pro-Rata"}
            </span>
          </div>

          {digitalMode === "fixo" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">Percentual do selo</span>
              <span className="text-fg font-mono tabular-nums">{(labelBps100 / 100).toFixed(2)}%</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">Peso — Artista Principal</span>
            <span className="text-fg font-mono">{weightPrimary}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">Peso — Featuring</span>
            <span className="text-fg font-mono">{weightFeaturing}</span>
          </div>

          <p className="text-xs text-fg-muted pt-2 border-t border-border">
            Editável via Supabase Dashboard ou API — interface de edição em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
