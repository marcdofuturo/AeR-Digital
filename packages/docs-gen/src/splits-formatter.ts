// ─── Format splits for the authorization template ────────────
import type { SplitRow } from "./render";

/** Local type matching SplitLine from @ar/splits (avoid cross-package rootDir issues) */
interface SplitLine {
  holder_type: "artist" | "label";
  artist_id?: string;
  role_label: string;
  name: string;
  bps100: number;
}

/**
 * Map splits lines to template rows.
 *
 * Role mapping per scope:
 * - Obra: Autor/compositor
 * - Fonograma: Intérprete | Músico | Produtor fonográfico
 * - Digital: Main Artist (pos 1) | Primary Artist (pos 2-4) | Featured Artist (pos 5+) | Selo
 */
export function formatSplits(
  splits: { obra: SplitLine[]; fonograma: SplitLine[]; digital: SplitLine[] },
): { obra: SplitRow[]; fonograma: SplitRow[]; digital: SplitRow[] } {
  function bpsToPct(bps: number): string {
    return (bps / 100).toFixed(2).replace(".", ",") + "%";
  }

  function fmtObra(lines: SplitLine[]): SplitRow[] {
    return lines.map((l, i) => ({
      id: i + 1,
      artista: l.name,
      classe: "Autor/compositor",
      pct: bpsToPct(l.bps100),
    }));
  }

  function fmtFonograma(lines: SplitLine[]): SplitRow[] {
    return lines.map((l, i) => ({
      id: i + 1,
      artista: l.holder_type === "label" ? l.name : l.name,
      classe: l.role_label,
      pct: bpsToPct(l.bps100),
    }));
  }

  function fmtDigital(lines: SplitLine[], total: number): SplitRow[] {
    const artists = lines.filter(l => l.holder_type === "artist");
    const label = lines.find(l => l.holder_type === "label");

    const rows: SplitRow[] = [];
    let idx = 1;

    for (const a of artists) {
      const classe =
        a.role_label === "Featured Artist" ? "Featured Artist"
        : idx === 1 ? "Main Artist"
        : "Primary Artist";
      rows.push({ id: idx++, artista: a.name, classe, pct: bpsToPct(a.bps100) });
    }

    if (label) {
      rows.push({ id: idx++, artista: label.name, classe: "Selo", pct: bpsToPct(label.bps100) });
    }

    return rows;
  }

  return {
    obra: fmtObra(splits.obra),
    fonograma: fmtFonograma(splits.fonograma),
    digital: fmtDigital(splits.digital, 10_000),
  };
}

/** Build creditos string: "MC GH, MC Jacaré & Mucilon" */
export function formatCreditos(artistNames: string[]): string {
  if (artistNames.length === 0) return "";
  if (artistNames.length === 1) return artistNames[0]!;
  if (artistNames.length === 2) return `${artistNames[0]} & ${artistNames[1]}`;
  return artistNames.slice(0, -1).join(", ") + " & " + artistNames[artistNames.length - 1];
}
