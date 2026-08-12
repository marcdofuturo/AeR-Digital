import { SplitError } from "./types";
import { Participant, SplitLine } from "./types";
import { distributeEvenly, reconcile } from "./math";

/**
 * Obra: pro-rata igualitario entre todos os participantes da faixa.
 * Todos entram operacionalmente como Autor/compositor.
 */
export function computeObra(participants: Participant[]): SplitLine[] {
  if (participants.length === 0) throw new SplitError("Faixa sem autores");

  const distributed = distributeEvenly(participants, 10_000);

  return reconcile(
    distributed.map(d => ({
      holder_type: "artist" as const,
      artist_id: d.item.id,
      role_label: "Autor/compositor",
      name: d.item.stage_name,
      bps100: d.bps100,
    })),
  );
}

