"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant";

export async function saveDigitalSplitSettings(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const mode = formData.get("digital_mode") === "pro_rata" ? "pro_rata" : "fixo";
  const percent = Number(String(formData.get("digital_label_percent") ?? "0").replace(",", "."));
  const labelBps100 = mode === "fixo"
    ? clamp(Math.round((Number.isFinite(percent) ? percent : 0) * 100), 0, 10_000)
    : 0;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("label_split_settings")
    .upsert(
      {
        tenant_id: tenantId,
        digital_mode: mode,
        digital_label_bps100: labelBps100,
        digital_weight_primary: 100,
        digital_weight_featuring: 100,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save split settings:", error);
    throw new Error("Falha ao salvar configuração de split digital");
  }

  revalidatePath("/config/splits");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
