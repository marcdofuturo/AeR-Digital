import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAiCredits,
  generateClaudePresentation,
  parsePresentationResponse,
  remainingAiCredits,
} from "./presentation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presentation ai credits", () => {
  it("deducts only explicitly charged credit units", () => {
    expect(remainingAiCredits(0)).toBe(100);
    expect(remainingAiCredits(6)).toBe(94);
    expect(() => assertAiCredits(100)).toThrow("Créditos de IA insuficientes");
  });
});

describe("parsePresentationResponse", () => {
  it("parses strict Claude JSON", () => {
    expect(
      parsePresentationResponse('{"apresentacao":"Texto final","avisos":["sem numeros"]}'),
    ).toMatchObject({
      apresentacao: "Texto final",
      avisos: ["sem numeros"],
    });
  });
});

describe("generateClaudePresentation", () => {
  it("calls Claude and returns the generated presentation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ text: '{"apresentacao":"Funk direto para pista.","avisos":[]}' }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateClaudePresentation({
        apiKey: "test-key",
        model: "claude-test",
        track: {
          title: "Acordei feliz",
          releaseDate: "2026-09-15",
          genres: ["Funk"],
          participants: ["Mc Rick"],
        },
      }),
    ).resolves.toMatchObject({ apresentacao: "Funk direto para pista." });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
        body: expect.stringContaining("web_search_20250305"),
      }),
    );
  });

  it("returns a local presentation when Claude credentials fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    await expect(
      generateClaudePresentation({
        apiKey: "invalid-key",
        model: "claude-test",
        track: {
          title: "SE SOLTA",
          releaseDate: "2027-03-05",
          genres: ["Funk", "Trap"],
          participants: ["MC GH", "MC JACARE", "MUCILON"],
        },
      }),
    ).resolves.toMatchObject({
      apresentacao: expect.stringContaining("SE SOLTA"),
      avisos: expect.arrayContaining([
        "Claude indisponível (401). Verifique o segredo ANTHROPIC_API_KEY no Cloudflare Pages.",
      ]),
    });
  });
});
