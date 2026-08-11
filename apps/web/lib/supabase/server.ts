import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components and Route Handlers.
 * Reads auth session from Next.js cookies via the `@supabase/ssr` package.
 *
 * IMPORTANT: This client runs with the user's `authenticated` role.
 * All queries go through RLS — the user only sees data in their tenant.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll is called from a Server Action or Route Handler.
            // In that context cookieStore.set() throws — the middleware
            // handles setting the refreshed session cookie on the response.
          }
        },
      },
    },
  );
}
