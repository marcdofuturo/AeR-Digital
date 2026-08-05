import { Participant, DigitalConfig, SplitLine, SplitError, TOTAL_BPS } from "./types";

/**
 * Distribui `pool` (bps100) entre items com pesos. Método do maior resto.
 * Desempate determinístico: maior fração, depois menor índice.
 */
export function distributeByWeight<T>(
  items: { item: T; w: number }[],
  pool: number,
): { item: T; bps100: number }[] {
  if (items.length === 0 || pool === 0) {
    return items.map(i => ({ item: i.item, bps100: 0 }));
  }

  const totalW = items.reduce((s, i) => s + i.w, 0);
  if (totalW === 0) return items.map(i => ({ item: i.item, bps100: 0 }));

  const raw = items.map(i => (pool * i.w) / totalW);
  const base = raw.map(Math.floor);
  const rest = pool - base.reduce((s, v) => s + v, 0);

  const order = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);

  for (let k = 0; k < rest; k++) {
    const idx = order[k]!.idx;
    base[idx] = (base[idx] ?? 0) + 1;
  }

  return items.map((i, idx) => ({ item: i.item, bps100: base[idx]! }));
}

/** Divisão igualitária entre items */
export function distributeEvenly<T>(
  items: T[],
  pool: number,
): { item: T; bps100: number }[] {
  return distributeByWeight(
    items.map(item => ({ item, w: 1 })),
    pool,
  );
}

/** Garante que o total fecha exatamente TOTAL_BPS */
export function reconcile(lines: SplitLine[]): SplitLine[] {
  const sum = lines.reduce((s, l) => s + l.bps100, 0);
  if (sum === TOTAL_BPS) return lines;

  const maxIdx = lines.reduce((m, l, i) => (l.bps100 > lines[m]!.bps100 ? i : m), 0);
  lines[maxIdx]!.bps100 += TOTAL_BPS - sum;

  if (lines.some(l => l.bps100 < 0)) {
    throw new SplitError("Linha negativa detectada na reconciliação");
  }
  return lines;
}

/** Formata bps100 → "XX,XX%" */
export function fmt(bps: number): string {
  return (bps / 100).toFixed(2).replace(".", ",") + "%";
}

/** Peso de um participante para o rateio digital */
export function digitalWeight(p: Participant, cfg: DigitalConfig): number {
  return p.billing_role === "featuring" ? cfg.weight_featuring : cfg.weight_primary;
}
