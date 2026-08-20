"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, X } from "lucide-react";
import { saveTrackParticipantCredits } from "@/app/releases/actions";
import { billingRoleClasses } from "@/lib/artists/billing-role";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/forms/save-button";
import { cn } from "@/lib/utils";
import type { BillingRole } from "@ar/shared";

type CreditRow = {
  artistId: string;
  stageName: string;
  position: number;
  billingRole: BillingRole;
};

export function ParticipantCreditsEditor({
  releaseId,
  trackId,
  participants,
}: {
  releaseId: string;
  trackId: string;
  participants: CreditRow[];
}) {
  const initial = useMemo(() => normalizeRows(participants), [participants]);
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setRows(normalizeRows(next.map((row, rowIndex) => ({ ...row, position: rowIndex + 1 }))));
  }

  return (
    <form
      action={async (formData) => {
        await saveTrackParticipantCredits(formData);
        setEditing(false);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="release_id" value={releaseId} />
      <input type="hidden" name="track_id" value={trackId} />
      <input type="hidden" name="participant_count" value={rows.length} />
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.artistId}
            className={cn(
              "grid gap-2 rounded-md border p-3 md:grid-cols-[64px_1fr_150px_auto] md:items-center",
              billingRoleClasses(row.billingRole),
            )}
          >
            <input type="hidden" name={`artist_id_${index}`} value={row.artistId} />
            <input type="hidden" name={`position_${index}`} value={index + 1} />
            <span className="font-mono text-sm font-semibold">#{index + 1}</span>
            <span className="text-sm font-semibold">{row.stageName}</span>
            {index === 0 ? (
              <>
                <input type="hidden" name={`billing_role_${index}`} value="principal" />
                <span className="text-sm font-medium">Principal</span>
              </>
            ) : (
              <select
                name={`billing_role_${index}`}
                value={row.billingRole}
                disabled={!editing}
                onChange={(event) => {
                  const role = event.target.value as Exclude<BillingRole, "principal">;
                  setRows((current) =>
                    current.map((item, rowIndex) =>
                      rowIndex === index ? { ...item, billingRole: role } : item,
                    ),
                  );
                }}
                aria-label={`Papel de ${row.stageName}`}
                className="rounded-md border border-current/30 bg-white/70 px-2 py-1.5 text-sm text-slate-900 disabled:opacity-80 dark:bg-slate-950/70 dark:text-slate-100"
              >
                <option value="primary">Primario</option>
                <option value="featuring">Featuring</option>
              </select>
            )}
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!editing || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Subir ${row.stageName}`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!editing || index === rows.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Descer ${row.stageName}`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
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
            <SaveButton size="sm" variant="success" savedLabel="Creditos salvos">
              Salvar ordem e papeis
            </SaveButton>
          </>
        ) : (
          <Button type="button" size="sm" variant="edit" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Editar ordem e papeis
          </Button>
        )}
      </div>
    </form>
  );
}

function normalizeRows(rows: CreditRow[]): CreditRow[] {
  return [...rows]
    .sort((left, right) => left.position - right.position)
    .map((row, index) => ({
      ...row,
      position: index + 1,
      billingRole:
        index === 0 ? "principal" : row.billingRole === "principal" ? "primary" : row.billingRole,
    }));
}
