// ─── Response Classifier — Claude Haiku analyzes email replies ─

export type ClassificationDecision =
  | "aprovado"
  | "recusado"
  | "condicional"
  | "duvida"
  | "indefinido";

export interface ClassificationResult {
  decisao: ClassificationDecision;
  nome_declarado: string | null;
  artista_declarado: string | null;
  condicoes: string[];
  resumo: string;
  confianca: number; // 0–1
}

const CLASSIFIER_PROMPT = `Classifique a resposta a um pedido de autorização de lançamento musical.
JSON apenas:
{"decisao":"aprovado"|"recusado"|"condicional"|"duvida"|"indefinido",
 "nome_declarado":str|null,"artista_declarado":str|null,
 "condicoes":[str],"resumo":str,"confianca":number}

- "aprovado" só com consentimento inequívoco ao lançamento.
- Pedido de mudança de %, data ou crédito = "condicional".
- Nunca infira aprovação de agradecimento, emoji ou silêncio.
- confianca < 0.8 → "indefinido".`;

/**
 * Classify an email reply using Claude Haiku.
 * Returns the classification — or defaults to "indefinido" on error.
 */
export async function classifyResponse(
  body: string,
  callLLM?: (prompt: string) => Promise<string>,
): Promise<ClassificationResult> {
  if (!callLLM) {
    // Without LLM, do basic heuristic
    return heuristicClassify(body);
  }

  try {
    const raw = await callLLM(CLASSIFIER_PROMPT + "\n\nRESPOSTA:\n" + body);
    const parsed = JSON.parse(raw);
    return {
      decisao: parsed.decisao ?? "indefinido",
      nome_declarado: parsed.nome_declarado ?? null,
      artista_declarado: parsed.artista_declarado ?? null,
      condicoes: parsed.condicoes ?? [],
      resumo: parsed.resumo ?? "",
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0,
    };
  } catch {
    return { decisao: "indefinido", nome_declarado: null, artista_declarado: null, condicoes: [], resumo: "", confianca: 0 };
  }
}

/** Heuristic classification (no LLM) */
function heuristicClassify(body: string): ClassificationResult {
  const t = body.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  if (/\bautorizo\b/.test(t) && !/\b(?:porem|mas|entretanto|se|desde que|com a condicao)\b/.test(t)) {
    const nameMatch = body.match(/\bEu,\s*(.+?)\s+sou\s+respons[áa]vel\b/i);
    return { decisao: "aprovado", nome_declarado: nameMatch?.[1] ?? null, artista_declarado: null, condicoes: [], resumo: "Autorização detectada heuristicamente", confianca: 0.85 };
  }

  if (/\b(?:mudar|alterar|trocar|ajustar|corrigir)\b.*\b(?:data|nome|porcentagem|percentual|%|split)\b/.test(t)) {
    return { decisao: "condicional", nome_declarado: null, artista_declarado: null, condicoes: ["Mudança detectada"], resumo: body.substring(0, 100), confianca: 0.75 };
  }

  if (/\b(?:obrigado|valeu|vlw|tmj|👍)\b/.test(t)) {
    return { decisao: "indefinido", nome_declarado: null, artista_declarado: null, condicoes: [], resumo: "Agradecimento/emoji — não é autorização", confianca: 0.3 };
  }

  return { decisao: "indefinido", nome_declarado: null, artista_declarado: null, condicoes: [], resumo: "", confianca: 0.2 };
}
