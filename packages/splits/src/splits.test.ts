import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeObra } from "./obra";
import { computeFonograma } from "./fonograma";
import { computeDigital } from "./digital";
import { distributeByWeight, distributeEvenly, reconcile, fmt, digitalWeight } from "./math";
import type { Participant, DigitalConfig, SplitLine } from "./types";

// ─── Helpers ────────────────────────────────────────────────

function makeP(
  id: string,
  name: string,
  pos: number,
  role: "primary" | "featuring",
  overrides?: Partial<Participant>,
): Participant {
  return {
    id,
    stage_name: name,
    position: pos,
    billing_role: role,
    is_composer: true,
    is_producer: false,
    is_performer: true,
    hidden_from_billing: false,
    ...overrides,
  };
}

function sum(lines: SplitLine[]): number {
  return lines.reduce((s, l) => s + l.bps100, 0);
}

// ─── 1. SNAPSHOT: Caso SE SOLTA ─────────────────────────────

describe("SE SOLTA snapshot", () => {
  const mcGh = makeP("gh", "MC GH", 1, "primary");
  const mcJac = makeP("jac", "MC JACARÉ", 2, "primary");
  const mucilon = makeP("muc", "MUCILON", 3, "primary", {
    is_composer: false, // MUCILON é produtor, não compositor (conforme seed)
    is_producer: true,
  });

  const participants = [mcGh, mcJac, mucilon];
  const labelName = "SuperTime Digital";

  it("Obra — todos os participantes entram como autores/compositores", () => {
    const result = computeObra(participants);
    expect(sum(result)).toBe(10_000);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ name: "MC GH", role_label: "Autor/compositor", bps100: 3334 });
    expect(result[1]).toMatchObject({ name: "MC JACARÉ", role_label: "Autor/compositor", bps100: 3333 });
    expect(result[2]).toMatchObject({ name: "MUCILON", role_label: "Autor/compositor", bps100: 3333 });
  });

  it("Fonograma — SuperTime 4170 + GH 2085 + JACARÉ 2085 + MUCILON 1660", () => {
    const result = computeFonograma(participants, labelName);
    expect(sum(result)).toBe(10_000);

    const label = result.find(l => l.holder_type === "label")!;
    // Produtor fonográfico = 4170 (MUCILON é produtor, não intérprete)
    expect(label.role_label).toBe("Produtor fonográfico");
    expect(label.bps100).toBe(4170);

    const gh = result.find(l => l.name === "MC GH")!;
    expect(gh.role_label).toBe("Intérprete");
    expect(gh.bps100).toBe(2085);

    const jac = result.find(l => l.name === "MC JACARÉ")!;
    expect(jac.role_label).toBe("Intérprete");
    expect(jac.bps100).toBe(2085);

    const muc = result.find(l => l.name === "MUCILON")!;
    expect(muc.role_label).toBe("Músico acompanhante");
    expect(muc.bps100).toBe(1660);
  });

  it("Fonograma sem produtor mantem selo em 41,70%", () => {
    const result = computeFonograma([mcGh, mcJac], labelName);
    expect(sum(result)).toBe(10_000);

    const label = result.find(l => l.holder_type === "label")!;
    expect(label.role_label).toBe("Produtor fonográfico");
    expect(label.bps100).toBe(4170);

    const artistTotal = result
      .filter(l => l.holder_type === "artist")
      .reduce((total, line) => total + line.bps100, 0);
    expect(artistTotal).toBe(5830);
  });

  it("Digital (pro_rata) — 2500 cada (3 artistas + selo)", () => {
    const cfg: DigitalConfig = {
      mode: "pro_rata",
      label_bps100: 2500,
      weight_primary: 100,
      weight_featuring: 100,
    };
    const result = computeDigital(participants, cfg, labelName);
    expect(sum(result)).toBe(10_000);
    expect(result).toHaveLength(4);
    // Todos devem ter 2500 (4 participantes × peso igual)
    result.forEach(l => expect(l.bps100).toBe(2500));
    expect(result.some(l => l.holder_type === "label")).toBe(true);
  });
});

// ─── 2. TABELA COMBINATÓRIA ──────────────────────────────────

describe("Combinatorial table — sum === 10000, no negatives", () => {
  const sizes = [1, 2, 3, 4, 5, 7, 11, 13];
  const producerOpts = [false, true];
  const featOpts = [false, true];
  const digitalModes: Array<{ mode: DigitalConfig["mode"]; label_bps100: number }> = [
    { mode: "pro_rata", label_bps100: 2500 },
    { mode: "fixo", label_bps100: 2500 },
    { mode: "fixo", label_bps100: 1000 },
    { mode: "fixo", label_bps100: 9000 },
  ];

  for (const size of sizes) {
    for (const hasProducer of producerOpts) {
      for (const hasFeaturing of featOpts) {
        for (const digMode of digitalModes) {
          const label = `${size}p ${hasProducer ? "c/prod" : "s/prod"} ${hasFeaturing ? "c/feat" : "s/feat"} ${digMode.mode}${digMode.mode === "fixo" ? "/" + digMode.label_bps100 : ""}`;

          it(label, () => {
            // Ensure at least one composer — obra requires it
            const ps = Array.from({ length: size }, (_, i) => {
              const isProducer = hasProducer && i === size - 1;
              // The producer can't be the ONLY composer-less person if they're the only person
              const isComposer = !(hasProducer && i === size - 1 && size > 1);
              return makeP(`a${i}`, `Artist${i}`, i + 1, hasFeaturing && i >= 4 ? "featuring" : "primary", {
                is_producer: isProducer,
                is_composer: isComposer,
              });
            });

            // Obra
            const obra = computeObra(ps);
            expect(sum(obra), `Obra sum failed for ${label}`).toBe(10_000);
            obra.forEach(l => expect(l.bps100, `Obra negative for ${label}`).toBeGreaterThanOrEqual(0));

            // Fonograma
            const fono = computeFonograma(ps, "TestLabel");
            expect(sum(fono), `Fono sum failed for ${label}`).toBe(10_000);
            fono.forEach(l => expect(l.bps100, `Fono negative for ${label}`).toBeGreaterThanOrEqual(0));

            // Digital
            const cfg: DigitalConfig = {
              mode: digMode.mode,
              label_bps100: digMode.label_bps100,
              weight_primary: 100,
              weight_featuring: 100,
            };
            const dig = computeDigital(ps, cfg, "TestLabel");
            expect(sum(dig), `Digital sum failed for ${label}`).toBe(10_000);
            dig.forEach(l => expect(l.bps100, `Digital negative for ${label}`).toBeGreaterThanOrEqual(0));
          });
        }
      }
    }
  }
});

// ─── 3. PROPERTY-BASED (fast-check) ──────────────────────────

describe("Property-based — fast-check 1000 runs", () => {
  /** Generate a valid participant */
  const participantArb = fc.record({
    id: fc.uuid(),
    stage_name: fc.string({ minLength: 2, maxLength: 40 }),
    position: fc.integer({ min: 1, max: 20 }),
    billing_role: fc.constantFrom("primary" as const, "featuring" as const),
    is_composer: fc.boolean(),
    is_producer: fc.boolean(),
    is_performer: fc.boolean(),
    hidden_from_billing: fc.boolean(),
  });

  /** Generate 1–20 participants */
  const participantsArb = fc.array(participantArb, { minLength: 1, maxLength: 20 }).filter(ps => {
    // At least one composer for obra
    return ps.some(p => p.is_composer);
  });

  const configArb = fc.record({
    mode: fc.constantFrom("pro_rata" as const, "fixo" as const),
    label_bps100: fc.integer({ min: 0, max: 10_000 }),
    weight_primary: fc.integer({ min: 1, max: 200 }),
    weight_featuring: fc.integer({ min: 1, max: 200 }),
  });

  it("Obra always sums to 10000 with no negatives", () => {
    fc.assert(
      fc.property(participantsArb, ps => {
        const result = computeObra(ps);
        return result.every(l => l.bps100 >= 0) && sum(result) === 10_000;
      }),
      { numRuns: 1000 },
    );
  }, 30_000);

  it("Fonograma always sums to 10000 with no negatives", () => {
    fc.assert(
      fc.property(participantsArb, fc.string({ minLength: 2, maxLength: 40 }), (ps, labelName) => {
        const result = computeFonograma(ps, labelName);
        return result.every(l => l.bps100 >= 0) && sum(result) === 10_000;
      }),
      { numRuns: 1000 },
    );
  }, 30_000);

  it("Digital always sums to 10000 with no negatives", () => {
    fc.assert(
      fc.property(participantsArb, configArb, fc.string({ minLength: 2, maxLength: 40 }), (ps, cfg, labelName) => {
        const result = computeDigital(ps, cfg, labelName);
        return result.every(l => l.bps100 >= 0) && sum(result) === 10_000;
      }),
      { numRuns: 1000 },
    );
  }, 30_000);
});

// ─── 4. CASOS DE BORDA ──────────────────────────────────────

describe("Edge cases", () => {
  it("3 participants dividing 4170 → [1390, 1390, 1390]", () => {
    const items = [
      { item: "A", w: 1 },
      { item: "B", w: 1 },
      { item: "C", w: 1 },
    ];
    const result = distributeByWeight(items, 4170);
    expect(result.map(r => r.bps100)).toEqual([1390, 1390, 1390]);
  });

  it("7 participants dividing 4170 → sum is exactly 4170", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ item: `p${i}`, w: 1 }));
    const result = distributeByWeight(items, 4170);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(4170);
    // First 5 get floor(4170/7)=595 + 1, last 2 get 595
    // 4170 / 7 = 595.71... floor = 595, rest = 4170 - 7*595 = 4170-4165 = 5
    // So 5 get 596, 2 get 595, sum = 5*596 + 2*595 = 2980 + 1190 = 4170
    expect(result.every(r => r.bps100 === 595 || r.bps100 === 596)).toBe(true);
  });

  it("1 participant dividing 10000 → [10000]", () => {
    const result = distributeEvenly(["solo"], 10_000);
    expect(result[0]!.bps100).toBe(10_000);
    expect(result.reduce((s, r) => s + r.bps100, 0)).toBe(10_000);
  });

  it("Empty participants → obra throws", () => {
    expect(() => computeObra([])).toThrow("Faixa sem autores");
    // Fonograma: sem intérpretes = 10000 para produtor (via reconcile)
    const f = computeFonograma([], "Label");
    expect(sum(f)).toBe(10_000);
    // Digital: sem artistas = 10000 para selo
    const d = computeDigital(
      [],
      { mode: "pro_rata", label_bps100: 2500, weight_primary: 100, weight_featuring: 100 },
      "Label",
    );
    expect(sum(d)).toBe(10_000);
  });

  it("Fonograma sem intérpretes — produtor + músico dividem 10000 via reconcile", () => {
    const ps = [
      makeP("p1", "OnlyProducer", 1, "primary", {
        is_composer: true,
        is_performer: false,
        is_producer: true,
      }),
    ];
    const result = computeFonograma(ps, "LabelX");
    expect(sum(result)).toBe(10_000);
    // 1 produtor, 0 intérpretes:
    // poolProdutor = 4170 + 830 = 5000
    // musico = distributeEvenly(1, 1660) = 1660
    // reconcile(5000 + 1660 = 6660): adds 3340 to max(5000) → produtor=8340, musico=1660
    const label = result.find(l => l.holder_type === "label")!;
    expect(label.bps100).toBe(8340);
    const musico = result.find(l => l.role_label === "Músico acompanhante")!;
    expect(musico.bps100).toBe(1660);
  });
});

// ─── 5. HIDDEN_FROM_BILLING ──────────────────────────────────

describe("hidden_from_billing", () => {
  it("Hidden participant appears in fonograma as Músico but NOT in digital", () => {
    const visible = makeP("a", "Visible", 1, "primary");
    const hidden = makeP("h", "Hidden", 2, "primary", {
      hidden_from_billing: true,
      is_producer: true,
      is_composer: false,
    });
    const labelName = "Label";

    const fono = computeFonograma([visible, hidden], labelName);
    // Hidden ainda aparece como músico no fonograma
    const musico = fono.find(l => l.name === "Hidden");
    expect(musico).toBeDefined();
    expect(musico!.role_label).toBe("Músico acompanhante");

    const dig = computeDigital(
      [visible, hidden],
      { mode: "pro_rata", label_bps100: 2500, weight_primary: 100, weight_featuring: 100 },
      labelName,
    );
    // Hidden NÃO aparece no digital
    expect(dig.find(l => l.name === "Hidden")).toBeUndefined();
    expect(sum(dig)).toBe(10_000);
  });
});

// ─── 6. FEATURING PESOS ──────────────────────────────────────

describe("Featuring weight", () => {
  it("featuring participant gets different weight in digital", () => {
    const prim = makeP("p1", "Primary1", 1, "primary");
    const prim2 = makeP("p2", "Primary2", 2, "primary");
    const feat = makeP("f1", "Featuring1", 5, "featuring", {
      is_composer: true,
      is_producer: false,
      is_performer: true,
    });

    const cfg: DigitalConfig = {
      mode: "fixo",
      label_bps100: 0,
      weight_primary: 100,
      weight_featuring: 50, // feat tem metade do peso
    };

    const result = computeDigital([prim, prim2, feat], cfg, "TestLabel");
    expect(sum(result)).toBe(10_000);
    // feat should have roughly half of what primaries get
    const featLine = result.find(l => l.name === "Featuring1")!;
    const primLine = result.find(l => l.name === "Primary1")!;
    expect(featLine.bps100).toBeLessThan(primLine.bps100);
  });
});

// ─── 7. RECONCILE ────────────────────────────────────────────

describe("reconcile", () => {
  it("passes through when already 10000", () => {
    const lines: SplitLine[] = [
      { holder_type: "artist", role_label: "X", name: "A", bps100: 5000 },
      { holder_type: "artist", role_label: "Y", name: "B", bps100: 5000 },
    ];
    expect(reconcile(lines)).toEqual(lines);
  });

  it("adjusts max when total is off by +1", () => {
    const lines: SplitLine[] = [
      { holder_type: "artist", role_label: "X", name: "A", bps100: 3333 },
      { holder_type: "artist", role_label: "Y", name: "B", bps100: 3333 },
      { holder_type: "artist", role_label: "Z", name: "C", bps100: 3333 },
    ];
    const r = reconcile(lines);
    expect(sum(r)).toBe(10_000);
    // The largest (all 3333) gets the +1
    expect(r.some(l => l.bps100 === 3334)).toBe(true);
  });

  it("throws SplitError when a line is negative", () => {
    // reconcile will throw if any line is negative AFTER adjustment.
    // sum = 4900. max=5000. 5000 + (10000-4900) = 5000 + 5100 = 10100
    // After: 10100 + (-100) = 10000. No negative. But then sum=10000, return.
    // Actually: sum=10000 already, it passes through. Let's test the throw:
    const lines: SplitLine[] = [
      { holder_type: "artist", role_label: "X", name: "A", bps100: 10000 },
      { holder_type: "artist", role_label: "Y", name: "B", bps100: -5000 },
    ];
    // sum = 5000. max=10000. +5000 = 15000. Now we have 15000 + (-5000) = 10000.
    // Negative check: some(l => l.bps100 < 0) is true (B = -5000). Throws!
    expect(() => reconcile([...lines])).toThrow("Linha negativa detectada na reconciliação");
  });
});

// ─── 8. FMT ──────────────────────────────────────────────────

describe("fmt", () => {
  it("formats bps100 as Brazilian percentage", () => {
    expect(fmt(5000)).toBe("50,00%");
    expect(fmt(4170)).toBe("41,70%");
    expect(fmt(1660)).toBe("16,60%");
    expect(fmt(10_000)).toBe("100,00%");
    expect(fmt(2500)).toBe("25,00%");
    expect(fmt(1)).toBe("0,01%");
    expect(fmt(0)).toBe("0,00%");
  });
});
