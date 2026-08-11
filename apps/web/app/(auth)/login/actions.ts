"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSiteUrl } from "@/lib/auth/site-url";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  if (!email) return;

  const supabase = await createClient();
  const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, await headers());

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=true");
}
