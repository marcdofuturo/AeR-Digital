import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeAudio,
  generatePresentation,
  markFailedById,
  resolveClaudeModel,
  resolveSupabaseCredentials,
  verifyAnthropicConfiguration,
} from "./runtime";
import type { PresentationInput } from "./processor";

const input: PresentationInput = {
  id: "job-1",
  tenantId: "tenant-1",
  releaseId: "release-1",
  trackId: "track-1",
  audioUrl: "https://example.supabase.co/audio.mp3",
  title: "Faixa Teste",
  releaseDate: "2026-09-15",
  genres: ["Funk"],
  participants: ["Artista Teste"],
  userGuidance: null,
  cachedAnalysis: null,
  transcript: "transcricao completa",
  bpm: 130,
  key: "F#",
  mode: "minor",
  energy: 0.8,
  brightness: 0.6,
  duration: 180,
  hook_at_sec: 42,
  segments: [],
  errors: [],
};

describe("presentation runtime", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("researches with web search and synthesizes a structured presentation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "pause_turn",
            content: [{ type: "server_tool_use", id: "search-1", name: "web_search", input: {} }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: "Pesquisa factual sobre o artista e sua relevancia publica.",
                citations: [
                  {
                    type: "web_search_result_location",
                    title: "Spotify for Artists",
                    url: "https://artists.spotify.com/blog",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  apresentacao: "Pitch final",
                  avisos: [],
                }),
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input),
    ).resolves.toMatchObject({
      apresentacao: "Pitch final",
      fontes: [{ titulo: "Spotify for Artists", url: "https://artists.spotify.com/blog" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    const synthesisRequest = JSON.parse(String(fetchMock.mock.calls[2]![1]?.body));
    expect(firstRequest.model).toBe("claude-sonnet-4-6");
    expect(firstRequest.max_tokens).toBeLessThanOrEqual(1_200);
    expect(firstRequest.tools[0].max_uses).toBeLessThanOrEqual(4);
    expect(secondRequest.messages).toHaveLength(2);
    expect(secondRequest.messages[1]).toMatchObject({ role: "assistant" });
    expect(synthesisRequest.tools).toBeUndefined();
    expect(synthesisRequest.output_config.format.type).toBe("json_schema");
    expect(synthesisRequest.messages[0].content).toContain("Pesquisa factual");
  });

  it("limits the commercial text to 500 characters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Pesquisa factual concluida." }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({ apresentacao: "A".repeat(620) }),
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input);

    expect(result.apresentacao.length).toBeLessThanOrEqual(500);
  });

  it("repairs a noncompliant pitch without repeating research", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Pesquisa factual concluida." }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  apresentacao: "Fonte: Spotify. Indicada para a playlist editorial X.",
                }),
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  apresentacao:
                    "Faixa de pulso vibrante, refrão imediato e interpretação carismática, com força para ampliar a conexão do artista com o público.",
                }),
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input);

    expect(result.apresentacao).not.toMatch(/spotify|playlist|fonte/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[2]![1]?.body));
    expect(repairRequest.tools).toBeUndefined();
    expect(repairRequest.messages[0].content).toContain("CORRIJA");
  });

  it("generates from track evidence when public research has no verified source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Nenhum resultado publico confiavel encontrado." }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({ apresentacao: "Pitch baseado na faixa", avisos: [] }),
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input),
    ).resolves.toMatchObject({
      apresentacao: "Pitch baseado na faixa",
      fontes: [],
      avisos: [],
    });
  });

  it("persists only cited, unique sources and caps their count", async () => {
    const citations = Array.from({ length: 15 }, (_, index) => ({
      type: "web_search_result_location",
      title: `Fonte citada ${index + 1}`,
      url: `https://example.com/cited-${index + 1}`,
    }));
    const searchResults = Array.from({ length: 5 }, (_, index) => ({
      type: "web_search_result",
      title: `Resultado bruto ${index + 1}`,
      url: `https://example.com/raw-${index + 1}`,
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              { type: "web_search_tool_result", content: searchResults },
              {
                type: "text",
                text: "Pesquisa concluida.",
                citations: [...citations, citations[0]],
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({ apresentacao: "Pitch final", avisos: [] }),
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input);

    expect(result.fontes).toHaveLength(8);
    expect(result.fontes.every((source) => source.titulo.startsWith("Fonte citada"))).toBe(true);
    expect(result.raw).not.toContain("Resultado bruto");
  });

  it("verifies the configured key and model before jobs are claimed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "claude-sonnet-4-6" }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      verifyAnthropicConfiguration({ ANTHROPIC_API_KEY: "test-key" }, fetchMock),
    ).resolves.toEqual({ model: "claude-sonnet-4-6" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models?limit=100",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects a retired model before processing presentation jobs", () => {
    expect(() =>
      resolveClaudeModel({
        CLAUDE_SONNET_MODEL: "claude-sonnet-4-20250514",
      }),
    ).toThrow("Modelo Claude aposentado");
  });

  it("trims credentials and falls back when SUPABASE_URL is blank", () => {
    expect(
      resolveSupabaseCredentials({
        SUPABASE_URL: "  ",
        NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
        SUPABASE_SERVICE_ROLE_KEY: " test-service-role-key ",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "test-service-role-key",
    });
  });

  it("rejects a service role key containing only whitespace", () => {
    expect(() =>
      resolveSupabaseCredentials({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: " \t ",
      }),
    ).toThrow("Supabase do worker nao configurado");
  });

  it("allows the audio service to take the full analysis timeout before headers arrive", async () => {
    const audioRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue({
          transcript: "letra transcrita",
          bpm: 130,
          key: "F#",
          mode: "minor",
          energy: 0.8,
          brightness: 0.6,
          duration: 180,
          hook_at_sec: 42,
          segments: [],
          errors: [],
        }),
      },
    });

    await expect(
      analyzeAudio("http://audio-svc:8000", input, audioRequest as never),
    ).resolves.toMatchObject({ transcript: "letra transcrita" });

    expect(audioRequest).toHaveBeenCalledWith(
      "http://audio-svc:8000/analyze",
      expect.objectContaining({
        headersTimeout: 15 * 60_000,
        bodyTimeout: 15 * 60_000,
      }),
    );
  });

  it("never overwrites a presentation job that already completed", async () => {
    const statusEq = vi.fn().mockResolvedValue({ error: null });
    const tenantEq = vi.fn(() => ({ eq: statusEq }));
    const idEq = vi.fn(() => ({ eq: tenantEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    const supabase = { from: vi.fn(() => ({ update })) };

    await markFailedById(supabase as never, "job-1", "tenant-1", "falha segura");

    expect(statusEq).toHaveBeenCalledWith("status", "processing");
  });
});
