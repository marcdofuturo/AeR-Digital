import { z } from "zod";

const optionalText = z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().max(200).optional(),
);

const optionalUrl = z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().url("URL invalida").max(500).optional(),
);

const optionalEmail = z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().email("Email invalido").max(200).optional(),
);

export const teamInvitationSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("Email invalido").max(200),
  role: z.enum(["ar", "financeiro", "viewer"]),
});

export const labelSettingsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do selo").max(120),
  legal_name: optionalText,
  cnpj: optionalText.refine(
    (value) => !value || value.replace(/\D/g, "").length === 14,
    "CNPJ deve ter 14 digitos",
  ),
  logo_url: optionalUrl,
  responsible_name: optionalText,
  contact_email: optionalEmail,
  contact_phone: optionalText.refine(
    (value) => !value || /^\+?[0-9 ()-]{8,20}$/.test(value),
    "Telefone invalido",
  ),
});

export type TeamInvitationInput = z.infer<typeof teamInvitationSchema>;
export type LabelSettingsInput = z.infer<typeof labelSettingsSchema>;
