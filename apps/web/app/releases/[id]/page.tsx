import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import { KANBAN_STAGES, formatDaysInStage } from "@ar/ai/crm";
import { fmtDate } from "@ar/shared";
import { saveArtistMetadata } from "@/app/releases/actions";
import { Calendar, Clock, Disc3, FileText, Users, Wrench } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

const REG_KINDS = ["obra_ecad", "fonograma_ecad", "isrc", "distribuicao"];
const REG_LABELS: Record<string, string> = {
  obra_ecad: "Obra ECAD",
  fonograma_ecad: "Fonograma ECAD",
  isrc: "ISRC",
  distribuicao: "Distribuição",
};

export default async function ReleaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const [release, tenant] = await Promise.all([getRelease(tenantId, id), getTenant()]);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];
  const daysInStage = r.stage_since
    ? Math.floor((Date.now() - new Date(r.stage_since).getTime()) / 86400000)
    : 0;
  const currentYear = new Date().getFullYear();
  const labelName = tenant?.name ?? "Audiolink Brasil";
  const copyright = `© ${currentYear} ${labelName}`;

  const participants = collectParticipants(tracks);
  const distributionRows = tracks.map((track: any) => ({
    title: track.title,
    isrc: track.isrc ?? "a gerar",
    audio: track.audio_url ? "áudio recebido" : "sem áudio",
    participants: track.track_participants?.length ?? 0,
  }));

  const regs = tracks.flatMap((t: any) => t.registrations ?? []);
  const regByKind: Record<string, any> = {};
  for (const reg of regs) {
    if (REG_KINDS.includes(reg.kind)) regByKind[reg.kind] = reg;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Disc3 className="h-4 w-4" />
            Faixas ({tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhuma faixa cadastrada</p>
          ) : (
            <div className="space-y-3">
              {tracks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-bg p-3">
                  <div>
                    <p className="text-sm font-medium text-fg">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {t.audio_duration_sec && (
                        <span className="text-xs text-fg-muted">
                          {Math.floor(t.audio_duration_sec / 60)}:{String(t.audio_duration_sec % 60).padStart(2, "0")}
                        </span>
                      )}
                      {t.isrc && <span className="font-mono text-xs text-fg-muted">ISRC: {t.isrc}</span>}
                      {t.audio_bpm && <span className="text-xs text-fg-muted">{t.audio_bpm} BPM</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {t.track_participants?.length ?? 0} participantes
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Pronto p/ distribuir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 text-sm md:grid-cols-4">
            <InfoTile label="Agregadora" value={r.distributor ?? "Audiolink Brasil"} />
            <InfoTile label="UPC" value={r.upc ?? "a gerar"} mono />
            <InfoTile label="Álbum externo" value={r.album_id_ext ?? "a gerar"} mono />
            <InfoTile label="Copyright" value={copyright} />
          </div>

          <div className="space-y-2">
            {distributionRows.map((row: any, index: number) => (
              <div key={`${row.title}-${index}`} className="grid gap-2 rounded-md border border-border/50 bg-bg p-3 text-sm md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                <span className="font-medium text-fg">{row.title}</span>
                <span className="font-mono text-xs text-fg-muted">ISRC: {row.isrc}</span>
                <span className="text-xs text-fg-muted">{row.audio}</span>
                <Badge variant="outline" className="w-fit text-[10px]">
                  {row.participants} participantes
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Créditos e dados ECAD
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {tracks.map((track: any) => (
            <div key={track.id} className="rounded-md border border-border/50 bg-bg p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg">{track.title}</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {track.track_participants?.length ?? 0} crédito(s)
                </Badge>
              </div>
              {!track.track_participants?.length ? (
                <p className="text-sm text-fg-muted">Nenhum participante cadastrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome artístico</TableHead>
                      <TableHead>Nome físico</TableHead>
                      <TableHead>Código ECAD</TableHead>
                      <TableHead>Associação</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-right">Salvar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...(track.track_participants ?? [])]
                      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                      .map((tp: any) => {
                        const artist = tp.artists ?? {};
                        const needsData = !artist.legal_name || !artist.ecad_code;
                        const formId = `artist-meta-${track.id}-${artist.id}`;

                        return (
                          <TableRow key={tp.id}>
                            <TableCell className="tabular-nums text-fg-muted">{tp.position}</TableCell>
                            <TableCell className="font-medium text-fg">{artist.stage_name ?? "Artista"}</TableCell>
                            <TableCell>
                              <input
                                form={formId}
                                name="legal_name"
                                defaultValue={artist.legal_name ?? ""}
                                placeholder="Nome físico"
                                className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                form={formId}
                                name="ecad_code"
                                defaultValue={artist.ecad_code ?? ""}
                                placeholder="ECAD"
                                className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                form={formId}
                                name="pro_affiliation"
                                defaultValue={artist.pro_affiliation ?? ""}
                                placeholder="UBC, Abramus..."
                                className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={tp.billing_role === "primary" ? "default" : "secondary"} className="text-[10px]">
                                  {tp.billing_role === "primary" ? "Principal" : "Feat."}
                                </Badge>
                                {tp.is_composer && <Badge variant="outline" className="text-[10px]">Compositor</Badge>}
                                {tp.is_performer && <Badge variant="outline" className="text-[10px]">Intérprete</Badge>}
                                {tp.is_producer && <Badge variant="outline" className="text-[10px]">Produtor</Badge>}
                                {needsData && <Badge variant="warning" className="text-[10px]">Completar</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <form id={formId} action={saveArtistMetadata}>
                                <input type="hidden" name="release_id" value={id} />
                                <input type="hidden" name="artist_id" value={artist.id} />
                                <Button type="submit" size="sm" variant="outline">OK</Button>
                              </form>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-fg-muted">
                <Clock className="h-3.5 w-3.5" />
                No estágio
              </span>
              <span className="text-sm tabular-nums text-fg">{formatDaysInStage(daysInStage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-fg-muted">
                <Calendar className="h-3.5 w-3.5" />
                Lançamento
              </span>
              <span className="text-sm text-fg">{fmtDate(r.release_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Etapa atual</span>
              <Badge variant="outline" className="text-[10px]">
                {STAGE_LABEL[r.stage] ?? r.stage}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Participantes ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="rounded-md border border-border/50 bg-bg p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-fg">{p.stage_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.billing_role === "primary" ? "Principal" : "Feat."}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-fg-muted">{p.tracks.join(", ")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {REG_KINDS.map((kind) => {
                const reg = regByKind[kind];
                const status = reg?.status ?? "pendente";
                const variant =
                  status === "concluido" ? "success" :
                  status === "em_andamento" ? "warning" :
                  status === "rejeitado" ? "danger" : "secondary";
                return (
                  <div key={kind} className="flex items-center justify-between text-sm">
                    <span className="text-fg-muted">{REG_LABELS[kind]}</span>
                    <Badge variant={variant} className="text-[10px]">
                      {status === "em_andamento" ? "em andamento" : status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Copyright
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg">{copyright}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 bg-bg p-3">
      <span className="text-xs text-fg-muted">{label}</span>
      <p className={`${mono ? "font-mono" : ""} text-fg`}>{value}</p>
    </div>
  );
}

function collectParticipants(tracks: any[]) {
  const participantMap = new Map<string, {
    id: string;
    stage_name: string;
    billing_role: string;
    position: number;
    tracks: string[];
  }>();

  for (const track of tracks) {
    for (const tp of track.track_participants ?? []) {
      const artist = tp.artists;
      if (!artist?.id) continue;
      const existing = participantMap.get(artist.id);
      if (existing) {
        existing.tracks.push(track.title);
      } else {
        participantMap.set(artist.id, {
          id: artist.id,
          stage_name: artist.stage_name ?? "Artista",
          billing_role: tp.billing_role,
          position: tp.position ?? 0,
          tracks: [track.title],
        });
      }
    }
  }

  return Array.from(participantMap.values()).sort((a, b) => a.position - b.position);
}
