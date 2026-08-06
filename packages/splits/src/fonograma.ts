import { Participant, SplitLine } from "./types";
import { distributeEvenly, reconcile } from "./math";

/**
 * Fonograma — padrão fixo (R5):
 * Produtor fonográfico (selo) .... 41,70%  → 4170 bps100
 * Intérpretes .................... 41,70%  → 4170, dividido igualmente
 * Músicos acompanhantes .......... 16,60%  → 1660, dividido igualmente
 *
 * Sem músicos → 830 vai para produtor e 830 para intérpretes.
 */
const FONO = {
  produtor: 4170,
  interpretes: 4170,
  musicos: 1660,
} as const;

export function computeFonograma(
  participants: Participant[],
  labelName: string,
): SplitLine[] {
  // Produtores aparecem como Músicos, não como Intérpretes
  const interpretes = participants.filter(p => p.is_performer && !p.is_producer);
  const musicos = participants.filter(p => p.is_producer);

  let poolProdutor = FONO.produtor;
  let poolInterpretes = FONO.interpretes;

  // Sem músicos: redistribui mantendo proporção 50/50
  if (musicos.length === 0) {
    poolProdutor += 830;
    poolInterpretes += 830;
  }

  const produtorLine: SplitLine = {
    holder_type: "label",
    role_label: "Produtor fonográfico",
    name: labelName,
    bps100: poolProdutor,
  };

  const interpreteLines = distributeEvenly(interpretes, poolInterpretes).map(d => ({
    holder_type: "artist" as const,
    artist_id: d.item.id,
    role_label: "Intérprete",
    name: d.item.stage_name,
    bps100: d.bps100,
  }));

  const musicoLines = musicos.length
    ? distributeEvenly(musicos, FONO.musicos).map(d => ({
        holder_type: "artist" as const,
        artist_id: d.item.id,
        role_label: "Músico",
        name: d.item.stage_name,
        bps100: d.bps100,
      }))
    : [];

  return reconcile([produtorLine, ...interpreteLines, ...musicoLines]);
}
