"use server";

import { revalidatePath } from "next/cache";
import { recordUserActivity } from "@/lib/activity/log";
import { requireMembership } from "@/lib/auth/require-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveArtistProfile(formData: FormData) {
  const { tenantId } = await requireMembership(["owner", "ar"]);
  const artistId = String(formData.get("artist_id") ?? "").trim();
  const stageName = String(formData.get("stage_name") ?? "").trim();
  if (!artistId || !stageName) throw new Error("Nome artistico obrigatorio");

  const profile = {
    stage_name: stageName,
    legal_name: nullableText(formData.get("legal_name")),
    ecad_code: nullableText(formData.get("ecad_code")),
    release_email: nullableText(formData.get("release_email")),
    phone: nullableText(formData.get("phone")),
  };
  if (profile.release_email && !/^\S+@\S+\.\S+$/.test(profile.release_email)) {
    throw new Error("Email de liberacao invalido");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("save_artist_profile", {
    p_tenant_id: tenantId,
    p_artist_id: artistId,
    p_stage_name: profile.stage_name,
    p_legal_name: profile.legal_name ?? "",
    p_ecad_code: profile.ecad_code ?? "",
    p_release_email: profile.release_email ?? "",
    p_phone: profile.phone ?? "",
  });
  if (error) throw new Error("Falha ao salvar dados do artista");

  await recordUserActivity(supabase, {
    tenantId,
    entityType: "artist",
    entityId: artistId,
    action: "Perfil do artista alterado",
    after: profile,
  });
  revalidatePath("/artists");
  revalidatePath(`/artists/${artistId}`);
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}
