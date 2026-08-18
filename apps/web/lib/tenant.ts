import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";

/**
 * Resolve the current user's tenant ID from their most recent membership.
 * Cached per-request via React cache().
 */
export const getCurrentTenantId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Read tenant_id from app_metadata if stored there, otherwise query memberships
  if (user.app_metadata?.tenant_id) {
    return user.app_metadata.tenant_id as string;
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return membership?.tenant_id ?? null;
});

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  intake_code: string;
  plan: string;
  status: string;
  responsible_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
}

/** Fetch the full tenant row. */
export const getTenant = cache(async (): Promise<Tenant | null> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  return data as Tenant | null;
});

export interface TenantSplitSettings {
  digital_mode: "pro_rata" | "fixo";
  digital_label_bps100: number;
  digital_weight_primary: number;
  digital_weight_featuring: number;
}

/** Fetch the tenant's split configuration. */
export const getTenantSplitSettings = cache(async (): Promise<TenantSplitSettings | null> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("label_split_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  return data as TenantSplitSettings | null;
});
