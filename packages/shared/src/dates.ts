import { fromZonedTime, toZonedTime, format as formatTZ } from "date-fns-tz";
import { parse as parseDate } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Timezone oficial do sistema */
export const TZ = "America/Sao_Paulo";

/** Formata data ISO → dd/MM/yyyy em São Paulo */
export function fmtDate(date: Date | string, fmt = "dd/MM/yyyy"): string {
  const dateOnly = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const d = dateOnly
    ? fromZonedTime(`${date}T00:00:00`, TZ)
    : typeof date === "string"
      ? new Date(date)
      : date;
  return formatTZ(toZonedTime(d, TZ), fmt, { timeZone: TZ });
}

/** Agora em São Paulo */
export function now(): Date {
  return toZonedTime(new Date(), TZ);
}

/** Parser de data pt-BR com fallback */
export function parseBR(input: string): Date | null {
  const cleaned = input.trim();
  // dd/MM/yyyy, dd/MM/yy, dd-MM-yyyy
  const patterns = ["dd/MM/yy", "dd/MM/yyyy", "dd-MM-yyyy"];
  for (const p of patterns) {
    const d = parseDate(cleaned, p, new Date(), { locale: ptBR });
    if (!isNaN(d.getTime())) {
      if (p === "dd/MM/yy" && d.getFullYear() < 100) {
        d.setFullYear(2000 + d.getFullYear());
      }
      return fromZonedTime(d, TZ);
    }
  }
  return null;
}
