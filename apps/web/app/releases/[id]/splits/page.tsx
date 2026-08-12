import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { regenerateAutomaticSplits, saveManualSplits } from "@/app/releases/actions";
import { RefreshCcw, Save } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {tracks.map((track: any) => {
        const splits = track.splits ?? [];
        const artistById = new Map<string, string>(
          (track.track_participants ?? []).map((tp: any) => [String(tp.artist_id), String(tp.artists?.stage_name ?? "Artista")]),
        );

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                Splits automáticos podem ser confirmados manualmente por nova versão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="obra">
                <TabsList>
                  <TabsTrigger value="obra">Obra</TabsTrigger>
                  <TabsTrigger value="fonograma">Fonograma</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
                </TabsList>

                {(["obra", "fonograma", "digital"] as const).map((scope) => {
                  const scopeSplits = latestSplits(splits, scope);
                  const total = scopeSplits.reduce((sum: number, line: any) => sum + line.bps100, 0);
                  const isValid = total === 10_000;

                  return (
                    <TabsContent key={scope} value={scope}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-fg">{SCOPE_LABELS[scope]}</p>
                          <p className="text-xs text-fg-muted">
                            Total atual: {(total / 100).toFixed(2)}%
                          </p>
                        </div>
                        <form action={regenerateAutomaticSplits}>
                          <input type="hidden" name="release_id" value={id} />
                          <input type="hidden" name="track_id" value={track.id} />
                          <Button type="submit" size="sm" variant="outline">
                            <RefreshCcw className="h-4 w-4" />
                            Regenerar automático
                          </Button>
                        </form>
                      </div>

                      {!scopeSplits.length ? (
                        <div className="rounded-md border border-dashed border-border p-6 text-center">
                          <p className="text-sm text-fg-muted">
                            Nenhum split definido para {SCOPE_LABELS[scope]}.
                          </p>
                        </div>
                      ) : (
                        <form action={saveManualSplits} className="space-y-2">
                          <input type="hidden" name="release_id" value={id} />
                          <input type="hidden" name="track_id" value={track.id} />
                          <input type="hidden" name="scope" value={scope} />
                          <input type="hidden" name="line_count" value={scopeSplits.length} />

                          {scopeSplits.map((line: any, index: number) => (
                            <div key={line.id} className="grid gap-3 rounded-md border border-border/50 bg-bg p-3 md:grid-cols-[auto_1fr_1fr_140px] md:items-center">
                              <Badge variant={line.holder_type === "label" ? "default" : "secondary"} className="w-fit text-[10px]">
                                {line.holder_type === "label" ? "Selo" : "Artista"}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium text-fg">
                                  {line.holder_type === "label" ? "Selo" : artistById.get(String(line.artist_id)) ?? "Artista"}
                                </p>
                                <p className="text-xs text-fg-muted">{line.role_label}</p>
                              </div>
                              <div className="text-xs text-fg-muted">
                                Versão {line.version}{line.is_manual_override ? " · manual" : " · automático"}
                              </div>
                              <label className="text-xs text-fg-muted">
                                Percentual
                                <input
                                  name={`percent_${index}`}
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  defaultValue={(line.bps100 / 100).toFixed(2)}
                                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-right font-mono text-sm text-fg"
                                />
                              </label>
                              <input type="hidden" name={`holder_type_${index}`} value={line.holder_type} />
                              <input type="hidden" name={`artist_id_${index}`} value={line.artist_id ?? ""} />
                              <input type="hidden" name={`role_label_${index}`} value={line.role_label} />
                            </div>
                          ))}

                          <div className="flex items-center justify-between border-t border-border pt-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-sm font-medium tabular-nums ${isValid ? "text-success" : "text-danger"}`}>
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
                            <Button type="submit" size="sm" variant="outline">
                              <Save className="h-4 w-4" />
                              Confirmar split
                            </Button>
                          </div>
                        </form>
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

function latestSplits(splits: any[], scope: string) {
  const filtered = splits.filter((s: any) => s.scope === scope);
  if (!filtered.length) return [];
  const maxVer = Math.max(...filtered.map((s: any) => s.version));
  return filtered
    .filter((s: any) => s.version === maxVer)
    .sort((a: any, b: any) => {
      if (a.holder_type !== b.holder_type) return a.holder_type === "label" ? -1 : 1;
      return String(a.role_label).localeCompare(String(b.role_label), "pt-BR");
    });
}
