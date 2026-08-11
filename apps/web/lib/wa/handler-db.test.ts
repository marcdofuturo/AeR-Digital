import { describe, expect, it, vi } from "vitest";

const insertPayloads: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      return {
        insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          if (table === "releases" && !Array.isArray(payload)) {
            insertPayloads.push(payload);
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({ data: { id: "release-1" }, error: null }),
              }),
            };
          }

          if (table === "tracks") {
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({ data: { id: "track-1" }, error: null }),
              }),
            };
          }

          return {
            then(resolve: (value: { error: null }) => void) {
              resolve({ error: null });
            },
          };
        },
      };
    },
  })),
}));

describe("createHandlerDB", () => {
  it("creates WhatsApp releases directly in analysis", async () => {
    const { createHandlerDB } = await import("./handler-db");
    const db = createHandlerDB();

    await db.createRelease({
      tenantId: "tenant-1",
      title: "Acordei feliz",
      releaseDate: "2026-09-01",
      genres: ["Funk"],
      audioUrl: "received",
      coverUrl: "received",
      participants: [],
      producers: [],
    });

    expect(insertPayloads[0]).toMatchObject({ stage: "em_analise" });
  });
});
