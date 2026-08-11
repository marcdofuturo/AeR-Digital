import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert.mockReturnValue({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("saveDigitalSplitSettings", () => {
  beforeEach(() => {
    mockUpsert.mockClear();
  });

  it("saves fixed label percentage in bps100", async () => {
    const formData = new FormData();
    formData.set("digital_mode", "fixo");
    formData.set("digital_label_percent", "30");

    const { saveDigitalSplitSettings } = await import("./actions");
    await saveDigitalSplitSettings(formData);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        digital_mode: "fixo",
        digital_label_bps100: 3000,
      }),
      { onConflict: "tenant_id" },
    );
  });

  it("saves automatic pro-rata mode with label participating in the 100 percent pool", async () => {
    const formData = new FormData();
    formData.set("digital_mode", "pro_rata");

    const { saveDigitalSplitSettings } = await import("./actions");
    await saveDigitalSplitSettings(formData);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        digital_mode: "pro_rata",
        digital_label_bps100: 0,
      }),
      { onConflict: "tenant_id" },
    );
  });
});
