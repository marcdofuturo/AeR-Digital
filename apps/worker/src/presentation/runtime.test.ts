import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePresentation } from "./runtime";
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

  it("uses a supported fallback model and continues a paused web search", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        stop_reason: "pause_turn",
        content: [{ type: "server_tool_use", id: "search-1", name: "web_search", input: {} }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        stop_reason: "end_turn",
        content: [{
          type: "text",
          text: JSON.stringify({
            apresentacao: "Pitch final",
            avisos: [],
            fontes: [{ titulo: "Fonte", url: "https://example.com/fonte" }],
          }),
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePresentation({ ANTHROPIC_API_KEY: "test-key" }, input)).resolves.toMatchObject({
      apresentacao: "Pitch final",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    expect(firstRequest.model).toBe("claude-sonnet-4-20250514");
    expect(secondRequest.messages).toHaveLength(2);
    expect(secondRequest.messages[1]).toMatchObject({ role: "assistant" });
  });
});
