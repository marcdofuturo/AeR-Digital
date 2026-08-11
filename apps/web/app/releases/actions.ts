"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReleaseStage } from "@ar/shared";

export async function updateReleaseStage(releaseId: string, newStage: ReleaseStage) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("releases")
    .update({ stage: newStage, stage_since: new Date().toISOString() })
    .eq("id", releaseId);

  if (error) {
    console.error("Failed to update release stage:", error);
    throw new Error("Falha ao mover lançamento");
  }

  revalidatePath("/releases");
  revalidatePath(`/releases/${releaseId}`);
}
