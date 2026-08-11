import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components.
 * Used for real-time subscriptions and optimistic mutations.
 *
 * Reads from the same cookie-based session as the server client,
 * so the user stays authenticated across Server and Client Components.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
