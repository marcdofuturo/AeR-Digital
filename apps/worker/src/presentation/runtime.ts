import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildPresentationPrompt } from "@ar/ai";
import type {
  AudioAnalysis,
  PresentationInput,
  PresentationJob,
  PresentationProcessorDependencies,
  PresentationResult,
} from "./processor";

type RuntimeEnvironment = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  AUDIO_SERVICE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  CLAUDE_SONNET_MODEL?: string;
};

export function createPresentationDependencies(
  environment: RuntimeEnvironment = process.env,
): PresentationProcessorDependencies {
  const url = environment.SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase do worker nao configurado");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const audioServiceUrl = (environment.AUDIO_SERVICE_URL ?? "http://audio-svc:8000").replace(/\/$/, "");

  return {
    claim: () => claimJob(supabase),
    analyze: (job) => analyzeAudio(audioServiceUrl, job),
    saveAnalysis: (job, analysis) => saveAnalysis(supabase, job, analysis),
    generate: (input) => generatePresentation(environment, input),
    complete: (job, result) => completeJob(supabase, job, result),
    fail: (job, message) => failJob(supabase, job, message),
  };
}

async function claimJob(supabase: SupabaseClient): Promise<PresentationJob | null> {
  const { data, error } = await supabase.rpc("claim_presentation_job");
  if (error) throw new Error("Falha ao buscar job de apresentacao");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select(`
      id, title, audio_url,
      releases!inner(id, release_date, genre_primary, genre_secondary),
      track_participants(position, artists(stage_name))
    `)
    .eq("tenant_id", row.tenant_id)
    .eq("id", row.track_id)
    .eq("release_id", row.release_id)
    .single();

  if (trackError || !track) {
    await markFailedById(supabase, row.id, row.tenant_id, "Faixa do job nao encontrada");
    return null;
  }

  const release = Array.isArray(track.releases) ? track.releases[0] : track.releases;
  const participants = [...(track.track_participants ?? [])]
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
    .map((participant) => {
      const artist = Array.isArray(participant.artists) ? participant.artists[0] : participant.artists;
      return artist?.stage_name;
    })
    .filter((name): name is string => Boolean(name));

  return {
    id: row.id,
    tenantId: row.tenant_id,
    releaseId: row.release_id,
    trackId: row.track_id,
    audioUrl: track.audio_url ?? "",
    title: track.title,
    releaseDate: release?.release_date ?? "",
    genres: [release?.genre_primary, release?.genre_secondary].filter((genre): genre is string => Boolean(genre)),
    participants,
    userGuidance: row.user_guidance ?? null,
  };
}

async function analyzeAudio(serviceUrl: string, job: PresentationJob): Promise<AudioAnalysis> {
  if (!job.audioUrl) throw new Error("audio missing");
  const response = await fetch(`${serviceUrl}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ audio_url: job.audioUrl }),
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!response.ok) throw new Error("audio service unavailable");
  const analysis = await response.json() as AudioAnalysis;
  if (!analysis.transcript?.trim() && analysis.errors?.length) throw new Error("transcription failed");
  return {
    ...analysis,
    transcript: analysis.transcript?.trim() ?? "",
    errors: analysis.errors ?? [],
    segments: analysis.segments ?? [],
  };
}

async function saveAnalysis(supabase: SupabaseClient, job: PresentationJob, analysis: AudioAnalysis) {
  const [{ error: trackError }, { error: jobError }] = await Promise.all([
    supabase.from("tracks").update({
      lyrics_transcript: analysis.transcript || null,
      audio_bpm: analysis.bpm || null,
      audio_key: analysis.key ? `${analysis.key} ${analysis.mode}` : null,
      audio_energy: analysis.energy,
      audio_duration_sec: Math.round(analysis.duration),
    }).eq("tenant_id", job.tenantId).eq("id", job.trackId),
    supabase.from("presentation_jobs").update({
      audio_analysis: analysis,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", job.tenantId).eq("id", job.id).eq("status", "processing"),
  ]);
  if (trackError || jobError) throw new Error("analysis persistence failed");
}

export async function generatePresentation(
  environment: RuntimeEnvironment,
  input: PresentationInput,
): Promise<PresentationResult> {
  const apiKey = environment.ANTHROPIC_API_KEY ?? environment.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("Claude not configured");

  const prompt = buildPresentationPrompt({
    titulo: input.title,
    creditos: input.participants.join(", ") || "Artistas nao informados",
    generos: input.genres,
    data: input.releaseDate,
    bpm: input.bpm || null,
    key: input.key ? `${input.key} ${input.mode}` : null,
    energy: input.energy,
    transcript_sample: input.transcript.slice(0, 16_000),
    userGuidance: input.userGuidance,
  });

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: prompt },
  ];

  for (let continuation = 0; continuation < 3; continuation += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: environment.CLAUDE_SONNET_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 1400,
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: Math.min(8, Math.max(3, input.participants.length * 2)),
        }],
        messages,
      }),
      signal: AbortSignal.timeout(3 * 60_000),
    });
    if (!response.ok) throw new Error("Claude unavailable");

    const body = await response.json() as {
      stop_reason?: string;
      content?: Array<{ type?: string; text?: string } | Record<string, unknown>>;
    };
    if (body.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: body.content ?? [] });
      continue;
    }

    const raw = (body.content ?? [])
      .map((part) => part.type === "text" ? String(part.text ?? "") : "")
      .join("\n")
      .trim();
    return parsePresentation(raw);
  }

  throw new Error("Claude web search did not complete");
}

function parsePresentation(raw: string): PresentationResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("invalid Claude response");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    apresentacao?: unknown;
    avisos?: unknown;
    fontes?: unknown;
  };
  const apresentacao = String(parsed.apresentacao ?? "").trim();
  if (!apresentacao) throw new Error("empty Claude response");
  const fontes = Array.isArray(parsed.fontes)
    ? parsed.fontes.flatMap((source) => {
        if (!source || typeof source !== "object") return [];
        const titulo = String((source as { titulo?: unknown }).titulo ?? "").trim();
        const url = String((source as { url?: unknown }).url ?? "").trim();
        return titulo && /^https:\/\//i.test(url) ? [{ titulo, url }] : [];
      })
    : [];
  return {
    apresentacao,
    avisos: Array.isArray(parsed.avisos) ? parsed.avisos.map(String) : [],
    fontes,
    raw: raw.slice(0, 50_000),
  };
}

async function completeJob(supabase: SupabaseClient, job: PresentationJob, result: PresentationResult) {
  const { error } = await supabase.rpc("complete_presentation_job", {
    p_job_id: job.id,
    p_presentation: result.apresentacao,
    p_analysis: {
      kind: "presentation",
      user_guidance: job.userGuidance,
      avisos: result.avisos,
      fontes: result.fontes,
      raw: result.raw,
    },
    p_audience: {},
  });
  if (error) throw new Error("pitch completion failed");
}

async function failJob(supabase: SupabaseClient, job: PresentationJob, message: string) {
  await markFailedById(supabase, job.id, job.tenantId, message);
}

async function markFailedById(supabase: SupabaseClient, jobId: string, tenantId: string, message: string) {
  const { error } = await supabase.from("presentation_jobs").update({
    status: "failed",
    last_error: message.slice(0, 300),
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId).eq("tenant_id", tenantId);
  if (error) throw new Error("failed job persistence failed");
}
