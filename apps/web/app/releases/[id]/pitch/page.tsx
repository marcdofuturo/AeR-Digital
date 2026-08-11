import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { Sparkles, FileText } from "lucide-react";

export default async function PitchPage({ params }: { params: Promise<{ id: string }> }) {
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
        const pitches = track.pitches ?? [];

        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {pitches.length === 0 ? "Nenhum pitch gerado" : `${pitches.length} pitch(es) gerado(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pitches.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-fg-muted mx-auto mb-2" />
                  <p className="text-sm text-fg-muted">
                    Gere um pitch A/B para enviar para playlists e parceiros.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pitches.map((pitch: any, idx: number) => (
                    <div key={pitch.id ?? idx} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fg-muted">
                          Gerado em {fmtDate(pitch.generated_at, "dd/MM/yyyy HH:mm")}
                        </span>
                        {pitch.used_option && (
                          <Badge variant="success" className="text-xs">
                            Usado: Opção {pitch.used_option.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Option A */}
                        <Card className="border-2 border-border">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Opção A
                              </CardTitle>
                              {pitch.used_option === "a" && (
                                <Badge variant="success" className="text-[10px]">Usado</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                              {pitch.option_a}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Option B */}
                        <Card className="border-2 border-border">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Opção B
                              </CardTitle>
                              {pitch.used_option === "b" && (
                                <Badge variant="success" className="text-[10px]">Usado</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                              {pitch.option_b}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Analysis */}
                      {pitch.analysis && (
                        <Card className="bg-surface-2/50">
                          <CardHeader>
                            <CardTitle className="text-sm">Análise</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-xs text-fg-muted whitespace-pre-wrap font-sans">
                              {JSON.stringify(pitch.analysis, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
