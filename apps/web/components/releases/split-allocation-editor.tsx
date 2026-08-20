"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { saveSplitAllocations } from "@/app/releases/actions";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/forms/save-button";
import { allocateParentShare } from "@ar/splits";

type ArtistOption = { id: string; stageName: string };
type AllocationRow = { beneficiaryId: string; bps100: number };

export function SplitAllocationEditor({
  releaseId,
  trackId,
  scope,
  parentArtistId,
  parentArtistName,
  parentBps100,
  artists,
  allocations,
}: {
  releaseId: string;
  trackId: string;
  scope: "obra" | "fonograma" | "digital";
  parentArtistId: string;
  parentArtistName: string;
  parentBps100: number;
  artists: ArtistOption[];
  allocations: AllocationRow[];
}) {
  const initial = useMemo(() => allocations.map((row) => ({ ...row })), [allocations]);
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState(false);
  const total = rows.reduce((sum, row) => sum + row.bps100, 0);
  const valid = rows.length === 0 || total === 10_000;
  const effective = valid && rows.length ? allocateParentShare(parentBps100, rows) : [];
  const artistName = new Map(artists.map((artist) => [artist.id, artist.stageName]));

  function beginEditing() {
    setRows(initial.length ? initial : [{ beneficiaryId: parentArtistId, bps100: 10_000 }]);
    setEditing(true);
  }

  function addRow() {
    const used = new Set(rows.map((row) => row.beneficiaryId));
    const candidate = artists.find((artist) => !used.has(artist.id));
    if (!candidate) return;
    setRows((current) => [...current, { beneficiaryId: candidate.id, bps100: 0 }]);
  }

  return (
    <form
      action={async (formData) => {
        await saveSplitAllocations(formData);
        setEditing(false);
      }}
      className="border-border/60 bg-surface/40 rounded-md border border-dashed p-3"
    >
      <input type="hidden" name="release_id" value={releaseId} />
      <input type="hidden" name="track_id" value={trackId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="parent_artist_id" value={parentArtistId} />
      <input type="hidden" name="allocation_count" value={rows.length} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-fg text-xs font-semibold">Rateio interno de {parentArtistName}</p>
          <p className="text-fg-muted text-xs">
            A parcela de {(parentBps100 / 100).toFixed(2)}% vira 100% dentro deste artista.
          </p>
        </div>
        {!editing ? (
          <Button type="button" size="sm" variant="edit" onClick={beginEditing}>
            <Pencil className="h-4 w-4" />
            {initial.length ? "Editar integrantes" : "Adicionar integrantes"}
          </Button>
        ) : null}
      </div>

      {!editing ? (
        initial.length ? (
          <div className="space-y-1">
            {initial.map((row) => {
              const share = allocateParentShare(parentBps100, initial).find(
                (item) => item.beneficiaryId === row.beneficiaryId,
              );
              return (
                <p key={row.beneficiaryId} className="text-fg-muted text-xs">
                  {artistName.get(row.beneficiaryId) ?? "Artista"}: {(row.bps100 / 100).toFixed(2)}%
                  da parcela, equivalente a {((share?.bps100 ?? 0) / 100).toFixed(2)}% do total.
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-fg-muted text-xs">Sem rateio interno: 100% permanece com o artista.</p>
        )
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={`${row.beneficiaryId}-${index}`}
              className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end"
            >
              <label className="text-fg-muted text-xs">
                Integrante
                <select
                  name={`beneficiary_artist_id_${index}`}
                  value={row.beneficiaryId}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, beneficiaryId: event.target.value } : item,
                      ),
                    )
                  }
                  className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm"
                >
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.stageName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-fg-muted text-xs">
                % dentro da parcela
                <input
                  name={`allocation_percent_${index}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={(row.bps100 / 100).toFixed(2)}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index
                          ? { ...item, bps100: Math.round(Number(event.target.value) * 100) }
                          : item,
                      ),
                    )
                  }
                  className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-right font-mono text-sm"
                />
              </label>
              <Button
                type="button"
                variant="cancel"
                size="icon"
                aria-label={`Remover ${artistName.get(row.beneficiaryId) ?? "integrante"}`}
                onClick={() =>
                  setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {valid && effective[index] ? (
                <p className="text-fg-muted text-xs sm:col-span-3">
                  Equivale a {(effective[index]!.bps100 / 100).toFixed(2)}% do total da faixa.
                </p>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Adicionar porcentagem
            </Button>
            <span className={valid ? "text-success text-xs" : "text-danger text-xs"}>
              Total interno: {(total / 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="cancel"
              onClick={() => {
                setRows(initial);
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <SaveButton size="sm" variant="success" disabled={!valid} savedLabel="Rateio salvo">
              Salvar rateio interno
            </SaveButton>
          </div>
        </div>
      )}
    </form>
  );
}
