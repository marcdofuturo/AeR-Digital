import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const mutations: Array<{ table: string; values: Record<string, unknown> }> = [];
const selections: Array<{ table: string; filters: Record<string, unknown> }> = [];

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("@/lib/activity/log", () => ({ recordUserActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      return {
        select() {
          const selection = { table, filters: {} as Record<string, unknown> };
          selections.push(selection);
          const result = {
            eq(column: string, value: unknown) {
              selection.filters[column] = value;
              return result;
            },
            single: async () => ({ data: { id: "track-1", audio_url: null }, error: null }),
          };
          return result;
        },
        upsert(values: Record<string, unknown>) {
          mutations.push({ table, values });
          return { select: () => ({ single: async () => ({ error: null }) }) };
        },
        update(values: Record<string, unknown>) {
          mutations.push({ table, values });
          const result = { error: null, eq: () => result };
          return result;
        },
      };
    },
  })),
}));

describe("saveRegistrationStatus", () => {
  beforeEach(() => {
    mutations.length = 0;
    selections.length = 0;
    requireMembership.mockResolvedValue({ tenantId: "tenant-1", role: "owner" });
  });

  it("synchronizes distributor and UPC with the release", async () => {
    const formData = registrationForm("distribuicao");
    formData.set("entity", "Audiolink Brasil");
    formData.set("external_id", "789123456789");

    const { saveRegistrationStatus } = await import("./actions");
    await saveRegistrationStatus(formData);

    expect(selections).toContainEqual({
      table: "tracks",
      filters: { tenant_id: "tenant-1", release_id: "release-1", id: "track-1" },
    });

    expect(mutations).toContainEqual({
      table: "releases",
      values: { distributor: "Audiolink Brasil", upc: "789123456789" },
    });
  });

  it("synchronizes phonogram ISRC with the track", async () => {
    const formData = registrationForm("fonograma_ecad");
    formData.set("external_id", "BR-AAA-26-00001");

    const { saveRegistrationStatus } = await import("./actions");
    await saveRegistrationStatus(formData);

    expect(mutations).toContainEqual({
      table: "tracks",
      values: { isrc: "BR-AAA-26-00001" },
    });
  });
});

describe("saveTrackOverview", () => {
  beforeEach(() => {
    mutations.length = 0;
    selections.length = 0;
    requireMembership.mockResolvedValue({ tenantId: "tenant-1", role: "owner" });
  });

  it("validates that the edited track belongs to the release", async () => {
    const formData = new FormData();
    formData.set("release_id", "release-1");
    formData.set("track_id", "track-1");
    formData.set("title", "Faixa Teste");
    formData.set("audio_duration", "02:05");

    const { saveTrackOverview } = await import("./actions");
    await saveTrackOverview(formData);

    expect(selections).toContainEqual({
      table: "tracks",
      filters: { tenant_id: "tenant-1", release_id: "release-1", id: "track-1" },
    });
  });
});

function registrationForm(kind: string) {
  const formData = new FormData();
  formData.set("release_id", "release-1");
  formData.set("track_id", "track-1");
  formData.set("kind", kind);
  formData.set("status", "pendente");
  return formData;
}
