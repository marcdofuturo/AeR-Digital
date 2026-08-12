import { describe, expect, it } from "vitest";
import { buildAutomaticSplitRows } from "./persist";
import type { Participant } from "@ar/splits";

function participant(id: string, position: number, overrides: Partial<Participant> = {}): Participant {
  return {
    id,
    stage_name: id.toUpperCase(),
    billing_role: "primary",
    position,
    is_composer: true,
    is_producer: false,
    is_performer: true,
    hidden_from_billing: false,
    ...overrides,
  };
}

describe("buildAutomaticSplitRows", () => {
  it("creates obra, fonograma and digital rows that total 10000 per scope", () => {
    const rows = buildAutomaticSplitRows({
      tenantId: "tenant-1",
      trackId: "track-1",
      labelName: "Audiolink Brasil",
      participants: [
        participant("mc-rick", 1),
        participant("prod-1", 2, { is_producer: true, is_performer: false }),
      ],
      settings: { digital_mode: "fixo", digital_label_bps100: 3000 },
    });

    expect(rows.filter((row) => row.scope === "obra")).toHaveLength(2);
    expect(rows.find((row) => row.role_label === "Músico acompanhante")).toBeDefined();

    for (const scope of ["obra", "fonograma", "digital"] as const) {
      expect(rows.filter((row) => row.scope === scope).reduce((sum, row) => sum + row.bps100, 0)).toBe(10_000);
    }
  });
});

