import type { SupabaseClient } from "@supabase/supabase-js";
import { requireMembership } from "@/lib/auth/require-membership";

type ActivityInput = {
  tenantId: string;
  entityType: "release" | "track" | "artist" | "authorization" | "registration" | "split";
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

export async function recordUserActivity(client: SupabaseClient, input: ActivityInput) {
  const membership = await requireMembership();
  if (membership.tenantId !== input.tenantId) {
    throw new Error("Sem permissao para registrar atividade");
  }

  const { error } = await client.from("activity_log").insert({
    tenant_id: input.tenantId,
    actor_type: "user",
    actor_id: membership.userId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    before: sanitizeActivityValue(input.before),
    after: sanitizeActivityValue(input.after),
  });
  if (error) throw new Error("Falha ao registrar atividade");
}

function sanitizeActivityValue(value: unknown, key = ""): unknown {
  if (value == null) return null;
  if (key.endsWith("_url")) return "arquivo configurado";
  if (key === "lyrics_transcript") return "transcrição armazenada";
  if (Array.isArray(value)) return value.map((entry) => sanitizeActivityValue(entry));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeActivityValue(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value === "string") return value.slice(0, 500);
  if (["number", "boolean"].includes(typeof value)) return value;
  return String(value).slice(0, 500);
}
