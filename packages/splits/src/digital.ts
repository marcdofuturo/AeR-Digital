import { Participant, DigitalConfig, SplitLine } from "./types";
import { distributeByWeight, reconcile, digitalWeight } from "./math";

/**
 * Digital — dois modos configuráveis (R6):
 * - 'pro_rata': selo entra como mais um participante
 * - 'fixo': selo pega X%, restante pro-rata entre artistas
 */
export function computeDigital(
  participants: Participant[],
  cfg: DigitalConfig,
  labelName: string,
): SplitLine[] {
  const visible = participants.filter(p => !p.hidden_from_billing);

  const weighted = visible.map(p => ({
    item: p,
    w: digitalWeight(p, cfg),
    bps100: 0,
  }));

  if (cfg.mode === "pro_rata") {
    // Selo entra no pro-rata como mais um participante
    const withLabel = [
      ...weighted,
      { item: null, w: cfg.weight_primary, bps100: 0 },
    ];

    const dist = distributeByWeight(
      withLabel.map(e => ({ item: e, w: e.w })),
      10_000,
    );

    const lines: SplitLine[] = dist.map(d => {
      if (d.item.item === null) {
        return {
          holder_type: "label" as const,
          role_label: "Selo",
          name: labelName,
          bps100: d.bps100,
        };
      }
      const p = d.item.item as Participant;
      return {
        holder_type: "artist" as const,
        artist_id: p.id,
        role_label: p.billing_role === "featuring" ? "Featured Artist" : "Primary Artist",
        name: p.stage_name,
        bps100: d.bps100,
      };
    });

    return reconcile(lines);
  }

  // Modo 'fixo': selo pega X%, restante pro-rata
  const fixo = cfg.label_bps100;
  const resto = 10_000 - fixo;

  const dist = distributeByWeight(
    weighted.map(e => ({ item: e.item as Participant, w: e.w })),
    resto,
  );

  const lines: SplitLine[] = [
    {
      holder_type: "label",
      role_label: "Selo",
      name: labelName,
      bps100: fixo,
    },
    ...dist.map(d => ({
      holder_type: "artist" as const,
      artist_id: d.item.id,
      role_label: d.item.billing_role === "featuring" ? "Featured Artist" : "Primary Artist",
      name: d.item.stage_name,
      bps100: d.bps100,
    })),
  ];

  return reconcile(lines);
}
