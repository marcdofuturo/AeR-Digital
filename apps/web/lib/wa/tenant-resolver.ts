// ─── Tenant Resolution for WhatsApp Webhook ──────────────────
// R6: Route by whatsapp_identities (known phone) or intake_code (#A7K9)
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsappPhone, whatsappPhoneVariants } from "@/lib/wa/phone";

export interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
}

/**
 * Try to find a tenant by known WhatsApp phone number.
 * Returns null if this phone hasn't been seen before.
 */
export async function resolveTenantByPhone(phone: string): Promise<TenantInfo | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("whatsapp_identities")
    .select("tenant_id, tenants!inner(name)")
    .in("phone_e164", whatsappPhoneVariants(phone))
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const tenantName = Array.isArray(data.tenants)
    ? (data.tenants[0] as { name: string } | undefined)?.name
    : (data.tenants as { name: string } | null)?.name;

  return {
    tenant_id: data.tenant_id,
    tenant_name: tenantName ?? "A&R",
  };
}

/**
 * Try to find a tenant by intake code (e.g. "#A7K9" → code "A7K9").
 */
export async function resolveTenantByCode(code: string): Promise<TenantInfo | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("intake_code", code.toUpperCase())
    .maybeSingle();

  if (!data) return null;

  return {
    tenant_id: data.id,
    tenant_name: data.name,
  };
}

/**
 * Record a new WhatsApp identity so future messages auto-route.
 */
export async function registerIdentity(
  phone: string,
  tenantId: string,
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from("whatsapp_identities").upsert(
    {
      phone_e164: normalizeWhatsappPhone(phone),
      tenant_id: tenantId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "phone_e164" },
  );
}

export async function forgetTenantByPhone(phone: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("whatsapp_identities")
    .delete()
    .in("phone_e164", whatsappPhoneVariants(phone));
}
