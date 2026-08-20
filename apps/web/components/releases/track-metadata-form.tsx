"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { saveTrackOverview } from "@/app/releases/actions";
import { SaveButton } from "@/components/forms/save-button";
import { Button } from "@/components/ui/button";
import { TrackMediaControls } from "./track-media-controls";

type TrackMetadata = {
  id: string;
  title: string;
  isrc: string;
  explicit: boolean;
  audioDurationSec: number | null;
  audioBpm: number | null;
  audioKey: string;
  audioEnergy: number | null;
  lyricsTranscript: string;
  audioAvailable: boolean;
  audioVersion?: string | null;
};

export function TrackMetadataForm({
  releaseId,
  track,
}: {
  releaseId: string;
  track: TrackMetadata;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="border-border/50 bg-bg space-y-3 rounded-md border p-3">
      <form action={saveTrackOverview} className="grid gap-3 md:grid-cols-4">
        <input type="hidden" name="release_id" value={releaseId} />
        <input type="hidden" name="track_id" value={track.id} />
        <TrackField name="title" label="Faixa" defaultValue={track.title} disabled={!editing} />
        <TrackField name="isrc" label="ISRC" defaultValue={track.isrc} disabled={!editing} />
        <TrackField
          name="audio_duration_sec"
          label="Duração (segundos)"
          type="number"
          min="0"
          defaultValue={track.audioDurationSec}
          disabled={!editing}
        />
        <TrackField
          name="audio_bpm"
          label="BPM"
          type="number"
          min="0"
          step="0.01"
          defaultValue={track.audioBpm}
          disabled={!editing}
        />
        <TrackField
          name="audio_key"
          label="Tom"
          defaultValue={track.audioKey}
          disabled={!editing}
        />
        <TrackField
          name="audio_energy"
          label="Energia (0 a 1)"
          type="number"
          min="0"
          max="1"
          step="0.01"
          defaultValue={track.audioEnergy}
          disabled={!editing}
        />
        <label className="text-fg-muted flex items-center gap-2 self-end pb-2 text-xs">
          <input
            type="checkbox"
            name="explicit"
            defaultChecked={track.explicit}
            disabled={!editing}
            className="accent-brand"
          />
          Explícita
        </label>
        <label className="text-fg-muted text-xs md:col-span-4">
          Transcrição da letra
          <textarea
            name="lyrics_transcript"
            rows={5}
            defaultValue={track.lyricsTranscript}
            disabled={!editing}
            className="border-border bg-surface text-fg mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 md:col-span-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Cancelar edição" : "Editar dados da faixa"}
          </Button>
          <SaveButton size="sm" variant="outline" disabled={!editing} savedLabel="Dados salvos">
            Salvar dados da faixa
          </SaveButton>
        </div>
      </form>
      <TrackMediaControls
        releaseId={releaseId}
        trackId={track.id}
        title={track.title}
        available={track.audioAvailable}
        version={track.audioVersion}
      />
    </section>
  );
}

function TrackField({
  name,
  label,
  defaultValue,
  disabled,
  type = "text",
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  defaultValue: string | number | null;
  disabled: boolean;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="text-fg-muted text-xs">
      {label}
      <input
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
      />
    </label>
  );
}
