// ─── Prompt 5 — CRM core tests ─────────────────────────────
import { describe, it, expect } from "vitest";
import {
  organizeKanban, formatDaysInStage, deadlineColor,
  validateSplitTotal, redistributeRemainder,
  computePipelineStats, taskPriorityColor, KANBAN_STAGES,
} from "./crm";
import type { KanbanCard, SplitEditorLine } from "./crm";

describe("Kanban", () => {
  const mockCards: KanbanCard[] = [
    { id: "1", title: "Test Song", artists: ["A"], releaseDate: "2027-06-01", stage: "em_analise", progress: 1, authorizationPending: "0/2", daysInStage: 2, urgent: false },
    { id: "2", title: "Another", artists: ["B"], releaseDate: "2027-03-15", stage: "registrar_obra", progress: 4, authorizationPending: "2/2", daysInStage: 12, urgent: true },
    { id: "3", title: "Archive", artists: ["C"], releaseDate: "2026-01-01", stage: "arquivado", progress: 5, authorizationPending: "2/2", daysInStage: 90, urgent: false },
  ];

  it("organizes cards into correct columns", () => {
    const columns = organizeKanban(mockCards);
    expect(columns).toHaveLength(KANBAN_STAGES.length);
    const emAnalise = columns.find(c => c.stage === "em_analise")!;
    expect(emAnalise.cards).toHaveLength(1);
    expect(emAnalise.cards[0]!.title).toBe("Test Song");
  });

  it("empty stages have empty card arrays", () => {
    const columns = organizeKanban([]);
    expect(columns.every(c => c.cards.length === 0)).toBe(true);
  });

  it("formatDaysInStage handles 0, 1, n", () => {
    expect(formatDaysInStage(0)).toBe("hoje");
    expect(formatDaysInStage(1)).toBe("1 dia");
    expect(formatDaysInStage(5)).toBe("5 dias");
  });

  it("deadlineColor: green >14d, amber 7-14d, red <7d", () => {
    const future30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]!;
    const future10 = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0]!;
    const future3 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]!;

    expect(deadlineColor(future30)).toBe("green");
    expect(deadlineColor(future10)).toBe("amber");
    expect(deadlineColor(future3)).toBe("red");
  });
});

describe("Splits Editor", () => {
  const validLines: SplitEditorLine[] = [
    { id: "1", name: "A", holder_type: "artist", role_label: "Primary", bps100: 2500, is_override: false },
    { id: "2", name: "B", holder_type: "artist", role_label: "Primary", bps100: 2500, is_override: false },
    { id: "3", name: "Label", holder_type: "label", role_label: "Selo", bps100: 5000, is_override: false },
  ];

  it("validates total equals 10000", () => {
    expect(validateSplitTotal(validLines).valid).toBe(true);
    expect(validateSplitTotal(validLines).total).toBe(10_000);
  });

  it("detects invalid totals", () => {
    const invalid = [...validLines];
    invalid[0] = { ...invalid[0]!, bps100: 3000 };
    const { valid, total, delta } = validateSplitTotal(invalid);
    expect(valid).toBe(false);
    expect(total).toBe(10_500);
    expect(delta).toBe(-500);
  });

  it("redistributeRemainder adds delta to largest", () => {
    const lines: SplitEditorLine[] = [
      { id: "1", name: "A", holder_type: "artist", role_label: "X", bps100: 3333, is_override: false },
      { id: "2", name: "B", holder_type: "artist", role_label: "Y", bps100: 3333, is_override: false },
      { id: "3", name: "C", holder_type: "artist", role_label: "Z", bps100: 3333, is_override: false },
    ];
    const result = redistributeRemainder(lines);
    const sum = result.reduce((s, l) => s + l.bps100, 0);
    expect(sum).toBe(10_000);
    // One line should be 3334
    expect(result.some(l => l.bps100 === 3334)).toBe(true);
  });
});

describe("Dashboard", () => {
  it("computePipelineStats aggregates correctly", () => {
    const rows = [
      { stage: "em_analise", total: 5, dias_medio: 2.5 },
      { stage: "registrar_obra", total: 3, dias_medio: 15.0 },
    ];
    const stats = computePipelineStats(rows);
    expect(stats.total).toBe(8);
    expect(stats.byStage["em_analise"]).toBe(5);
    expect(stats.avgDaysInStage["registrar_obra"]).toBe(15);
  });
});

describe("Tasks", () => {
  it("taskPriorityColor returns correct colors", () => {
    expect(taskPriorityColor("alta")).toBe("red");
    expect(taskPriorityColor("media")).toBe("amber");
    expect(taskPriorityColor("baixa")).toBe("gray");
  });
});

describe("KANBAN_STAGES", () => {
  it("has the operational registration pipeline in order", () => {
    const ids = KANBAN_STAGES.map(s => s.id);
    expect(ids).toEqual([
      "em_analise",
      "autorizacao_pendente",
      "registrar_obra",
      "registrar_fonograma",
      "pronto_p_distribuir",
      "distribuido",
      "situacao_ecad",
      "concluido",
      "arquivado",
    ]);
  });
});
