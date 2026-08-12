import { Participant, SplitLine } from "./types";
import { distributeEvenly, reconcile } from "./math";

const FONO = {
  produtor: 4170,
  interpretes: 4170,
  musicos: 1660,
} as const;

export function computeFonograma(
  participants: Participant[],
  labelName: string,
): SplitLine[] {
  const interpretes = participants.filter(p => p.is_performer && !p.is_producer);
  const musicos = participants.filter(p => p.is_producer);

  const poolProdutor = FONO.produtor;
  const poolInterpretes = musicos.length === 0
    ? FONO.interpretes + FONO.musicos
    : FONO.interpretes;

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
        role_label: "Músico acompanhante",
        name: d.item.stage_name,
        bps100: d.bps100,
      }))
    : [];

  return reconcile([produtorLine, ...interpreteLines, ...musicoLines]);
}
