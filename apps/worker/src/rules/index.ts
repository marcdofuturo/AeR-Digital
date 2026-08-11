// ─── Business Rules Engine — Prompt 5.8 ─────────────────────
// Typed, testable functions — no n8n. Deployed as BullMQ jobs.

import type { Queue } from "bullmq";

export interface RuleEvent {
  type: string;
  tenantId: string;
  releaseId?: string;
  trackId?: string;
  data?: Record<string, unknown>;
}

export interface RuleContext {
  tasks: {
    createMany(tenantId: string, releaseId: string, tasks: Array<{ title: string; kind: string; dueInDays: number }>): Promise<void>;
    upsertCritical(tenantId: string, releaseId: string, message: string): Promise<void>;
  };
  notifications: {
    notifyAR(tenantId: string, message: string): Promise<void>;
  };
  releases: {
    dueWithin(days: number, stages: string[]): Promise<Array<{ id: string; tenantId: string; title: string; releaseDate: string }>>;
  };
  registrations: {
    overdueAfterRelease(days: number, kind: string): Promise<Array<{ trackId: string; tenantId: string }>>;
  };
}

export interface Rule {
  id: string;
  on: string;
  when?: (event: RuleEvent) => boolean;
  run: (event: RuleEvent, ctx: RuleContext) => Promise<void>;
}

export const RULES: Rule[] = [
  {
    id: "cria-tarefas-pos-autorizacao",
    on: "release.stage_changed",
    when: e => e.data?.to === "registrar_obra",
    run: async (e, ctx) => {
      await ctx.tasks.createMany(e.tenantId, e.releaseId!, [
        { title: "Subir na distribuidora", kind: "upload", dueInDays: 2 },
        { title: "Cadastrar obra no ECAD", kind: "reg_obra", dueInDays: 7 },
        { title: "Cadastrar fonograma", kind: "reg_fono", dueInDays: 7 },
      ]);
    },
  },
  {
    id: "alerta-prazo-lancamento",
    on: "cron.daily",
    run: async (_e, ctx) => {
      const risco = await ctx.releases.dueWithin(7, ["em_analise", "autorizacao_pendente"]);
      for (const r of risco) {
        await ctx.tasks.upsertCritical(r.tenantId, r.id, `Lançamento "${r.title}" em risco — ${r.releaseDate}`);
        await ctx.notifications.notifyAR(r.tenantId, `⚠️ Lançamento "${r.title}" está a menos de 7 dias da data (${r.releaseDate}) e ainda está em "${r.title}"`);
      }
    },
  },
  {
    id: "obra-nao-registrada-30d",
    on: "cron.daily",
    run: async (_e, ctx) => {
      const pendentes = await ctx.registrations.overdueAfterRelease(30, "obra_ecad");
      for (const p of pendentes) {
        await ctx.notifications.notifyAR(p.tenantId, `💰 Obra não registrada há 30+ dias — lançamento em risco de receita.`);
      }
    },
  },
];

/** Dispatch an event to all matching rules */
export async function dispatch(event: RuleEvent, ctx: RuleContext): Promise<void> {
  for (const rule of RULES) {
    if (rule.on === event.type && (!rule.when || rule.when(event))) {
      await rule.run(event, ctx);
    }
  }
}
