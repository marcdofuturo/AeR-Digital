import { describe, expect, it, vi } from "vitest";
import { enqueuePresentationJob } from "./jobs";

describe("enqueuePresentationJob", () => {
  it("persists an authenticated queued job", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };

    await expect(enqueuePresentationJob(client as never, {
      tenantId: "tenant-1",
      releaseId: "release-1",
      trackId: "track-1",
      userId: "user-1",
      userGuidance: "foco no refrao",
    })).resolves.toEqual({ id: "job-1" });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: "tenant-1",
      release_id: "release-1",
      track_id: "track-1",
      created_by: "user-1",
      status: "queued",
    }));
  });
});
