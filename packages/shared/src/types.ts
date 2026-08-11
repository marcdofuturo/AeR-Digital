// ============================================================
// A&R Digital — Tipos compartilhados
// ============================================================

/** Percentual em basis points 100 (10000 = 100,00%). Nunca float. */
export type Bps100 = number & { readonly __brand: "Bps100" };

/** Papel no billing */
export type BillingRole = "primary" | "featuring";

/** Escopo de split */
export type SplitScope = "obra" | "fonograma" | "digital";

/** Status de lançamento */
export type ReleaseStage =
  | "em_analise"
  | "autorizacao_pendente"
  | "registrar_obra"
  | "registrar_fonograma"
  | "pronto_p_distribuir"
  | "distribuido"
  | "situacao_ecad"
  | "concluido"
  | "arquivado";

/** Modo de rateio digital */
export type DigitalMode = "pro_rata" | "fixo";

/** Status de autorização */
export type AuthorizationStatus =
  | "rascunho"
  | "enviado"
  | "parcial"
  | "aprovado"
  | "recusado"
  | "expirado";

/** Status de destinatário de autorização */
export type RecipientStatus =
  | "pendente"
  | "enviado"
  | "entregue"
  | "aberto"
  | "aprovado"
  | "recusado"
  | "bounce";

/** Status de registro */
export type RegistrationStatus = "pendente" | "em_andamento" | "concluido" | "rejeitado" | "na";
