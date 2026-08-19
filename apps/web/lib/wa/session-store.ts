// ─── WhatsApp Session Persistence (Supabase) ─────────────────
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsappPhone, whatsappPhoneVariants } from "@/lib/wa/phone";
import type { Draft } from "@ar/wa/types";

export interface SessionRow {
  id: string;
  tenantId: string;
  phone: string;
  step: string;
  draft: Draft;
}

type RawSessionRow = {
  id: string;
  tenant_id: string;
  phone_e164: string;
  step: string;
  draft: unknown;
};

function mapSession(data: RawSessionRow): SessionRow {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    phone: data.phone_e164,
    step: data.step,
    draft: (data.draft ?? {}) as Draft,
  };
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
    .select("id, tenant_id, phone_e164, step, draft")
    .in("phone_e164", whatsappPhoneVariants(phone))
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return mapSession(data);
}

export async function loadSessionById(sessionId: string): Promise<SessionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("id, tenant_id, phone_e164, step, draft")
    .eq("id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error("Falha ao carregar a sess\u00e3o de envio.");
  return data ? mapSession(data) : null;
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
): Promise<SessionRow> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const normalizedPhone = normalizeWhatsappPhone(phone);

  // Try to load existing active session
  const { data: existing } = await supabase
    .from("whatsapp_sessions")
    .select("id")
    .in("phone_e164", whatsappPhoneVariants(phone))
    .eq("tenant_id", tenantId)
    .gt("expires_at", now)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("whatsapp_sessions")
      .update({
        step,
        draft,
        last_message_at: now,
      })
      .eq("id", existing.id)
      .select("id, tenant_id, phone_e164, step, draft")
      .single();
    if (error || !data) throw new Error("Falha ao atualizar a sess\u00e3o do WhatsApp.");
    return mapSession(data);
  }

  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .insert({
      tenant_id: tenantId,
      phone_e164: normalizedPhone,
      step,
      draft,
      last_message_at: now,
    })
    .select("id, tenant_id, phone_e164, step, draft")
    .single();
  if (error || !data) throw new Error("Falha ao criar a sess\u00e3o do WhatsApp.");
  return mapSession(data);
}

/**
 * Expire all sessions for a phone (called when flow completes).
 */
export async function expireSession(phone: string, tenantId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("whatsapp_sessions")
    .update({ expires_at: new Date().toISOString() })
    .in("phone_e164", whatsappPhoneVariants(phone))
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString());
}

export async function expireAllSessionsForPhone(phone: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("whatsapp_sessions")
    .update({ expires_at: new Date().toISOString() })
    .in("phone_e164", whatsappPhoneVariants(phone))
    .gt("expires_at", new Date().toISOString());
}
