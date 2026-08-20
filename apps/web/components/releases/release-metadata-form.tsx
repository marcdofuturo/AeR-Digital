"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { saveReleaseOverview } from "@/app/releases/actions";
import { ReplaceFileButton } from "@/components/forms/replace-file-button";
import { SaveButton } from "@/components/forms/save-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReleaseCoverViewer } from "./release-cover-viewer";

type ReleaseMetadata = {
  title: string;
  releaseDate: string;
  genrePrimary: string;
  genreSecondary: string;
  distributor: string;
  upc: string;
  albumIdExt: string;
};

export function ReleaseMetadataForm({
  releaseId,
  data,
  coverAvailable,
  coverVersion,
}: {
  releaseId: string;
  data: ReleaseMetadata;
  coverAvailable: boolean;
  coverVersion?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedDateRef = useRef(false);
  const [releaseDate, setReleaseDate] = useState(data.releaseDate);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const locked = !editing || saving || saved;
  const version = coverVersion ? `&v=${encodeURIComponent(coverVersion)}` : "";
  const previewUrl = `/api/releases/${encodeURIComponent(releaseId)}/media?kind=cover${version}`;
  const downloadUrl = `/api/releases/${encodeURIComponent(releaseId)}/media?kind=cover&download=1${version}`;

  return (
    <>
      <form
        ref={formRef}
        action={async (formData) => {
          setSaving(true);
          try {
            await saveReleaseOverview(formData);
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
        onSubmit={(event) => {
          if (releaseDate === data.releaseDate || confirmedDateRef.current) {
            confirmedDateRef.current = false;
            return;
          }
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
        <input type="hidden" name="release_id" value={releaseId} />
        <MetadataField
          name="title"
          label="Lançamento"
          defaultValue={data.title}
          disabled={locked}
        />
        <label className="text-fg-muted text-xs">
          Data
          <input
            name="release_date"
            type="date"
            value={releaseDate}
            disabled={locked}
            onChange={(event) => setReleaseDate(event.currentTarget.value)}
            onClick={(event) => {
              const picker = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
              try {
                picker.showPicker?.();
              } catch {
                /* Native click still opens the calendar. */
              }
            }}
            className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
          />
        </label>
        <MetadataField
          name="genre_primary"
          label="Gênero principal"
          defaultValue={data.genrePrimary}
          disabled={locked}
        />
        <MetadataField
          name="genre_secondary"
          label="Gênero secundário"
          defaultValue={data.genreSecondary}
          disabled={locked}
        />
        <MetadataField
          name="distributor"
          label="Agregadora"
          defaultValue={data.distributor}
          placeholder="Audiolink Brasil"
          disabled={locked}
        />
        <MetadataField name="upc" label="UPC" defaultValue={data.upc} disabled={locked} />
        <MetadataField
          name="album_id_ext"
          label="ID do álbum"
          defaultValue={data.albumIdExt}
          disabled={locked}
        />

        <div className="border-border/50 bg-bg flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 md:col-span-4">
          <div className="flex min-w-0 items-center gap-3">
            <ReleaseCoverViewer
              title={data.title}
              available={coverAvailable}
              previewUrl={previewUrl}
              downloadUrl={downloadUrl}
            />
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">Capa do lançamento</p>
              <p className="text-fg-muted text-xs">
                {coverAvailable ? "Clique na capa para visualizar" : "Nenhuma capa cadastrada"}
              </p>
            </div>
          </div>
          <ReplaceFileButton
            name="cover_file"
            accept="image/jpeg,image/png,image/webp"
            label="Substituir capa"
            disabled={locked}
          />
        </div>
        <div className="flex justify-end gap-2 md:col-span-4">
          <Button
            type="button"
            size="sm"
            variant={editing ? "cancel" : "edit"}
            disabled={saving || saved}
            onClick={() => {
              if (editing) {
                formRef.current?.reset();
                setReleaseDate(data.releaseDate);
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Cancelar edição" : "Editar visão geral"}
          </Button>
          {editing ? (
            <SaveButton
              size="sm"
              variant="success"
              disabled={locked}
              savedLabel="Visão geral salva"
            >
              Salvar visão geral
            </SaveButton>
          ) : null}
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar nova data</DialogTitle>
            <DialogDescription>
              A data mudará de {formatDate(data.releaseDate)} para {formatDate(releaseDate)}.
              Confirme para salvar a nova seleção.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => {
                setReleaseDate(data.releaseDate);
                setConfirmOpen(false);
              }}
            >
              Manter data anterior
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => {
                confirmedDateRef.current = true;
                setConfirmOpen(false);
                window.setTimeout(() => formRef.current?.requestSubmit(), 0);
              }}
            >
              Salvar nova data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetadataField({
  name,
  label,
  defaultValue,
  placeholder,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  disabled: boolean;
}) {
  return (
    <label className="text-fg-muted text-xs">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
      />
    </label>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
