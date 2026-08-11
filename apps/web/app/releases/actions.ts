"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";
import type { ReleaseStage } from "@ar/shared";

export async function updateReleaseStage(releaseId: string, newStage: ReleaseStage) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("releases")
    .update({ stage: newStage, stage_since: new Date().toISOString() })
    .eq("id", releaseId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to update release stage:", error);
    throw new Error("Falha ao mover lançamento");
  }

  revalidatePath("/releases");
  revalidatePath(`/releases/${releaseId}`);
}

export async function setReleaseStageFromForm(formData: FormData) {
  const releaseId = String(formData.get("release_id") ?? "");
  const stage = String(formData.get("stage") ?? "") as ReleaseStage;
  if (!releaseId || !stage) throw new Error("Dados de estágio inválidos");

  await updateReleaseStage(releaseId, stage);
}

export async function markAuthorizationRecipientApproved(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const recipientId = String(formData.get("recipient_id") ?? "");
  const releaseId = String(formData.get("release_id") ?? "");
  if (!recipientId || !releaseId) throw new Error("Destinatário inválido");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("authorization_recipients")
    .update({
      status: "aprovado",
      responded_at: new Date().toISOString(),
      response_raw: "Marcado manualmente como OK no painel",
    })
    .eq("id", recipientId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to approve authorization recipient:", error);
    throw new Error("Falha ao marcar autorização");
  }

  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidatePath(`/releases/${releaseId}`);
}

export async function saveRegistrationStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const status = String(formData.get("status") ?? "pendente");
  if (!releaseId || !trackId || !kind) throw new Error("Registro inválido");

  const completed = status === "concluido";
  const dueAt = completed && kind === "obra_ecad"
    ? new Date(Date.now() + 45 * 86400000).toISOString()
    : nullableString(formData.get("due_at"));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("registrations")
    .upsert(
      {
        tenant_id: tenantId,
        track_id: trackId,
        kind,
        status,
        entity: nullableString(formData.get("entity")),
        external_id: nullableString(formData.get("external_id")),
        notes: nullableString(formData.get("notes")),
        due_at: dueAt,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "track_id,kind" },
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save registration:", error);
    throw new Error("Falha ao salvar registro");
  }

  revalidatePath(`/releases/${releaseId}/registros`);
  revalidatePath(`/releases/${releaseId}`);
}

function nullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}
