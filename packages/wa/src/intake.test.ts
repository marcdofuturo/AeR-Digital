import { describe, expect, it } from "vitest";
import { StepMachine } from "./machine";
import {
  assignRoles,
  matchGenre,
  parseAudioFilename,
  parseMetadataCorrection,
  parseReleaseDate,
  splitNames,
} from "./handlers";
import { MockProvider } from "./provider";
import type { Draft, HandlerContext, HandlerDB, ResolvedArtist } from "./types";

function testDB(artists: ResolvedArtist[] = []): HandlerDB {
  const store = [...artists];
  return {
    async findArtist(_tenantId, name) {
      const n = name.toLowerCase().trim();
      const found = store.find((a) => a.stage_name.toLowerCase() === n || a.input_name.toLowerCase() === n);
      return found ?? null;
    },
    async createArtist(_tenantId, stageName) {
      const artist: ResolvedArtist = {
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
      store.push(artist);
      return artist;
    },
    async createRelease(_params) {
      return { releaseId: "r-1", trackId: "t-1" };
    },
  };
}

function testCtx(db = testDB()): HandlerContext {
  return {
    tenant_id: "t-supertime",
    tenant_name: "SuperTime Digital",
    phone: "+5511999999999",
    provider: new MockProvider(),
    db,
  };
}

function artist(name: string, position: number): ResolvedArtist {
  return {
    id: `a-${position}`,
    stage_name: name,
    input_name: name,
    position,
    billing_role: position <= 4 ? "primary" : "featuring",
    is_producer: false,
    is_composer: true,
    is_performer: true,
    hidden_from_billing: false,
    match_score: 1,
    needs_review: false,
  };
}

describe("new WhatsApp intake flow", () => {
  it("asks release format, then audio and cover before metadata confirmation", async () => {
    const machine = new StepMachine("ask_release_format", {}, testCtx());

    let result = await machine.process("single");
    expect(result.nextStep).toBe("ask_audio");
    expect(result.reply).toContain("Envie o áudio");

    result = await machine.process("MC GH, MC Jacare - Minha Musica Incrivel.mp3");
    expect(result.nextStep).toBe("ask_cover");
    expect(result.draft.filename_title_guess).toBe("Minha Musica Incrivel");

    result = await machine.process("capa.jpg");
    expect(result.nextStep).toBe("confirm_file_metadata");
    expect(result.reply).toContain("Minha Musica Incrivel");
    expect(result.reply).toContain("MC GH");
    expect(result.reply).toContain("adicionar");
  });

  it("supports album count before the first audio", async () => {
    const machine = new StepMachine("ask_release_format", {}, testCtx());

    let result = await machine.process("album");
    expect(result.nextStep).toBe("ask_album_track_count");

    result = await machine.process("8 faixas");
    expect(result.nextStep).toBe("ask_audio");
    expect(result.draft.album_track_count).toBe(8);
    expect(result.reply).toContain("Envie o áudio da faixa 1");
  });

  it("accepts corrected metadata list and returns to metadata confirmation", async () => {
    const machine = new StepMachine("ask_metadata_correction", {}, testCtx());

    const result = await machine.process("Titulo: Noite Linda\nParticipantes: Ana, Beto, Carla\nCargos: Ana - principal; Beto - feat; Carla - feat");

    expect(result.nextStep).toBe("confirm_file_metadata");
    expect(result.draft.title).toBe("Noite Linda");
    expect(result.draft.artists).toHaveLength(3);
    expect(result.reply).toContain("Noite Linda");
    expect(result.reply).toContain("Carla");
  });

  it("adds an outside producer to the visible list and asks for one confirmation", async () => {
    const machine = new StepMachine(
      "ask_producers",
      { title: "Teste", artists: [artist("Ana", 1), artist("Beto", 2)] },
      testCtx(),
    );

    const result = await machine.process("DJ Novo");

    expect(result.nextStep).toBe("confirm_external_producer");
    expect(result.draft.artists?.map((a) => a.stage_name)).toContain("DJ Novo");
    expect(result.reply).toContain("DJ Novo");
    expect(result.reply).toContain("confirma");
  });

  it("does not ask another confirmation when producer is already in the participant list", async () => {
    const machine = new StepMachine(
      "ask_producers",
      { title: "Teste", artists: [artist("Ana", 1), artist("DJ Novo", 2)] },
      testCtx(),
    );

    const result = await machine.process("DJ Novo");

    expect(result.nextStep).toBe("ask_genres");
    expect(result.draft.artists?.find((a) => a.stage_name === "DJ Novo")?.is_producer).toBe(true);
  });

  it("runs the full single flow and creates the release after one review text", async () => {
    let created: { title: string; participants: ResolvedArtist[]; coverUrl?: string } | undefined;
    const db = testDB();
    db.createRelease = async (params) => {
      created = params;
      return { releaseId: "r-1", trackId: "t-1" };
    };
    const machine = new StepMachine("ask_release_format", {}, testCtx(db));

    await machine.process("single");
    await machine.process("MC GH, MC Jacare - Minha Musica Incrivel.mp3");
    await machine.process("capa.jpg");
    await machine.process("sim");
    await machine.process("MC Jacare");
    await machine.process("Funk, Trap");
    const review = await machine.process("06/03/2027");
    expect(review.nextStep).toBe("confirm");
    expect(review.reply).toContain("Revisão");
    expect(review.reply).toContain("6 de março de 2027");
    expect(review.reply).toContain("Enviar");

    const done = await machine.process("sim");
    expect(done.nextStep).toBe("done");
    expect(created).toBeTruthy();
    expect(created!.title).toBe("Minha Musica Incrivel");
    expect(created!.participants).toHaveLength(2);
    expect(created!.coverUrl).toBe("received");
  });

  it("supports voltar to reopen the previous question", async () => {
    const machine = new StepMachine("ask_cover", { audio_url: "received" }, testCtx());

    const result = await machine.process("voltar");
    expect(result.nextStep).toBe("ask_audio");
    expect(result.reply).toContain("Voltamos");
  });
});

describe("WhatsApp helper parsing", () => {
  it("reads title and participants from an audio filename", () => {
    expect(parseAudioFilename("[AUDIO] MC GH, MC Jacare - Minha Musica Incrivel.mp3")).toEqual({
      title: "Minha Musica Incrivel",
      participants: ["MC GH", "MC Jacare"],
    });
  });

  it("parses metadata correction lists", () => {
    expect(parseMetadataCorrection("Titulo: X\nParticipantes: A, B")).toEqual({
      title: "X",
      participants: ["A", "B"],
      roles: [],
    });
  });

  it("splits names and assigns primary/featuring roles", () => {
    expect(splitNames("A, B feat C")).toEqual(["A", "B", "C"]);
    const roles = assignRoles([artist("A", 0), artist("B", 0), artist("C", 0), artist("D", 0), artist("E", 0)]);
    expect(roles[0]!.billing_role).toBe("primary");
    expect(roles[4]!.billing_role).toBe("featuring");
  });

  it("matches genres and parses dates", () => {
    expect(matchGenre("Forro")).toBe("Forró");
    expect(parseReleaseDate("06/03/2027")).toBe("2027-03-06");
  });

  it("stops after 3 confirmation cycles", async () => {
    const draft: Draft = { title: "X", release_date: "2027-01-01", genres: ["Funk"], artists: [] };
    const machine = new StepMachine("confirm", draft, testCtx());

    await machine.process("não");
    await machine.process("também não");
    const result = await machine.process("ainda não");
    expect(result.nextStep).toBe("done");
    expect(result.reply).toContain("ajuda do time");
  });
});
