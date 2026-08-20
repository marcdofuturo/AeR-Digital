import { describe, expect, it, vi } from "vitest";

const { requireMembership } = vi.hoisted(() => ({
  requireMembership: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    role: "ar",
  }),
}));

vi.mock("@/lib/auth/require-membership", () => ({ requireMembership }));

import { recordUserActivity } from "./log";

describe("recordUserActivity", () => {
  it("stores actor and change details without storage URLs or full transcripts", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ insert })) };

    await recordUserActivity(client as never, {
      tenantId: "tenant-1",
      entityType: "track",
      entityId: "track-1",
      action: "Áudio da faixa substituído",
      before: {
        audio_url: "https://project.supabase.co/storage/old.wav",
        lyrics_transcript: "letra anterior inteira",
      },
      after: {
        audio_url: "https://project.supabase.co/storage/new.wav",
        lyrics_transcript: null,
      },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        actor_type: "user",
        actor_id: "user-1",
        entity_type: "track",
        entity_id: "track-1",
        action: "Áudio da faixa substituído",
        before: {
          audio_url: "arquivo configurado",
          lyrics_transcript: "transcrição armazenada",
        },
        after: {
          audio_url: "arquivo configurado",
          lyrics_transcript: null,
        },
      }),
    );
    expect(JSON.stringify(insert.mock.calls)).not.toContain("supabase.co");
    expect(JSON.stringify(insert.mock.calls)).not.toContain("letra anterior inteira");
  });

  it("rejects an activity attributed to another tenant", async () => {
    const insert = vi.fn();
    const client = { from: vi.fn(() => ({ insert })) };

    await expect(
      recordUserActivity(client as never, {
        tenantId: "tenant-2",
        entityType: "release",
        entityId: "release-1",
        action: "Teste",
        after: {},
      }),
    ).rejects.toThrow("Sem permissao");
    expect(insert).not.toHaveBeenCalled();
  });
});
