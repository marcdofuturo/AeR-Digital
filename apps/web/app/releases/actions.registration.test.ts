import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMembership = vi.fn();
const mutations: Array<{ table: string; values: Record<string, unknown> }> = [];
const selections: Array<{ table: string; filters: Record<string, unknown> }> = [];
const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));
vi.mock("@/lib/activity/log", () => ({ recordUserActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });
      return Promise.resolve({ error: null });
    },
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
    rpcs.length = 0;
    requireMembership.mockResolvedValue({ tenantId: "tenant-1", role: "owner" });
  });

  it("synchronizes distributor and UPC with the release plus ISRC with the track", async () => {
    const formData = registrationForm("distribuicao");
    formData.set("entity", "Audiolink Brasil");
    formData.set("external_id", "789123456789");
    formData.set("distribution_isrc", "BR-AAA-26-00001");

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
    expect(mutations).toContainEqual({
      table: "tracks",
      values: { isrc: "BR-AAA-26-00001" },
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

describe("saveSplitAllocations", () => {
  beforeEach(() => {
    mutations.length = 0;
    selections.length = 0;
    rpcs.length = 0;
    requireMembership.mockResolvedValue({ tenantId: "tenant-1", role: "owner" });
  });

  it("replaces a complete internal allocation through the scoped RPC", async () => {
    const formData = new FormData();
    formData.set("release_id", "release-1");
    formData.set("track_id", "track-1");
    formData.set("scope", "digital");
    formData.set("parent_artist_id", "parent-1");
    formData.set("allocation_count", "2");
    formData.set("beneficiary_artist_id_0", "artist-a");
    formData.set("allocation_percent_0", "10");
    formData.set("beneficiary_artist_id_1", "artist-b");
    formData.set("allocation_percent_1", "90");

    const { saveSplitAllocations } = await import("./actions");
    await saveSplitAllocations(formData);

    expect(rpcs).toContainEqual({
      name: "replace_split_allocations",
      args: {
        p_tenant_id: "tenant-1",
        p_track_id: "track-1",
        p_scope: "digital",
        p_parent_artist_id: "parent-1",
        p_allocations: [
          { beneficiary_artist_id: "artist-a", bps100: 1000 },
          { beneficiary_artist_id: "artist-b", bps100: 9000 },
        ],
      },
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
