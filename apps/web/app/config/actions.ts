"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/require-membership";
import { labelSettingsSchema, teamInvitationSchema } from "./schemas";

export type ConfigActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const INITIAL_CONFIG_ACTION_STATE: ConfigActionState = {
  status: "idle",
  message: "",
};

export async function inviteTeamMember(
  _previousState: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  try {
    const { tenantId } = await requireMembership(["owner"]);
    const parsed = teamInvitationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

    const admin = createAdminClient();
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", parsed.data.email)
      .maybeSingle();
    if (profileLookupError) throw new Error("Falha ao verificar o membro");

    let userId = existingProfile?.id as string | undefined;
    let newlyInvitedUserId: string | undefined;
    if (!userId) {
      const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL)
        ?.replace(/\/$/, "");
      const options = {
        data: { full_name: parsed.data.full_name },
        ...(appUrl ? { redirectTo: `${appUrl}/auth/invite?next=/config/equipe` } : {}),
      };
      const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, options);
      if (!error && data.user) {
        userId = data.user.id;
        newlyInvitedUserId = data.user.id;
      } else {
        userId = await findAuthUserByEmail(admin, parsed.data.email);
        if (!userId) throw new Error("Nao foi possivel enviar o convite");
      }
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
    });
    if (profileError) {
      if (newlyInvitedUserId) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(newlyInvitedUserId);
        if (cleanupError) console.error("Failed to compensate incomplete team invitation");
      }
      throw new Error("Falha ao preparar o perfil convidado");
    }

    const { error: membershipError } = await admin.from("memberships").upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: parsed.data.role,
      },
      { onConflict: "tenant_id,user_id" },
    );
    if (membershipError) throw new Error("Falha ao adicionar o membro ao selo");

    revalidatePath("/config/equipe");
    return { status: "success", message: "Convite enviado e acesso configurado." };
  } catch (error) {
    return actionFailure(error, "Nao foi possivel convidar o membro.");
  }
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | undefined> {
  const normalizedEmail = email.toLowerCase();
  const perPage = 100;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Falha ao reconciliar o usuario convidado");

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user) return user.id;
    if (data.users.length < perPage) return undefined;
  }

  throw new Error("Limite de usuarios excedido ao reconciliar convite");
}

export async function updateLabelSettings(
  _previousState: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  try {
    const { tenantId } = await requireMembership(["owner"]);
    const parsed = labelSettingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors);

    const admin = createAdminClient();
    const { error } = await admin
      .from("tenants")
      .update(parsed.data)
      .eq("id", tenantId)
      .select("id")
      .single();
    if (error) throw new Error("Falha ao atualizar os dados do selo");

    revalidatePath("/config/selo");
    return { status: "success", message: "Dados do selo atualizados." };
  } catch (error) {
    return actionFailure(error, "Nao foi possivel atualizar o selo.");
  }
}

function validationFailure(fieldErrors: Record<string, string[] | undefined>): ConfigActionState {
  return {
    status: "error",
    message: "Revise os campos informados.",
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
    ),
  };
}

function actionFailure(error: unknown, fallback: string): ConfigActionState {
  return {
    status: "error",
    message: error instanceof Error && error.message ? error.message : fallback,
  };
}
