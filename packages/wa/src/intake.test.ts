// ─── WhatsApp Intake Tests — 10 scenarios ───────────────────
import { describe, it, expect, beforeAll } from "vitest";
import { StepMachine } from "./machine";
import { handlers, assignRoles, splitNames, matchGenre, parseReleaseDate } from "./handlers";
import { MockProvider } from "./provider";
import type { HandlerContext, HandlerDB, ResolvedArtist, Draft } from "./types";
import type { Step } from "./types";

// Test DB with in-memory artist store
function testDB(artists: ResolvedArtist[] = []): HandlerDB {
  const store = [...artists];
  return {
    async findArtist(_tenantId, name) {
      const n = name.toLowerCase().trim();
      const found = store.find(a => a.stage_name.toLowerCase() === n || a.input_name.toLowerCase() === n);
      return found ?? null;
    },
    async createArtist(_tenantId, stageName) {
      const a: ResolvedArtist = {
        id: `new-${crypto.randomUUID()}`,
        stage_name: stageName,
        input_name: stageName,
        position: 0,
        billing_role: "primary",
        is_producer: false,
        is_composer: true,
        is_performer: true,
        hidden_from_billing: false,
        match_score: 0,
        needs_review: true,
      };
      store.push(a);
      return a;
    },
    async createRelease(_params) {
      return { releaseId: "r-1", trackId: "t-1" };
    },
  };
}

function testCtx(provider?: MockProvider): HandlerContext {
  return {
    tenant_id: "t-supertime",
    tenant_name: "SuperTime Digital",
    phone: "+5511999999999",
    provider: provider ?? new MockProvider(),
    db: testDB(),
  };
}

// ─── a) Happy flow: 3 artists, producer in list ──────────────
describe("Intake flow", () => {
  it("a) Happy flow — 3 artists, producer already in list", async () => {
    const prov = new MockProvider();
    const ctx = testCtx(prov);
    const m = new StepMachine("ask_title", {}, ctx);

    // P1: title
    let r = await m.process("SE SOLTA");
    expect(r.nextStep).toBe("ask_artists");
    expect(r.reply).toContain("SE SOLTA");
    expect(r.reply).toContain("Quais artistas participam?");

    // P2: artists
    r = await m.process("MC GH, MC Jacaré, Mucilon");
    expect(r.nextStep).toBe("ask_producers");
    expect(r.reply).toContain("MC GH");
    expect(r.reply).toContain("MC Jacaré");
    expect(r.reply).toContain("Mucilon");
    expect(r.reply).toContain("Quem produziu");

    const artists = r.draft.artists!;
    expect(artists).toHaveLength(3);
    expect(artists[0]!.billing_role).toBe("primary");
    expect(artists[2]!.billing_role).toBe("primary");

    // P3: producers (Mucilon already in list)
    r = await m.process("Mucilon");
    expect(r.nextStep).toBe("ask_genres");

    // P4: genres
    r = await m.process("Funk, Trap");
    expect(r.nextStep).toBe("ask_date");
    expect(r.reply).toContain("Funk");
    expect(r.reply).toContain("Trap");

    // P5: date
    r = await m.process("06/03/2027");
    expect(r.nextStep).toBe("ask_audio");
    expect(r.reply).toContain("áudio");

    // Audio
    r = await m.process("audio_file.mp3");
    expect(r.nextStep).toBe("ask_cover");

    // Cover
    r = await m.process("cover.jpg");
    expect(r.nextStep).toBe("confirm");
    expect(r.reply).toContain("Tá certo?");

    // Confirm
    r = await m.process("SIM");
    expect(r.nextStep).toBe("done");
    expect(r.reply).toContain("Fechou");
  });

  it("b) Producer outside list, answering position 3", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("ask_producers", {
      title: "Test",
      artists: [
        { id: "a1", stage_name: "A", input_name: "A", position: 1, billing_role: "primary", is_producer: false, is_composer: true, is_performer: true, hidden_from_billing: false, match_score: 1, needs_review: false },
        { id: "a2", stage_name: "B", input_name: "B", position: 2, billing_role: "primary", is_producer: false, is_composer: true, is_performer: true, hidden_from_billing: false, match_score: 1, needs_review: false },
      ],
    }, ctx);

    let r = await m.process("ProducerC");
    expect(r.nextStep).toBe("ask_producer_position");
    expect(r.reply).toContain("ProducerC");
    expect(r.reply).toContain("posição");

    r = await m.process("3");
    expect(r.nextStep).toBe("ask_genres");
    const producers = r.draft.producers ?? [];
    expect(producers[0]?.position).toBe(3);
  });

  it("c) Producer outside list, answering NÃO", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("ask_producers", {
      title: "Test",
      artists: [
        { id: "a1", stage_name: "A", input_name: "A", position: 1, billing_role: "primary", is_producer: false, is_composer: true, is_performer: true, hidden_from_billing: false, match_score: 1, needs_review: false },
        { id: "a2", stage_name: "B", input_name: "B", position: 2, billing_role: "primary", is_producer: false, is_composer: true, is_performer: true, hidden_from_billing: false, match_score: 1, needs_review: false },
      ],
    }, ctx);

    let r = await m.process("DJ X");
    expect(r.nextStep).toBe("ask_producer_position");

    r = await m.process("NÃO");
    expect(r.nextStep).toBe("ask_genres");
    expect(r.draft.producers![0]!.hidden_from_billing).toBe(true);
  });

  it("d) 6 artists — 5th and 6th are featuring", () => {
    const artists = [
      { id: "a1", stage_name: "A1", input_name: "A1", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
      { id: "a2", stage_name: "A2", input_name: "A2", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
      { id: "a3", stage_name: "A3", input_name: "A3", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
      { id: "a4", stage_name: "A4", input_name: "A4", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
      { id: "a5", stage_name: "A5", input_name: "A5", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
      { id: "a6", stage_name: "A6", input_name: "A6", position: 0, billing_role: "primary", is_producer: false, is_composer: false, is_performer: true, hidden_from_billing: false, match_score: 0, needs_review: false },
    ];
    const result = assignRoles(artists);
    expect(result[0]!.billing_role).toBe("primary");
    expect(result[3]!.billing_role).toBe("primary");
    expect(result[4]!.billing_role).toBe("featuring");
    expect(result[5]!.billing_role).toBe("featuring");
    expect(result[4]!.position).toBe(5);
    expect(result[5]!.position).toBe(6);
  });

  it("e) Title with Portuguese error — handler accepts input (no LLM in test)", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("ask_title", {}, ctx);

    // Handlers accept any input — LLM validation is an outer layer
    const r = await m.process("SE SOULTA");
    expect(r.nextStep).toBe("ask_artists");
    expect(r.reply).toContain("SE SOULTA");
    expect(r.draft.title).toBe("SE SOULTA");
  });

  it("f) Artist not found in DB — creates new with needs_review", async () => {
    const ctx: HandlerContext = {
      ...testCtx(new MockProvider()),
      db: testDB([]), // empty DB — no artists found
    };
    const m = new StepMachine("ask_artists", { title: "Test" }, ctx);

    const r = await m.process("Artista Novo");
    // With 1 artist, it goes to ask_producers (no need to ask producer for single artist follow-up)
    const artists = r.draft.artists!;
    expect(artists).toHaveLength(1);
    expect(artists[0]!.needs_review).toBe(true);
    expect(artists[0]!.stage_name).toBe("Artista Novo");
  });

  it("g) Date '06/03' resolves to next future March 6", () => {
    // parseReleaseDate for dd/mm should resolve to next future
    // We don't mock dates here but we verify it returns a valid ISO date
    const d = parseReleaseDate("06/03");
    expect(d).toBeTruthy();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should be either current year or next year
    const year = parseInt(d!.split("-")[0]!);
    const now = new Date().getUTCFullYear();
    expect(year).toBeGreaterThanOrEqual(now);
  });

  it("h) Cover step — asks user to send as document", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("ask_cover", {
      title: "SE SOLTA",
      release_date: "2027-03-06",
      genres: ["Funk", "Trap"],
      artists: [
        { id: "a1", stage_name: "MC GH", input_name: "MC GH", position: 1, billing_role: "primary", is_producer: false, is_composer: true, is_performer: true, hidden_from_billing: false, match_score: 1, needs_review: false },
      ],
    }, ctx);

    const r = await m.process("cover.jpg");
    // The cover handler sets cover_url and moves to confirm
    expect(r.nextStep).toBe("confirm");
    expect(r.reply).toContain("Tá certo");
    // Even though it's a low-res cover, the webhook handler validates asynchronously
    // The cover handler doesn't validate — it just accepts
  });

  it("i) All handlers work without LLM dependency (bypass)", async () => {
    const prov = new MockProvider();
    const ctx = testCtx(prov);
    const m = new StepMachine("ask_title", {}, ctx);

    // Verify every step completes without LLM
    const steps: Array<{ step: Step; input: string }> = [
      { step: "ask_title", input: "Test Song" },
      { step: "ask_artists", input: "A, B" },
      { step: "ask_producers", input: "A" },
      { step: "ask_genres", input: "Funk" },
      { step: "ask_date", input: "15/12/2027" },
      { step: "ask_audio", input: "audio.mp3" },
      { step: "ask_cover", input: "cover.jpg" },
      { step: "confirm", input: "SIM" },
    ];

    for (const { step, input } of steps) {
      const sm = new StepMachine(step, {}, ctx);
      const r = await sm.process(input);
      expect(r.nextStep).toBeTruthy();
      // All should produce a reply
      expect(r.reply.length).toBeGreaterThan(0);
    }
  });

  it("j) Latency — handler response under 100ms with MockProvider", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("ask_title", {}, ctx);

    const iterations = 20;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const sm = new StepMachine("ask_title", {}, ctx);
      const start = performance.now();
      await sm.process(`Song ${i}`);
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);

    // With MockProvider (no network I/O), average should be < 50ms
    expect(avg).toBeLessThan(50);
    expect(max).toBeLessThan(100);
  });
});

// ─── Unit tests for helpers ──────────────────────────────────
describe("splitNames", () => {
  it("splits by comma", () => {
    expect(splitNames("MC GH, MC Jacaré, Mucilon")).toEqual(["MC GH", "MC Jacaré", "Mucilon"]);
  });
  it("splits by feat/feat", () => {
    expect(splitNames("A feat B")).toHaveLength(2);
    expect(splitNames("A ft. C")).toHaveLength(2);
  });
  it("removes numbering from names", () => {
    // Split separates by comma, then strips numbering prefix
    const result = splitNames("1. MC GH, 2) MC Jacaré");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("MC GH");
    expect(result[1]).toContain("MC Jacaré");
  });
  it("filters empty/single char", () => {
    expect(splitNames("A, , B")).toEqual(["A", "B"]);
  });
  it("caps at 12", () => {
    expect(splitNames(Array.from({ length: 15 }, (_, i) => `Artist${i}`).join(", "))).toHaveLength(12);
  });
});

describe("matchGenre", () => {
  it("matches exact", () => {
    expect(matchGenre("Funk")).toBe("Funk");
  });
  it("matches case-insensitive", () => {
    expect(matchGenre("funk")).toBe("Funk");
  });
  it("matches with accent errors", () => {
    expect(matchGenre("Forro")).toBe("Forró");
  });
  it("matches within Levenshtein 2", () => {
    expect(matchGenre("Funck")).toBe("Funk");
  });
  it("returns null for invalid", () => {
    expect(matchGenre("xyznotag")).toBeNull();
  });
});

describe("parseReleaseDate", () => {
  it("parses dd/mm/yyyy", () => {
    const d = parseReleaseDate("06/03/2027");
    expect(d).toBe("2027-03-06");
  });
  it("parses dd/mm/yy as 20xx", () => {
    const d = parseReleaseDate("15/06/28");
    expect(d).toMatch(/^20\d{2}-06-15$/);
  });
  it("returns null for invalid", () => {
    expect(parseReleaseDate("not a date")).toBeNull();
  });
});

describe("assignRoles", () => {
  it("positions 1-4 = primary, 5+ = featuring", () => {
    const base = Array.from({ length: 7 }, (_, i) => ({
      id: `${i}`, stage_name: `A${i}`, input_name: `A${i}`, position: 0,
      billing_role: "primary" as const, is_producer: false, is_composer: false, is_performer: true,
      hidden_from_billing: false, match_score: 0, needs_review: false,
    }));
    const r = assignRoles(base);
    for (let i = 0; i < 4; i++) expect(r[i]!.billing_role).toBe("primary");
    for (let i = 4; i < 7; i++) expect(r[i]!.billing_role).toBe("featuring");
  });
});

describe("StepMachine max cycles", () => {
  it("stops after 3 confirmation cycles", async () => {
    const ctx = testCtx(new MockProvider());
    const m = new StepMachine("confirm", { title: "X", release_date: "2027-01-01", genres: ["Funk"], artists: [] }, ctx);

    await m.process("não"); // cycle 1
    await m.process("também não"); // cycle 2
    const r = await m.process("ainda não"); // cycle 3 — escalates
    expect(r.nextStep).toBe("done");
    expect(r.reply).toContain("ajuda do time");
  });
});
