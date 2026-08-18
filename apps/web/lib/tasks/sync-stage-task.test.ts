import { describe, expect, it, vi } from "vitest";
import { stageTaskDefinition, syncReleaseStageTask } from "./sync-stage-task";

describe("stage task synchronization", () => {
  it("defines one deterministic task for every active release stage", () => {
    expect(stageTaskDefinition("em_analise")).toMatchObject({ kind: "stage:em_analise", priority: "alta" });
    expect(stageTaskDefinition("registrar_obra")).toMatchObject({ kind: "stage:registrar_obra", priority: "media" });
    expect(stageTaskDefinition("pronto_p_distribuir")).toMatchObject({ kind: "stage:pronto_p_distribuir", priority: "alta" });
    expect(stageTaskDefinition("arquivado")).toBeNull();
  });

  it("completes prior stage tasks and idempotently upserts the current one", async () => {
    const completionResult = Promise.resolve({ error: null });
    const inFilter = vi.fn(() => completionResult);
    const secondEq = vi.fn(() => ({ in: inFilter }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ update, upsert })) };

    await syncReleaseStageTask(client as never, {
      tenantId: "tenant-1",
      releaseId: "release-1",
      stage: "registrar_obra",
    });

    expect(inFilter).toHaveBeenCalledWith(
      "kind",
      expect.not.arrayContaining(["stage:registrar_obra"]),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        release_id: "release-1",
        kind: "stage:registrar_obra",
        status: "aberta",
        auto_generated: true,
      }),
      { onConflict: "tenant_id,release_id,kind" },
    );
  });
});
