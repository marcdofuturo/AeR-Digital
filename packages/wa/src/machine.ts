// ─── Step Machine — orchestrates the intake flow ─────────────
import type { Step, Draft, HandlerContext, StepResult } from "./types";
import { handlers } from "./handlers";

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
    this.step = result.nextStep;
    this.draft = { ...this.draft, ...result.draft };
    return result;
  }
}
