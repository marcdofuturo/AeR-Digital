import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { validateSplitTotal } from "@ar/ai/crm";

const SCOPE_LABELS: Record<string, string> = {
  obra: "Obra (Composição)",
  fonograma: "Fonograma (Gravação)",
  digital: "Digital (Streaming)",
};

export default async function SplitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];

  // Group splits by scope, using latest version
  function latestSplits(splits: any[], scope: string) {
    const filtered = splits.filter((s: any) => s.scope === scope);
    if (!filtered.length) return [];
    const maxVer = Math.max(...filtered.map((s: any) => s.version));
    return filtered.filter((s: any) => s.version === maxVer);
  }

  return (
    <div className="space-y-6">
      {tracks.map((track: any) => {
        const splits = track.splits ?? [];

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="obra">
                <TabsList>
                  <TabsTrigger value="obra">Obra</TabsTrigger>
                  <TabsTrigger value="fonograma">Fonograma</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
                </TabsList>

                {["obra", "fonograma", "digital"].map((scope) => {
                  const scopeSplits = latestSplits(splits, scope);
                  const total = scopeSplits.reduce((s: number, l: any) => s + l.bps100, 0);
                  const isValid = total === 10_000;

                  return (
                    <TabsContent key={scope} value={scope}>
                      {!scopeSplits.length ? (
                        <p className="text-sm text-fg-muted py-4">Nenhum split definido para {SCOPE_LABELS[scope]}</p>
                      ) : (
                        <div className="space-y-2">
                          {scopeSplits.map((line: any) => (
                            <div key={line.id} className="flex items-center justify-between p-2 rounded-md bg-bg border border-border/50">
                              <div className="flex items-center gap-2">
                                <Badge variant={line.holder_type === "label" ? "default" : "secondary"} className="text-[10px]">
                                  {line.holder_type === "label" ? "Selo" : "Artista"}
                                </Badge>
                                <span className="text-sm text-fg">{line.role_label}</span>
                              </div>
                              <span className="text-sm text-fg font-mono tabular-nums">
                                {(line.bps100 / 100).toFixed(2)}%
                              </span>
                            </div>
                          ))}

                          {/* Total bar */}
                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-sm font-medium text-fg">Total</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-mono font-medium tabular-nums ${isValid ? "text-success" : "text-danger"}`}>
                                {(total / 100).toFixed(2)}%
                              </span>
                              {isValid ? (
                                <Badge variant="success" className="text-[10px]">Válido</Badge>
                              ) : (
                                <Badge variant="danger" className="text-[10px]">
                                  {total > 10_000 ? "+" : ""}{((total - 10_000) / 100).toFixed(2)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
