// ─── WhatsApp Session Persistence (Supabase) ─────────────────
import { createAdminClient } from "@/lib/supabase/admin";
import type { Draft } from "@ar/wa/types";

export interface SessionRow {
  id: string;
  step: string;
  draft: Draft;
}

/**
 * Load the active session for a phone + tenant combo.
 * Only returns sessions that haven't expired (the unique index enforces
 * at most one active session per phone_e164).
 */
export async function loadSession(
  phone: string,
  tenantId: string,
): Promise<SessionRow | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("id, step, draft")
    .eq("phone_e164", phone)
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    step: data.step,
    draft: (data.draft ?? {}) as Draft,
  };
}

/**
 * Create or update a session. Uses ON CONFLICT on the unique index
 * (phone_e164 WHERE expires_at > now()) so at most one active session
 * exists per phone.
 */
export async function saveSession(
  phone: string,
  tenantId: string,
  step: string,
  draft: Draft,
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Try to load existing active session
  const { data: existing } = await supabase
    .from("whatsapp_sessions")
    .select("id")
    .eq("phone_e164", phone)
    .eq("tenant_id", tenantId)
    .gt("expires_at", now)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("whatsapp_sessions")
      .update({
        step,
        draft,
        last_message_at: now,
      })
      .eq("id", existing.id);
  } else {
    // Insert new session (72h expiry is the DB default)
    await supabase.from("whatsapp_sessions").insert({
      tenant_id: tenantId,
      phone_e164: phone,
      step,
      draft,
      last_message_at: now,
    });
  }
}

/**
 * Expire all sessions for a phone (called when flow completes).
 */
export async function expireSession(phone: string, tenantId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("whatsapp_sessions")
    .update({ expires_at: new Date().toISOString() })
    .eq("phone_e164", phone)
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString());
}
