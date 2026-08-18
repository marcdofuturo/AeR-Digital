"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAiCredits, generateClaudePresentation, remainingAiCredits } from "@/lib/ai/presentation";
import { requireMembership } from "@/lib/auth/require-membership";
import { persistAutomaticSplitsForTrack } from "@/lib/splits/persist";
import type { Participant } from "@ar/splits";
import type { ReleaseStage } from "@ar/shared";
import { isRegistrationStatus } from "@/lib/registration-status";

type SplitScope = "obra" | "fonograma" | "digital";

const REGISTRATION_KINDS = new Set(["obra_ecad", "fonograma_ecad", "isrc", "distribuicao"]);

async function getCurrentTenantId() {
  return (await requireMembership(["owner", "ar"])).tenantId;
}

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
  revalidateRelease(releaseId);
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
  const { data: updated, error } = await supabase
    .from("authorization_recipients")
    .update({
      status: "aprovado",
      responded_at: new Date().toISOString(),
      response_raw: "Marcado manualmente como OK no painel",
    })
    .eq("id", recipientId)
    .eq("tenant_id", tenantId)
    .select("authorization_id")
    .single();

  if (error) {
    console.error("Failed to approve authorization recipient:", error);
    throw new Error("Falha ao marcar autorização");
  }

  if (updated?.authorization_id) {
    await refreshAuthorizationStatus(supabase, tenantId, updated.authorization_id);
  }

  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidateRelease(releaseId);
}

export async function setAuthorizationRecipientStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const recipientId = String(formData.get("recipient_id") ?? "");
  const releaseId = String(formData.get("release_id") ?? "");
  const status = String(formData.get("status") ?? "pendente");
  if (!recipientId || !releaseId) throw new Error("Destinatário inválido");
  if (!["pendente", "aprovado", "recusado"].includes(status)) throw new Error("Status inválido");

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("authorization_recipients")
    .update({
      status,
      responded_at: status === "pendente" ? null : new Date().toISOString(),
      response_raw: status === "aprovado"
        ? "Marcado manualmente como OK no painel"
        : status === "recusado"
          ? "Marcado manualmente como recusado no painel"
          : null,
      response_class: status === "pendente" ? null : undefined,
    })
    .eq("id", recipientId)
    .eq("tenant_id", tenantId)
    .select("authorization_id")
    .single();

  if (error) {
    console.error("Failed to update authorization recipient:", error);
    throw new Error("Falha ao atualizar autorização");
  }

  if (updated?.authorization_id) {
    await refreshAuthorizationStatus(supabase, tenantId, updated.authorization_id);
  }

  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidateRelease(releaseId);
}

export async function saveAuthorizationRecipientEmail(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const recipientId = String(formData.get("recipient_id") ?? "");
  const artistId = nullableString(formData.get("artist_id"));
  const email = nullableString(formData.get("email"));
  if (!releaseId || !recipientId || !email || !email.includes("@")) {
    throw new Error("Email de autorização inválido");
  }

  const supabase = createAdminClient();
  const { error: recipientError } = await supabase
    .from("authorization_recipients")
    .update({ email })
    .eq("id", recipientId)
    .eq("tenant_id", tenantId);

  if (recipientError) {
    console.error("Failed to save authorization recipient email:", recipientError);
    throw new Error("Falha ao salvar email de autorização");
  }

  if (artistId) {
    await supabase
      .from("artist_contacts")
      .update({ is_primary: false })
      .eq("artist_id", artistId)
      .eq("kind", "email");

    const { data: existing } = await supabase
      .from("artist_contacts")
      .select("id")
      .eq("artist_id", artistId)
      .eq("kind", "email")
      .ilike("value", email)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("artist_contacts")
        .update({ is_primary: true })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("artist_contacts")
        .insert({
          artist_id: artistId,
          kind: "email",
          value: email,
          label: "Liberação",
          is_primary: true,
        });
    }
  }

  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidateRelease(releaseId);
}

export async function saveRegistrationStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const status = String(formData.get("status") ?? "pendente");
  if (!isRegistrationStatus(status)) throw new Error("Status de registro invalido");
  if (!releaseId || !trackId || !REGISTRATION_KINDS.has(kind)) throw new Error("Registro inválido");

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
  revalidateRelease(releaseId);
}

export async function saveReleaseOverview(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  if (!releaseId) throw new Error("Lançamento inválido");

  const supabase = createAdminClient();
  const uploadedCoverUrl = await uploadReleaseAsset(supabase, {
    tenantId,
    releaseId,
    file: formData.get("cover_file"),
    kind: "cover",
  });

  const { error } = await supabase
    .from("releases")
    .update({
      title: requiredString(formData.get("title"), "Título obrigatório"),
      release_date: requiredString(formData.get("release_date"), "Data obrigatória"),
      genre_primary: nullableString(formData.get("genre_primary")),
      genre_secondary: nullableString(formData.get("genre_secondary")),
      distributor: nullableString(formData.get("distributor")) ?? "Audiolink Brasil",
      upc: nullableString(formData.get("upc")),
      album_id_ext: nullableString(formData.get("album_id_ext")),
      cover_url: uploadedCoverUrl ?? nullableString(formData.get("cover_url")),
    })
    .eq("id", releaseId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to save release overview:", error);
    throw new Error("Falha ao salvar visão geral");
  }

  revalidateRelease(releaseId);
}

export async function saveTrackOverview(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  if (!releaseId || !trackId) throw new Error("Faixa inválida");

  const supabase = createAdminClient();
  const uploadedAudioUrl = await uploadReleaseAsset(supabase, {
    tenantId,
    releaseId,
    file: formData.get("audio_file"),
    kind: "audio",
  });

  const { error } = await supabase
    .from("tracks")
    .update({
      title: requiredString(formData.get("title"), "Título da faixa obrigatório"),
      isrc: nullableString(formData.get("isrc")),
      audio_url: uploadedAudioUrl ?? nullableString(formData.get("audio_url")),
      explicit: formData.get("explicit") === "on",
    })
    .eq("id", trackId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to save track overview:", error);
    throw new Error("Falha ao salvar faixa");
  }

  revalidateRelease(releaseId);
}

export async function saveArtistMetadata(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const artistId = String(formData.get("artist_id") ?? "");
  if (!releaseId || !artistId) throw new Error("Artista inválido");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artists")
    .update({
      legal_name: nullableString(formData.get("legal_name")),
      ecad_code: nullableString(formData.get("ecad_code")),
      needs_review: false,
    })
    .eq("id", artistId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to save artist metadata:", error);
    throw new Error("Falha ao salvar dados do artista");
  }

  revalidateRelease(releaseId);
  revalidatePath("/artists");
  revalidatePath(`/artists/${artistId}`);
}

export async function addTrackParticipant(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const stageName = String(formData.get("stage_name") ?? "").trim();
  if (!releaseId || !trackId || !stageName) throw new Error("Participante inválido");

  const supabase = createAdminClient();
  const artist = await findOrCreateArtist(supabase, tenantId, {
    stageName,
    legalName: nullableString(formData.get("legal_name")),
    ecadCode: nullableString(formData.get("ecad_code")),
  });
  const position = await nextParticipantPosition(supabase, tenantId, trackId);

  const { error } = await supabase
    .from("track_participants")
    .upsert(
      {
        tenant_id: tenantId,
        track_id: trackId,
        artist_id: artist.id,
        position,
        billing_role: formData.get("billing_role") === "featuring" ? "featuring" : "primary",
        is_composer: formData.get("is_composer") === "on",
        is_performer: formData.get("is_performer") === "on",
        is_producer: formData.get("is_producer") === "on",
        hidden_from_billing: false,
      },
      { onConflict: "track_id,artist_id" },
    );

  if (error) {
    console.error("Failed to add track participant:", error);
    throw new Error("Falha ao adicionar participante");
  }

  await regenerateTrackSplits(supabase, tenantId, trackId);
  revalidateRelease(releaseId);
  revalidatePath(`/releases/${releaseId}/registros`);
  revalidatePath(`/releases/${releaseId}/splits`);
}

export async function regenerateAutomaticSplits(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  if (!releaseId || !trackId) throw new Error("Faixa inválida");

  const supabase = createAdminClient();
  await regenerateTrackSplits(supabase, tenantId, trackId);

  revalidatePath(`/releases/${releaseId}/splits`);
  revalidateRelease(releaseId);
}

export async function saveManualSplits(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const scope = String(formData.get("scope") ?? "") as SplitScope;
  const lineCount = Number(formData.get("line_count") ?? 0);
  if (!releaseId || !trackId || !["obra", "fonograma", "digital"].includes(scope) || lineCount < 1) {
    throw new Error("Split inválido");
  }

  const rows = Array.from({ length: lineCount }, (_, index) => {
    const bps100 = percentToBps(formData.get(`percent_${index}`));
    return {
      tenant_id: tenantId,
      track_id: trackId,
      scope,
      holder_type: formData.get(`holder_type_${index}`) === "label" ? "label" : "artist",
      artist_id: nullableString(formData.get(`artist_id_${index}`)),
      role_label: nullableString(formData.get(`role_label_${index}`)) ?? "Participante",
      bps100,
      is_manual_override: true,
      version: 1,
    };
  });

  const total = rows.reduce((sum, row) => sum + row.bps100, 0);
  if (total !== 10_000) throw new Error(`Split soma ${(total / 100).toFixed(2)}%, esperado 100.00%`);

  const supabase = createAdminClient();
  const version = await nextSplitVersion(supabase, tenantId, trackId, scope);
  const { error } = await supabase
    .from("splits")
    .insert(rows.map((row) => ({ ...row, version })));

  if (error) {
    console.error("Failed to save manual splits:", error);
    throw new Error("Falha ao salvar split manual");
  }

  revalidatePath(`/releases/${releaseId}/splits`);
  revalidateRelease(releaseId);
}

export async function generatePresentationForTrack(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const userGuidance = nullableString(formData.get("user_guidance"));
  if (!releaseId || !trackId) throw new Error("Faixa inválida");

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("pitches")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  assertAiCredits(count ?? 0);

  const { data: track, error } = await supabase
    .from("tracks")
    .select(`
      id,
      title,
      audio_bpm,
      audio_key,
      audio_energy,
      lyrics_transcript,
      releases!inner(id, title, release_date, genre_primary, genre_secondary),
      track_participants(position, artists(stage_name))
    `)
    .eq("tenant_id", tenantId)
    .eq("id", trackId)
    .single();

  if (error || !track) throw new Error("Faixa não encontrada");

  const release = Array.isArray((track as any).releases) ? (track as any).releases[0] : (track as any).releases;
  const participants = [...((track as any).track_participants ?? [])]
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((tp: any) => tp.artists?.stage_name)
    .filter(Boolean);

  const result = await generateClaudePresentation({
    track: {
      title: track.title,
      releaseDate: release?.release_date ?? "",
      genres: [release?.genre_primary, release?.genre_secondary].filter(Boolean),
      participants,
      bpm: track.audio_bpm == null ? null : Number(track.audio_bpm),
      key: track.audio_key ?? null,
      energy: track.audio_energy == null ? null : Number(track.audio_energy),
      transcript: track.lyrics_transcript ?? null,
    },
    userGuidance,
  });

  const { error: insertError } = await supabase
    .from("pitches")
    .insert({
      tenant_id: tenantId,
      track_id: trackId,
      option_a: result.apresentacao,
      option_b: "",
      analysis: {
        kind: "presentation",
        user_guidance: userGuidance,
        avisos: result.avisos,
        raw: result.raw,
        credits_remaining_after: remainingAiCredits((count ?? 0) + 1),
      },
      audience: {},
    });

  if (insertError) {
    console.error("Failed to save presentation:", insertError);
    throw new Error("Falha ao salvar apresentação");
  }

  revalidatePath(`/releases/${releaseId}/pitch`);
  revalidateRelease(releaseId);
}

export async function ensureReleaseAuthorizationChecklist(tenantId: string, releaseId: string) {
  const authorizedTenantId = await getCurrentTenantId();
  if (tenantId !== authorizedTenantId) throw new Error("Sem permissao para este tenant");
  const supabase = createAdminClient();
  const ensuredAuthorizations: any[] = [];

  const { data: release, error } = await supabase
    .from("releases")
    .select(`
      id,
      title,
      tracks(
        id,
        title,
        track_participants(
          artist_id,
          position,
          artists(id, stage_name, legal_name, artist_contacts(kind, value, is_primary))
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    console.error("Failed to load release for authorization checklist:", error);
    throw new Error("Falha ao carregar participantes para autorização");
  }

  for (const track of release.tracks ?? []) {
    const participants = [...(track.track_participants ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    if (!participants.length) continue;

    const authorization = await ensureAuthorization(supabase, tenantId, releaseId, release.title, track, participants);
    const { data: existing } = await supabase
      .from("authorization_recipients")
      .select("id, artist_id, name, email, status, responded_at")
      .eq("tenant_id", tenantId)
      .eq("authorization_id", authorization.id);

    const existingArtistIds = new Set((existing ?? []).map((recipient: any) => recipient.artist_id).filter(Boolean));
    const ensuredRecipients = [...(existing ?? [])];
    const recipientsToInsert = participants
      .filter((tp: any) => tp.artist_id && !existingArtistIds.has(tp.artist_id))
      .map((tp: any) => {
        const artist = Array.isArray(tp.artists) ? tp.artists[0] : tp.artists;
        const contacts = artist?.artist_contacts ?? [];
        const email = pickPrimaryEmail(contacts) ?? `sem-email+${tp.artist_id}@aerdigital.local`;

        return {
          tenant_id: tenantId,
          authorization_id: authorization.id,
          artist_id: tp.artist_id,
          name: artist?.legal_name || artist?.stage_name || "Participante",
          email,
          reply_token: randomReplyToken(),
          status: "pendente",
        };
      });

    if (recipientsToInsert.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("authorization_recipients")
        .insert(recipientsToInsert)
        .select("id, artist_id, name, email, status, responded_at");
      if (insertError) {
        console.error("Failed to create authorization recipients:", insertError);
        throw new Error("Falha ao gerar checklist de autorização");
      }
      ensuredRecipients.push(...(inserted ?? []));
    }

    ensuredAuthorizations.push({
      ...authorization,
      authorization_recipients: ensuredRecipients,
    });
  }

  return ensuredAuthorizations;
}

async function refreshAuthorizationStatus(supabase: any, tenantId: string, authorizationId: string) {
  const { data } = await supabase
    .from("authorization_recipients")
    .select("status")
    .eq("tenant_id", tenantId)
    .eq("authorization_id", authorizationId);

  const recipients = data ?? [];
  if (!recipients.length) return;

  const nextStatus = recipients.every((recipient: any) => recipient.status === "aprovado")
    ? "aprovado"
    : recipients.some((recipient: any) => recipient.status === "recusado")
      ? "recusado"
      : recipients.some((recipient: any) => recipient.status === "aprovado")
        ? "parcial"
        : "rascunho";

  await supabase
    .from("authorizations")
    .update({
      status: nextStatus,
      resolved_at: nextStatus === "aprovado" || nextStatus === "recusado" ? new Date().toISOString() : null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", authorizationId);
}

async function ensureAuthorization(
  supabase: any,
  tenantId: string,
  releaseId: string,
  releaseTitle: string,
  track: any,
  participants: any[],
) {
  const { data: existing } = await supabase
    .from("authorizations")
    .select("id, status, created_at, sent_at")
    .eq("tenant_id", tenantId)
    .eq("release_id", releaseId)
    .eq("track_id", track.id)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing;

  const snapshot = {
    release_title: releaseTitle,
    track_title: track.title,
    participants: participants.map((tp: any) => {
      const artist = Array.isArray(tp.artists) ? tp.artists[0] : tp.artists;
      return {
        artist_id: tp.artist_id,
        name: artist?.legal_name || artist?.stage_name || "Participante",
        position: tp.position,
      };
    }),
  };

  const { data, error } = await supabase
    .from("authorizations")
    .insert({
      tenant_id: tenantId,
      release_id: releaseId,
      track_id: track.id,
      snapshot,
      status: "rascunho",
    })
    .select("id, status, created_at, sent_at")
    .single();

  if (error) throw new Error(`Falha ao gerar autorização: ${error.message}`);
  return data;
}

async function findOrCreateArtist(
  supabase: any,
  tenantId: string,
  input: { stageName: string; legalName: string | null; ecadCode: string | null },
) {
  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("stage_name", input.stageName)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    if (input.legalName || input.ecadCode) {
      await supabase
        .from("artists")
        .update({
          legal_name: input.legalName,
          ecad_code: input.ecadCode,
          needs_review: false,
        })
        .eq("tenant_id", tenantId)
        .eq("id", existing.id);
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("artists")
    .insert({
      tenant_id: tenantId,
      stage_name: input.stageName,
      legal_name: input.legalName,
      ecad_code: input.ecadCode,
      needs_review: !input.legalName || !input.ecadCode,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao criar artista: ${error.message}`);
  return data;
}

async function nextParticipantPosition(supabase: any, tenantId: string, trackId: string) {
  const { data } = await supabase
    .from("track_participants")
    .select("position")
    .eq("tenant_id", tenantId)
    .eq("track_id", trackId)
    .order("position", { ascending: false })
    .limit(1);

  return Number(data?.[0]?.position ?? 0) + 1;
}

async function regenerateTrackSplits(supabase: any, tenantId: string, trackId: string) {
  const [tenant, settings, participants] = await Promise.all([
    loadTenantName(supabase, tenantId),
    loadSplitSettings(supabase, tenantId),
    loadTrackParticipants(supabase, tenantId, trackId),
  ]);

  return persistAutomaticSplitsForTrack(supabase, {
    tenantId,
    trackId,
    participants,
    labelName: tenant,
    settings,
    forceNewVersion: true,
  });
}

async function loadTenantName(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  return data?.name ?? "Audiolink Brasil";
}

async function loadSplitSettings(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("label_split_settings")
    .select("digital_mode, digital_label_bps100, digital_weight_primary, digital_weight_featuring")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return data;
}

async function loadTrackParticipants(supabase: any, tenantId: string, trackId: string): Promise<Participant[]> {
  const { data } = await supabase
    .from("track_participants")
    .select("artist_id, position, billing_role, is_producer, is_composer, is_performer, hidden_from_billing, artists(id, stage_name)")
    .eq("tenant_id", tenantId)
    .eq("track_id", trackId)
    .order("position", { ascending: true });

  return (data ?? []).map((tp: any) => {
    const artist = Array.isArray(tp.artists) ? tp.artists[0] : tp.artists;
    return {
      id: tp.artist_id,
      stage_name: artist?.stage_name ?? "Participante",
      position: tp.position ?? 1,
      billing_role: tp.billing_role === "featuring" ? "featuring" : "primary",
      is_producer: Boolean(tp.is_producer),
      is_composer: true,
      is_performer: Boolean(tp.is_performer),
      hidden_from_billing: Boolean(tp.hidden_from_billing),
    };
  });
}

async function nextSplitVersion(supabase: any, tenantId: string, trackId: string, scope: SplitScope) {
  const { data } = await supabase
    .from("splits")
    .select("version")
    .eq("tenant_id", tenantId)
    .eq("track_id", trackId)
    .eq("scope", scope)
    .order("version", { ascending: false })
    .limit(1);

  return Number(data?.[0]?.version ?? 0) + 1;
}

function pickPrimaryEmail(contacts: any[]) {
  const emails = contacts.filter((contact) => contact.kind === "email");
  return emails.find((contact) => contact.is_primary)?.value ?? emails[0]?.value ?? null;
}

function randomReplyToken() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function percentToBps(value: FormDataEntryValue | null) {
  const percent = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(percent)) return 0;
  return Math.round(percent * 100);
}

function nullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function requiredString(value: FormDataEntryValue | null, message: string) {
  const text = nullableString(value);
  if (!text) throw new Error(message);
  return text;
}

async function uploadReleaseAsset(
  supabase: ReturnType<typeof createAdminClient>,
  {
    tenantId,
    releaseId,
    file,
    kind,
  }: {
    tenantId: string;
    releaseId: string;
    file: FormDataEntryValue | null;
    kind: "cover" | "audio";
  },
) {
  if (!(file instanceof File) || file.size === 0) return null;

  const allowed = kind === "cover"
    ? ["image/jpeg", "image/png", "image/webp"]
    : ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
  if (file.type && !allowed.includes(file.type)) {
    throw new Error(kind === "cover" ? "Formato de capa inválido" : "Formato de áudio inválido");
  }

  const bucket = "release-assets";
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined);

  const extension = fileExtension(file.name, file.type, kind);
  const path = `${tenantId}/${releaseId}/${kind}-${globalThis.crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || (kind === "cover" ? "image/jpeg" : "audio/mpeg"),
    upsert: false,
  });

  if (error) throw new Error(`Falha ao enviar ${kind === "cover" ? "capa" : "áudio"}: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function fileExtension(name: string, type: string, kind: "cover" | "audio") {
  const fromName = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName;
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  return kind === "cover" ? "jpg" : "mp3";
}

function revalidateRelease(releaseId: string) {
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidatePath(`/releases/${releaseId}/registros`);
  revalidatePath(`/releases/${releaseId}/splits`);
}
