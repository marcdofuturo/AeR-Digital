import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MembershipRole = "owner" | "ar" | "financeiro" | "viewer";

export type MembershipContext = {
  userId: string;
  tenantId: string;
  role: MembershipRole;
};

const ALL_ROLES: MembershipRole[] = ["owner", "ar", "financeiro", "viewer"];

export async function requireMembership(
  allowedRoles: readonly MembershipRole[] = ALL_ROLES,
): Promise<MembershipContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const admin = createAdminClient();
  let query = admin
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id);

  const metadataTenantId = typeof user.app_metadata?.tenant_id === "string"
    ? user.app_metadata.tenant_id
    : null;
  if (metadataTenantId) query = query.eq("tenant_id", metadataTenantId);

  const { data: membership, error } = await query
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership) throw new Error("Sem permissao para este tenant");
  const role = membership.role as MembershipRole;
  if (!allowedRoles.includes(role)) throw new Error("Sem permissao para esta acao");

  return {
    userId: user.id,
    tenantId: membership.tenant_id,
    role,
  };
}
