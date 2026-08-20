import { describe, expect, it, vi } from "vitest";
import { processNextPresentationJob } from "./processor";

const job = {
  id: "job-1",
  tenantId: "tenant-1",
  releaseId: "release-1",
  trackId: "track-1",
  audioUrl: "https://example.com/audio.mp3",
  title: "Faixa Teste",
  releaseDate: "2026-09-15",
  genres: ["Funk"],
  participants: ["Artista Teste"],
  userGuidance: null,
  cachedAnalysis: null,
};

const cachedAnalysis = {
  transcript: "letra ja transcrita",
  bpm: 129.2,
  key: "F#",
  mode: "major" as const,
  energy: 1,
  duration: 174,
  brightness: 0.7,
  hook_at_sec: 35,
  segments: [],
  errors: [],
};

describe("processNextPresentationJob", () => {
  it("transcribes, analyzes, pitches and completes a claimed job", async () => {
    const dependencies = {
      ready: vi.fn().mockResolvedValue(undefined),
      claim: vi.fn().mockResolvedValue(job),
      analyze: vi.fn().mockResolvedValue({
        transcript: "letra transcrita inteira",
        bpm: 130,
        key: "F#",
        mode: "minor",
        energy: 0.8,
        duration: 180,
        brightness: 0.6,
        hook_at_sec: 42,
        segments: [],
        errors: [],
      }),
      saveAnalysis: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn().mockResolvedValue({
        apresentacao: "Pitch final",
        avisos: [],
        fontes: [{ titulo: "Fonte", url: "https://example.com" }],
        raw: "{}",
      }),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    await expect(processNextPresentationJob(dependencies)).resolves.toBe(true);
    expect(dependencies.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "letra transcrita inteira",
        participants: ["Artista Teste"],
      }),
    );
    expect(dependencies.complete).toHaveBeenCalledWith(
      job,
      expect.objectContaining({ apresentacao: "Pitch final" }),
    );
    expect(dependencies.ready).toHaveBeenCalledOnce();
    expect(dependencies.fail).not.toHaveBeenCalled();
  });

  it("does not claim a job while the presentation provider is unavailable", async () => {
    const dependencies = {
      ready: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      claim: vi.fn(),
      analyze: vi.fn(),
      saveAnalysis: vi.fn(),
      generate: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
    };

    await expect(processNextPresentationJob(dependencies)).rejects.toThrow("provider unavailable");
    expect(dependencies.claim).not.toHaveBeenCalled();
  });

  it("reuses analysis for the current audio version without transcribing again", async () => {
    const cachedJob = { ...job, cachedAnalysis };
    const dependencies = {
      ready: vi.fn().mockResolvedValue(undefined),
      claim: vi.fn().mockResolvedValue(cachedJob),
      analyze: vi.fn(),
      saveAnalysis: vi.fn(),
      generate: vi.fn().mockResolvedValue({
        apresentacao: "Pitch em menos de um minuto",
        avisos: [],
        fontes: [],
        raw: "{}",
      }),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    await expect(processNextPresentationJob(dependencies)).resolves.toBe(true);

    expect(dependencies.analyze).not.toHaveBeenCalled();
    expect(dependencies.saveAnalysis).not.toHaveBeenCalled();
    expect(dependencies.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "letra ja transcrita",
        bpm: 129.2,
      }),
    );
  });

  it("stores a safe failure without exposing provider details", async () => {
    const dependencies = {
      ready: vi.fn().mockResolvedValue(undefined),
      claim: vi.fn().mockResolvedValue(job),
      analyze: vi.fn().mockRejectedValue(new Error("secret provider response")),
      saveAnalysis: vi.fn(),
      generate: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    await expect(processNextPresentationJob(dependencies)).resolves.toBe(true);
    expect(dependencies.fail).toHaveBeenCalledWith(job, "Falha ao analisar o audio da faixa");
  });
});
