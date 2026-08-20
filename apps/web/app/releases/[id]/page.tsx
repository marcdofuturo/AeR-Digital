import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditMetadataButton } from "@/components/forms/edit-metadata-button";
import { ReleaseMetadataForm } from "@/components/releases/release-metadata-form";
import { TrackMetadataForm } from "@/components/releases/track-metadata-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import { KANBAN_STAGES, formatDaysInStage } from "@ar/ai/crm";
import { fmtDate } from "@ar/shared";
import { saveArtistMetadata } from "@/app/releases/actions";
import { formatTrackDuration } from "@/lib/tracks/duration";
import { Calendar, Clock, Disc3, FileText, Users, Wrench } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

const REG_KINDS = ["obra_ecad", "fonograma_ecad", "distribuicao"];
const REG_LABELS: Record<string, string> = {
  obra_ecad: "Obra ECAD",
  fonograma_ecad: "Fonograma ECAD",
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
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Editar visão geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ReleaseMetadataForm
            releaseId={id}
            data={{
              title: r.title ?? "",
              releaseDate: String(r.release_date ?? "").slice(0, 10),
              genrePrimary: r.genre_primary ?? "",
              genreSecondary: r.genre_secondary ?? "",
              distributor: r.distributor ?? "Audiolink Brasil",
              upc: r.upc ?? "",
              albumIdExt: r.album_id_ext ?? "",
            }}
            coverAvailable={isUsableUrl(r.cover_url)}
            coverVersion={r.cover_updated_at}
          />

          {tracks.map((track: any) => (
            <TrackMetadataForm
              key={track.id}
              releaseId={id}
              track={{
                id: track.id,
                title: track.title ?? "",
                isrc: track.isrc ?? "",
                explicit: Boolean(track.explicit),
                audioDurationSec: track.audio_duration_sec ?? null,
                audioBpm: track.audio_bpm == null ? null : Number(track.audio_bpm),
                audioKey: track.audio_key ?? "",
                audioEnergy: track.audio_energy == null ? null : Number(track.audio_energy),
                lyricsTranscript: track.lyrics_transcript ?? "",
                audioAvailable: isUsableUrl(track.audio_url),
                audioVersion: track.audio_updated_at ?? null,
              }}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Disc3 className="h-4 w-4" />
            Faixas ({tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="text-fg-muted text-sm">Nenhuma faixa cadastrada</p>
          ) : (
            <div className="space-y-3">
              {tracks.map((t: any) => (
                <div
                  key={t.id}
                  className="border-border/50 bg-bg flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-fg text-sm font-medium">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {t.audio_duration_sec && (
                        <span className="text-fg-muted text-xs">
                          {formatTrackDuration(t.audio_duration_sec)}
                        </span>
                      )}
                      {t.isrc && (
                        <span className="text-fg-muted font-mono text-xs">ISRC: {t.isrc}</span>
                      )}
                      {t.audio_bpm && (
                        <span className="text-fg-muted text-xs">{t.audio_bpm} BPM</span>
                      )}
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
              <div
                key={`${row.title}-${index}`}
                className="border-border/50 bg-bg grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center"
              >
                <span className="text-fg font-medium">{row.title}</span>
                <span className="text-fg-muted font-mono text-xs">ISRC: {row.isrc}</span>
                <span className="text-fg-muted text-xs">{row.audio}</span>
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
            <div key={track.id} className="border-border/50 bg-bg rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-fg text-sm font-medium">{track.title}</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {track.track_participants?.length ?? 0} crédito(s)
                </Badge>
              </div>
              {!track.track_participants?.length ? (
                <p className="text-fg-muted text-sm">Nenhum participante cadastrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome artístico</TableHead>
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>Código ECAD</TableHead>
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
                            <TableCell className="text-fg-muted tabular-nums">
                              {tp.position}
                            </TableCell>
                            <TableCell className="text-fg font-medium">
                              {artist.stage_name ?? "Artista"}
                            </TableCell>
                            <TableCell>
                              <input
                                form={formId}
                                name="legal_name"
                                data-editable
                                disabled
                                defaultValue={artist.legal_name ?? ""}
                                placeholder="Nome completo"
                                className="border-border bg-surface text-fg w-40 rounded-md border px-2 py-1.5 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                form={formId}
                                name="ecad_code"
                                data-editable
                                disabled
                                defaultValue={artist.ecad_code ?? ""}
                                placeholder="ECAD"
                                className="border-border bg-surface text-fg w-28 rounded-md border px-2 py-1.5 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge
                                  variant={tp.billing_role === "primary" ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {tp.billing_role === "primary" ? "Principal" : "Feat."}
                                </Badge>
                                {tp.is_composer && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Compositor
                                  </Badge>
                                )}
                                {tp.is_performer && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Intérprete
                                  </Badge>
                                )}
                                {tp.is_producer && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Produtor
                                  </Badge>
                                )}
                                {needsData && (
                                  <Badge variant="warning" className="text-[10px]">
                                    Completar
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <form id={formId} action={saveArtistMetadata}>
                                <input type="hidden" name="release_id" value={id} />
                                <input type="hidden" name="artist_id" value={artist.id} />
                                <div className="flex justify-end gap-2">
                                  <EditMetadataButton formId={formId} />
                                </div>
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
              <span className="text-fg-muted flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5" />
                No estágio
              </span>
              <span className="text-fg text-sm tabular-nums">{formatDaysInStage(daysInStage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted flex items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                Lançamento
              </span>
              <span className="text-fg text-sm">{fmtDate(r.release_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted text-sm">Etapa atual</span>
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
                <div key={p.id} className="border-border/50 bg-bg rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-fg font-medium">{p.stage_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.billing_role === "primary" ? "Principal" : "Feat."}
                    </Badge>
                  </div>
                  <p className="text-fg-muted mt-1 truncate text-xs">{p.tracks.join(", ")}</p>
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
                  status === "concluido"
                    ? "success"
                    : status === "em_andamento"
                      ? "warning"
                      : status === "rejeitado"
                        ? "danger"
                        : "secondary";
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
            <p className="text-fg text-sm">{copyright}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-border/50 bg-bg rounded-md border p-3">
      <span className="text-fg-muted text-xs">{label}</span>
      <p className={`${mono ? "font-mono" : ""} text-fg`}>{value}</p>
    </div>
  );
}

function isUsableUrl(value?: string | null) {
  if (!value) return false;
  if (value === "received") return false;
  return /^(https?:\/\/|\/)/i.test(value);
}

function collectParticipants(tracks: any[]) {
  const participantMap = new Map<
    string,
    {
      id: string;
      stage_name: string;
      billing_role: string;
      position: number;
      tracks: string[];
    }
  >();

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
