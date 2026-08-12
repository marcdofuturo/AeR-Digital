// ─── Prompt 6 — Pitch tests ────────────────────────────────
import { describe, it, expect } from "vitest";
import { buildPitchPrompt, buildPresentationPrompt, isEligibleForPitch } from "./pitch";
import type { PitchContext } from "./pitch";

describe("Pitch prompt", () => {
  const mockCtx: PitchContext = {
    titulo: "SE SOLTA",
    creditos: "MC GH, MC Jacaré & Mucilon",
    generos: ["Funk", "Trap"],
    data: "2027-03-06",
    bpm: 130.5,
    key: "F#",
    energy: 0.85,
    hook_at_sec: 45.2,
    transcript_sample: "Se solta, vai, não para não...",
    artistAudiences: [
      { name: "MC GH", followers: 50000, genres: ["funk"], popularity: 65, related: ["MC Jacaré", "Kaverinha"] },
    ],
    catalogSimilar: ["SE SOLTA", "VRAU"],
  };

  it("builds prompt with all required fields", () => {
    const prompt = buildPitchPrompt(mockCtx);
    expect(prompt).toContain("SE SOLTA");
    expect(prompt).toContain("Funk");
    expect(prompt).toContain("130.5 BPM");
    expect(prompt).toContain("500 caracteres");
    expect(prompt).toContain("SONORO");
    expect(prompt).toContain("NARRATIVO");
    expect(prompt).toContain("NUNCA invente");
  });

  it("includes audience data", () => {
    const prompt = buildPitchPrompt(mockCtx);
    expect(prompt).toContain("MC GH");
    expect(prompt).toContain("50.000");
    expect(prompt).toContain("MC Jacaré");
  });
});

describe("Pitch eligibility", () => {
  it("returns true when lead time >= minLeadDays", () => {
    const release = "2027-04-01";
    const created = "2027-03-01";
    expect(isEligibleForPitch(release, created, 10)).toBe(true);
  });

  it("returns false when lead time < minLeadDays", () => {
    const release = "2027-03-05";
    const created = "2027-03-01";
    expect(isEligibleForPitch(release, created, 10)).toBe(false);
  });

  it("boundary: exactly 10 days is eligible", () => {
    const release = "2027-03-11";
    const created = "2027-03-01";
    expect(isEligibleForPitch(release, created, 10)).toBe(true);
  });
});

describe("Character limit", () => {
  it("prompt mentions 500 character limit for Spotify", () => {
    const prompt = buildPitchPrompt({
      titulo: "X", creditos: "Y", generos: ["Funk"], data: "2027-01-01",
      bpm: 100, key: "C", energy: 0.5, hook_at_sec: 10,
      transcript_sample: "test", artistAudiences: [], catalogSimilar: [],
    });
    expect(prompt).toContain("500");
    expect(prompt).toContain("caracteres");
  });
});

describe("Presentation prompt", () => {
  it("builds a single presentation prompt with optional improvement guidance", () => {
    const prompt = buildPresentationPrompt({
      titulo: "Acordei feliz",
      creditos: "Mc Rick, Mc Lobao",
      generos: ["Funk"],
      data: "2026-09-15",
      bpm: null,
      key: null,
      energy: null,
      transcript_sample: "",
      userGuidance: "deixe mais direto e cite o refrão",
    });

    expect(prompt).toContain("apresentação");
    expect(prompt).toContain("Acordei feliz");
    expect(prompt).toContain("deixe mais direto");
    expect(prompt).not.toContain("DUAS OPÇÕES");
  });
});
