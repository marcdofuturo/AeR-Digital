/** Linha de split (resultado do motor) */
export interface SplitLine {
  holder_type: "artist" | "label";
  artist_id?: string;
  role_label: string;
  name: string;
  bps100: number;
}

/** Participante que entra no rateio */
export interface Participant {
  id: string;
  stage_name: string;
  billing_role: "principal" | "primary" | "featuring";
  position: number;
  is_composer: boolean;
  is_producer: boolean;
  is_performer: boolean;
  hidden_from_billing: boolean;
}

/** Configuração de rateio digital */
export interface DigitalConfig {
  mode: "pro_rata" | "fixo";
  label_bps100: number; // usado só em 'fixo'
  weight_primary: number;
  weight_featuring: number;
}

/** Erro de domínio do motor de splits */
export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitError";
  }
}

export const TOTAL_BPS = 10_000;
