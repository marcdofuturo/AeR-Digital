"use client";

import Link from "next/link";
import {
  AudioLines,
  Calendar,
  Disc3,
  ExternalLink,
  FileCheck2,
  ImageIcon,
  Music2,
  Percent,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KANBAN_STAGES, formatDaysInStage } from "@ar/ai/crm";
import type { KanbanCardData, ReleaseProgressSummary } from "./kanban-card";
import { formatTrackDuration } from "@/lib/tracks/duration";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

interface Props {
  release: KanbanCardData | null;
  onOpenChange: (open: boolean) => void;
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("T")[0]?.split("-") ?? [];
  if (year && month && day) return `${day}/${month}/${year}`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  return formatTrackDuration(seconds);
}

function isRenderableImageUrl(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|\/|data:image\/|blob:)/i.test(value);
}

function summaryPendingText(summary?: ReleaseProgressSummary) {
  if (!summary || summary.total === 0) return "sem checklist";
  if (summary.pending === 0 && summary.rejected === 0) return "tudo OK";
  if (summary.pending === 1) return "1 pendente";
  return `${summary.pending} pendentes`;
}

function SummaryTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border-border/70 bg-bg rounded-md border px-3 py-2.5">
      <div className="text-fg-muted mb-1 flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-fg min-w-0 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function ProgressRow({
  label,
  summary,
  doneLabel,
}: {
  label: string;
  summary?: ReleaseProgressSummary;
  doneLabel: string;
}) {
  const completed = summary?.completed ?? summary?.approved ?? 0;
  const rejected = summary?.rejected ?? 0;

  return (
    <div className="border-border/60 bg-bg flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <div>
        <p className="text-fg font-medium">{label}</p>
        <p className="text-fg-muted text-xs">
          {completed} {doneLabel}
          {rejected > 0 ? `, ${rejected} reprovado${rejected > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <Badge
        variant={
          !summary || summary.total === 0
            ? "secondary"
            : summary.pending === 0 && rejected === 0
              ? "success"
              : "warning"
        }
        className="shrink-0 text-[11px]"
      >
        {summaryPendingText(summary)}
      </Badge>
    </div>
  );
}

export function ReleaseDetailsDialog({ release, onOpenChange }: Props) {
  const tracks = release?.tracks ?? [];
  const artists = release?.artists?.join(", ") || "Artistas não informados";
  const genre =
    [release?.genrePrimary, release?.genreSecondary].filter(Boolean).join(" / ") || "não informado";
  const coverUrl = isRenderableImageUrl(release?.coverUrl) ? release?.coverUrl : null;
  const coverReceived = Boolean(release?.coverReceived || release?.coverUrl);
  const audioReceived = tracks.some((track) => track.audioReceived);
  const filesText =
    coverReceived || audioReceived
      ? `${coverReceived ? "capa" : "sem capa"} / ${audioReceived ? "áudio" : "sem áudio"}`
      : "sem arquivos";

  return (
    <Dialog open={Boolean(release)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        {release && (
          <div>
            <div className="border-border bg-surface border-b px-5 py-5">
              <DialogHeader className="pr-8">
                <div className="flex items-start gap-4">
                  <div className="border-border bg-bg grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : coverReceived ? (
                      <span className="text-fg-muted px-2 text-center text-[10px] font-medium tracking-wide uppercase">
                        capa recebida
                      </span>
                    ) : (
                      <ImageIcon className="text-fg-muted h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-fg truncate text-xl">{release.title}</DialogTitle>
                    <DialogDescription className="mt-1 line-clamp-2">{artists}</DialogDescription>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{STAGE_LABEL[release.stage] ?? release.stage}</Badge>
                      <Badge variant="secondary">
                        {tracks.length || 1} faixa{(tracks.length || 1) > 1 ? "s" : ""}
                      </Badge>
                      {release.upc && <Badge variant="info">UPC {release.upc}</Badge>}
                    </div>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile
                  icon={Calendar}
                  label="Lançamento"
                  value={formatDateOnly(release.releaseDate)}
                />
                <SummaryTile
                  icon={Wrench}
                  label="Iniciou em:"
                  value={
                    release.stageSince
                      ? formatDateOnly(release.stageSince)
                      : formatDaysInStage(release.daysInStage)
                  }
                />
                <SummaryTile icon={Music2} label="Gênero" value={genre} />
                <SummaryTile icon={AudioLines} label="Arquivos" value={filesText} />
              </div>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Disc3 className="text-brand h-4 w-4" />
                  <h3 className="text-fg text-sm font-semibold">Músicas</h3>
                </div>
                <div className="space-y-2">
                  {tracks.length === 0 ? (
                    <div className="border-border/60 bg-bg text-fg-muted rounded-md border px-3 py-3 text-sm">
                      Nenhuma faixa cadastrada para este lançamento.
                    </div>
                  ) : (
                    tracks.map((track, index) => {
                      const duration = formatDuration(track.durationSec);

                      return (
                        <div
                          key={track.id}
                          className="border-border/60 bg-bg rounded-md border p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-fg truncate text-sm font-medium">
                                {index + 1}. {track.title}
                              </p>
                              <p className="text-fg-muted mt-1 flex items-center gap-1 text-xs">
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                  {track.participants.join(", ") || artists}
                                </span>
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Badge
                                variant={track.audioReceived ? "success" : "secondary"}
                                className="text-[10px]"
                              >
                                {track.audioReceived ? "áudio OK" : "sem áudio"}
                              </Badge>
                              {track.explicit && (
                                <Badge variant="warning" className="text-[10px]">
                                  explicit
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-fg-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span className="truncate font-mono">
                              {track.isrc ?? "ISRC a gerar"}
                            </span>
                            {duration && <span>{duration}</span>}
                            {track.bpm ? <span>{track.bpm} BPM</span> : null}
                            {track.key ? <span>{track.key}</span> : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <ProgressRow label="Autorizações" summary={release.authorizations} doneLabel="OK" />
                <ProgressRow
                  label="Registros"
                  summary={release.registrations}
                  doneLabel="concluído(s)"
                />
              </section>
            </div>

            <DialogFooter className="border-border bg-bg border-t px-5 py-4 sm:justify-between sm:space-x-0">
              <Button asChild variant="outline" size="sm">
                <Link href={`/releases/${release.id}`} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-4 w-4" />
                  Abrir ficha completa
                </Link>
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`/releases/${release.id}/autorizacao`}
                    onClick={() => onOpenChange(false)}
                  >
                    <FileCheck2 className="h-4 w-4" />
                    Autorizações
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`/releases/${release.id}/registros`}
                    onClick={() => onOpenChange(false)}
                  >
                    <Wrench className="h-4 w-4" />
                    Registros
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/releases/${release.id}/splits`} onClick={() => onOpenChange(false)}>
                    <Percent className="h-4 w-4" />
                    Splits
                  </Link>
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
