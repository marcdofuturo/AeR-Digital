"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { saveTrackOverview } from "@/app/releases/actions";
import { SaveButton } from "@/components/forms/save-button";
import { Button } from "@/components/ui/button";
import { formatTrackDuration } from "@/lib/tracks/duration";
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const locked = !editing || saving || saved;

  return (
    <section className="border-border/50 bg-bg space-y-3 rounded-md border p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          setSaving(true);
          try {
            await saveTrackOverview(formData);
            setSaved(true);
            window.setTimeout(() => {
              setSaved(false);
              setEditing(false);
            }, 700);
          } finally {
            setSaving(false);
          }
        }}
        className="grid gap-3 md:grid-cols-4"
      >
        <input type="hidden" name="release_id" value={releaseId} />
        <input type="hidden" name="track_id" value={track.id} />
        <TrackField name="title" label="Faixa" defaultValue={track.title} disabled={locked} />
        <TrackField name="isrc" label="ISRC" defaultValue={track.isrc} disabled={locked} />
        <TrackField
          name="audio_duration"
          label="Duração (MM:SS)"
          pattern="[0-9]+:[0-5][0-9]"
          placeholder="02:05"
          defaultValue={formatTrackDuration(track.audioDurationSec)}
          disabled={locked}
        />
        <TrackField
          name="audio_bpm"
          label="BPM"
          type="number"
          min="0"
          step="0.01"
          defaultValue={track.audioBpm}
          disabled={locked}
        />
        <TrackField name="audio_key" label="Tom" defaultValue={track.audioKey} disabled={locked} />
        <TrackField
          name="audio_energy"
          label="Energia (0 a 1)"
          type="number"
          min="0"
          max="1"
          step="0.01"
          defaultValue={track.audioEnergy}
          disabled={locked}
        />
        <label className="text-fg-muted flex items-center gap-2 self-end pb-2 text-xs">
          <input
            type="checkbox"
            name="explicit"
            defaultChecked={track.explicit}
            disabled={locked}
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
            disabled={locked}
            className="border-border bg-surface text-fg mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 md:col-span-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving || saved}
            onClick={() => {
              if (editing) {
                formRef.current?.reset();
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Cancelar edição" : "Editar dados da faixa"}
          </Button>
          <SaveButton size="sm" variant="outline" disabled={locked} savedLabel="Dados salvos">
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
  pattern,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string | number | null;
  disabled: boolean;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
  pattern?: string;
  placeholder?: string;
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
        pattern={pattern}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
      />
    </label>
  );
}
