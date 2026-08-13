export function normalizeWhatsappPhone(input: string): string {
  const withoutJid = input.split("@")[0] ?? input;
  const digits = withoutJid.replace(/\D+/g, "");
  if (!digits) return withoutJid.trim();
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function whatsappPhoneVariants(input: string): string[] {
  const normalized = normalizeWhatsappPhone(input);
  const digits = input.split("@")[0]?.replace(/\D+/g, "") ?? "";
  const variants = new Set<string>();

  if (normalized) {
    variants.add(normalized);
    variants.add(`+${normalized}`);
  }

  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  if (normalized.startsWith("55") && (normalized.length === 12 || normalized.length === 13)) {
    variants.add(normalized.slice(2));
  }

  return Array.from(variants).filter(Boolean);
}
