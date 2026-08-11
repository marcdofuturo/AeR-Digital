"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeRedirect(String(formData.get("redirect") ?? "/"));
  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Informe email e senha.")}&redirect=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Email ou senha inválidos.")}&redirect=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

function sanitizeRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
