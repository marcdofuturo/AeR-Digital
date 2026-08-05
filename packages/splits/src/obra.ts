import { SplitError } from "./types";
import { Participant, SplitLine } from "./types";
import { distributeEvenly, reconcile } from "./math";

/**
 * Obra: pro-rata igualitário entre todos os autores (compositores).
 * R4: Sem selo, sem editora, sem peso. Divisão igual.
 */
export function computeObra(participants: Participant[]): SplitLine[] {
  const autores = participants.filter(p => p.is_composer);
  if (autores.length === 0) throw new SplitError("Faixa sem autores");

  const distributed = distributeEvenly(autores, 10_000);

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
