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

export function remainingAiCredits(generatedCount: number) {
  return Math.max(0, AI_CREDIT_LIMIT - generatedCount * AI_CREDIT_COST);
}

export function assertAiCredits(generatedCount: number) {
  const remaining = remainingAiCredits(generatedCount);
  if (remaining < AI_CREDIT_COST) {
    throw new Error("Créditos de IA insuficientes");
  }
  return remaining;
}

export async function generateClaudePresentation({
  track,
  userGuidance,
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.CLAUDE_SONNET_MODEL ?? "claude-sonnet-5",
}: {
  track: PresentationTrack;
  userGuidance?: string | null;
  apiKey?: string;
  model?: string;
}) {
  if (!apiKey) throw new Error("Token Claude não configurado");

  const prompt = buildPresentationPrompt({
    titulo: track.title,
    creditos: track.participants.join(", ") || "Artistas não informados",
    generos: track.genres,
    data: track.releaseDate,
    bpm: track.bpm ?? null,
    key: track.key ?? null,
    energy: track.energy ?? null,
    transcript_sample: (track.transcript ?? "").slice(0, 500),
    userGuidance,
  });

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha Claude (${response.status})`);
  }

  const data = await response.json() as { content?: ClaudeMessageContent };
  const text = (data.content ?? []).map((part) => part.text ?? "").join("\n").trim();
  return parsePresentationResponse(text);
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
