import { z } from "zod";

/** E.164 phone number */
export const phoneE164 = z.string().regex(/^\+[1-9]\d{1,14}$/, "Telefone em formato E.164 obrigatório");

/** Brazil CPF/CNPJ (sem máscara) */
export const cpfCnpj = z.string().regex(/^\d{11}$|^\d{14}$/, "CPF (11 dígitos) ou CNPJ (14 dígitos) sem máscara");

/** Email válido */
export const email = z.string().email("Email inválido");

/** UUID v4 */
export const uuid = z.string().uuid("UUID inválido");
