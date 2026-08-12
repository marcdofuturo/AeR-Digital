import { createClient } from "@supabase/supabase-js";

const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

/**
 * ⚠️ SERVICE ROLE CLIENT — BYPASSES ROW LEVEL SECURITY ⚠️
 *
 * Only use this in:
 * - Route Handlers that receive webhooks (no user session)
 * - Server Actions that need to write across tenants
 * - Onboarding flow (user has no tenant yet)
 *
 * NEVER expose this client to the browser.
 * NEVER use it in Server Components that render UI.
 *
 * Always filter by tenant_id explicitly when using this client —
 * the service_role bypasses RLS, so you must enforce multi-tenancy
 * in application code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: noStoreFetch,
      },
    },
  );
}
