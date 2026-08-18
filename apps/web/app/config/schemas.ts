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

export const teamInvitationSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("Email invalido").max(200),
  role: z.enum(["ar", "financeiro", "viewer"]),
});

export const labelSettingsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do selo").max(120),
  legal_name: nullableText,
  cnpj: nullableText.refine(
    (value) => !value || value.replace(/\D/g, "").length === 14,
    "CNPJ deve ter 14 digitos",
  ),
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
