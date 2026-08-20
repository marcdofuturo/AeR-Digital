import { buildPresentationPrompt } from "@ar/ai";

export const AI_CREDIT_LIMIT = 100;
export const AI_CREDIT_COST = 2;

type PresentationTrack = {
  title: string;
  releaseDate: string;
  genres: string[];
  participants: string[];
  bpm?: number | null;
  key?: string | null;
  energy?: number | null;
  transcript?: string | null;
};

type ClaudeMessageContent = Array<{ type?: string; text?: string }>;

export function remainingAiCredits(usedCreditUnits: number) {
  return Math.max(0, AI_CREDIT_LIMIT - usedCreditUnits);
}

export function assertAiCredits(usedCreditUnits: number) {
  const remaining = remainingAiCredits(usedCreditUnits);
  if (remaining < AI_CREDIT_COST) {
    throw new Error("Créditos de IA insuficientes");
  }
  return remaining;
}

export async function generateClaudePresentation({
  track,
  userGuidance,
  apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
  model = process.env.CLAUDE_SONNET_MODEL ?? "claude-sonnet-4-6",
}: {
  track: PresentationTrack;
  userGuidance?: string | null;
  apiKey?: string;
  model?: string;
}) {
  if (!apiKey) {
    return buildLocalPresentation(
      track,
      userGuidance,
      "Claude não configurado no ambiente de produção.",
    );
  }

  const prompt = buildPresentationPrompt({
    titulo: track.title,
    creditos: track.participants.join(", ") || "Artistas não informados",
    generos: track.genres,
    data: track.releaseDate,
    bpm: track.bpm ?? null,
    key: track.key ?? null,
    energy: track.energy ?? null,
    transcript_sample: track.transcript ?? "",
    userGuidance,
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: Math.min(6, Math.max(2, track.participants.length + 1)),
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return buildLocalPresentation(
        track,
        userGuidance,
        `Claude indisponível (${response.status}). Verifique o segredo ANTHROPIC_API_KEY no Cloudflare Pages.`,
      );
    }

    const data = (await response.json()) as { content?: ClaudeMessageContent };
    const text = (data.content ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    if (!text) {
      return buildLocalPresentation(track, userGuidance, "Claude retornou resposta vazia.");
    }
    return parsePresentationResponse(text);
  } catch {
    return buildLocalPresentation(track, userGuidance, "Falha de conexão com Claude.");
  }
}

export function parsePresentationResponse(text: string) {
  const jsonText = extractJsonObject(text);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as { apresentacao?: unknown; avisos?: unknown };
      const apresentacao = String(parsed.apresentacao ?? "").trim();
      if (apresentacao) {
        return {
          apresentacao,
          avisos: Array.isArray(parsed.avisos) ? parsed.avisos.map(String) : [],
          raw: text,
        };
      }
    } catch {
      // Fall through to plain text response.
    }
  }

  return {
    apresentacao: text.trim(),
    avisos: ["Resposta da IA veio fora do JSON esperado."],
    raw: text,
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function buildLocalPresentation(
  track: PresentationTrack,
  userGuidance: string | null | undefined,
  reason: string,
) {
  const artists = track.participants.join(", ") || "artistas do projeto";
  const genres = track.genres.filter(Boolean).join(" / ") || "música brasileira";
  const releaseDate = track.releaseDate ? ` com lançamento previsto para ${track.releaseDate}` : "";
  const direction = userGuidance ? ` Direção solicitada: ${userGuidance.trim()}.` : "";

  return {
    apresentacao: `${track.title} é uma faixa de ${artists}, situada em ${genres}${releaseDate}. A apresentação destaca o potencial comercial da música, seus créditos principais e o contexto necessário para curadoria, parceiros e distribuição.${direction}`,
    avisos: [reason, "Apresentação base local gerada sem resposta válida do Claude."],
    raw: JSON.stringify({ fallback: true, reason }),
  };
}
