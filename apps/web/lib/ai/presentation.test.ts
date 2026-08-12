import { describe, expect, it, vi } from "vitest";
import { assertAiCredits, generateClaudePresentation, parsePresentationResponse, remainingAiCredits } from "./presentation";

describe("presentation ai credits", () => {
  it("uses 2 credits per generated presentation", () => {
    expect(remainingAiCredits(0)).toBe(100);
    expect(remainingAiCredits(3)).toBe(94);
    expect(() => assertAiCredits(50)).toThrow("Créditos de IA insuficientes");
  });
});

describe("parsePresentationResponse", () => {
  it("parses strict Claude JSON", () => {
    expect(parsePresentationResponse('{"apresentacao":"Texto final","avisos":["sem numeros"]}')).toMatchObject({
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

    await expect(generateClaudePresentation({
      apiKey: "test-key",
      model: "claude-test",
      track: {
        title: "Acordei feliz",
        releaseDate: "2026-09-15",
        genres: ["Funk"],
        participants: ["Mc Rick"],
      },
    })).resolves.toMatchObject({ apresentacao: "Funk direto para pista." });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
  });
});

