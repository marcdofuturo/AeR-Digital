import { z } from "zod";

const nullableText = z.preprocess(
  (value) => String(value ?? "").trim() || null,
  z.string().max(200).nullable(),
);

const nullableUrl = z.preprocess(
  (value) => String(value ?? "").trim() || null,
  z.string().url("URL invalida").max(500).nullable(),
);

const nullableEmail = z.preprocess(
  (value) => String(value ?? "").trim() || null,
  z.string().email("Email invalido").max(200).nullable(),
);

function isValidCnpj(value: string | null): boolean {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index]!, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(`${digits.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}

export const teamInvitationSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("Email invalido").max(200),
  role: z.enum(["ar", "financeiro", "viewer"]),
});

export const labelSettingsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do selo").max(120),
  legal_name: nullableText,
  cnpj: nullableText.refine(isValidCnpj, "CNPJ invalido"),
  logo_url: nullableUrl,
  responsible_name: nullableText,
  contact_email: nullableEmail,
  contact_phone: nullableText.refine(
    (value) => !value || /^\+?[0-9 ()-]{8,20}$/.test(value),
    "Telefone invalido",
  ),
});

export type TeamInvitationInput = z.infer<typeof teamInvitationSchema>;
export type LabelSettingsInput = z.infer<typeof labelSettingsSchema>;
