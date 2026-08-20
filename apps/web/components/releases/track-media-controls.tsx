"use client";

import { Download, Headphones } from "lucide-react";
import { TrackAudioUploadButton } from "@/components/forms/track-audio-upload-button";
import { Button } from "@/components/ui/button";

type TrackMediaControlsProps = {
  releaseId: string;
  trackId: string;
  title: string;
  available: boolean;
  version?: string | null;
};

export function TrackMediaControls({
  releaseId,
  trackId,
  title,
  available,
  version,
}: TrackMediaControlsProps) {
  const baseUrl = `/api/releases/${encodeURIComponent(releaseId)}/media?kind=audio&track_id=${encodeURIComponent(trackId)}`;
  const playbackUrl = `${baseUrl}${version ? `&v=${encodeURIComponent(version)}` : ""}`;
  const downloadUrl = `${baseUrl}&download=1${version ? `&v=${encodeURIComponent(version)}` : ""}`;

  return (
    <div className="border-border/40 bg-surface/60 flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="border-border bg-bg text-fg-muted grid h-10 w-10 place-items-center rounded-md border">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-fg truncate text-sm font-medium">{title}</p>
            <p className="text-fg-muted text-xs">
              {available ? "Áudio disponível no player" : "Nenhum áudio cadastrado"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" disabled={!available}>
            <a href={available ? downloadUrl : undefined} download>
              <Download className="h-4 w-4" />
              Baixar áudio
            </a>
          </Button>
          <TrackAudioUploadButton releaseId={releaseId} trackId={trackId} />
        </div>
      </div>
      {available ? (
        <audio
          key={version ?? "audio"}
          aria-label={`Reproduzir ${title}`}
          controls
          preload="metadata"
          src={playbackUrl}
          className="w-full"
        />
      ) : null}
    </div>
  );
}
