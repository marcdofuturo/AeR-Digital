import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/require-membership";
import { cache } from "react";

/**
 * Resolve the current user's tenant ID from their most recent membership.
 * Cached per-request via React cache().
 */
export const getCurrentTenantId = cache(async (): Promise<string | null> => {
  try {
    return (await requireMembership()).tenantId;
  } catch {
    return null;
  }
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
