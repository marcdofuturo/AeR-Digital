// ─── Step Machine — orchestrates the intake flow ─────────────
import type { Step, Draft, HandlerContext, StepResult } from "./types";
import { handlers } from "./handlers";

const PREVIOUS_STEP: Partial<Record<Step, Step>> = {
  ask_album_track_count: "ask_release_format",
  ask_title: "ask_release_format",
  ask_artists: "ask_title",
  ask_producers: "ask_artists",
  ask_producer_position: "ask_producers",
  ask_genres: "ask_producers",
  ask_date: "ask_genres",
  ask_audio: "ask_date",
  ask_cover: "ask_audio",
  confirm: "ask_cover",
};

export class StepMachine {
  private step: Step;
  private draft: Draft;
  private ctx: HandlerContext;
  private cycleCount = 0;
  static MAX_CYCLES = 3; // public for test assertions

  constructor(step: Step, draft: Draft, ctx: HandlerContext) {
    this.step = step;
    this.draft = { ...draft };
    this.ctx = ctx;
  }

  get currentStep(): Step {
    return this.step;
  }

  get currentDraft(): Draft {
    return this.draft;
  }

  async process(input: string): Promise<StepResult> {
    const normalizedInput = input.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedInput === "voltar") {
      const previous = PREVIOUS_STEP[this.step] ?? "ask_release_format";
      this.step = previous;
      const reply = `Sem problema. Voltamos uma etapa.\n\n${promptFor(previous)}`;
      return { reply: appendBackHint(reply), nextStep: previous, draft: this.draft };
    }

    const handler = handlers[this.step];
    if (!handler) throw new Error(`No handler for step: ${this.step}`);

    // For 'confirm', track cycles to prevent infinite loops
    if (this.step === "confirm") {
      this.cycleCount++;
      if (this.cycleCount >= StepMachine.MAX_CYCLES) {
        return {
          reply: "Ok, vou pedir ajuda do time para revisar. Alguém te retorna logo!",
          nextStep: "done",
          draft: this.draft,
        };
      }
    }

    const result = await handler(input, this.draft, this.ctx);
    result.reply = appendBackHint(result.reply);
    this.step = result.nextStep;
    this.draft = { ...this.draft, ...result.draft };
    return result;
  }
}

function appendBackHint(reply: string) {
  if (!reply || reply.toLowerCase().includes("voltar")) return reply;
  return `${reply}\n\nSe precisar corrigir, escreva *voltar*.`;
}

function promptFor(step: Step) {
  const prompts: Record<Step, string> = {
    ask_release_format: "É *single* ou *álbum/EP*?",
    ask_album_track_count: "Quantas faixas vão entrar neste envio?",
    ask_title: "Qual o nome da música?",
    ask_artists: "Quais artistas participam? Manda na ordem, separados por vírgula.",
    ask_producers: "Quem produziu a música?",
    ask_producer_position: "Em que posição o produtor entra nos créditos?",
    ask_genres: "Quais os gêneros da música? Pode escolher até 2.",
    ask_date: "Qual a data de lançamento?",
    ask_audio: "Agora manda o áudio da música.",
    ask_cover: "Agora manda a capa como arquivo/documento.",
    confirm: "Confere os dados e responda SIM se estiver certo.",
    done: "",
  };
  return prompts[step];
}
