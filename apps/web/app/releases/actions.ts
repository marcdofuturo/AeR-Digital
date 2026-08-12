"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAiCredits, generateClaudePresentation, remainingAiCredits } from "@/lib/ai/presentation";
import { getCurrentTenantId } from "@/lib/tenant";
import { persistAutomaticSplitsForTrack } from "@/lib/splits/persist";
import type { Participant } from "@ar/splits";
import type { ReleaseStage } from "@ar/shared";

type SplitScope = "obra" | "fonograma" | "digital";

const REGISTRATION_KINDS = new Set(["obra_ecad", "fonograma_ecad", "isrc", "distribuicao"]);

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

export async function saveRegistrationStatus(formData: FormData) {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const releaseId = String(formData.get("release_id") ?? "");
  const trackId = String(formData.get("track_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const status = String(formData.get("status") ?? "pendente");
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
      pro_affiliation: nullableString(formData.get("pro_affiliation")),
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
  const supabase = createAdminClient();

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

    const authorizationId = await ensureAuthorization(supabase, tenantId, releaseId, release.title, track, participants);
    const { data: existing } = await supabase
      .from("authorization_recipients")
      .select("artist_id")
      .eq("tenant_id", tenantId)
      .eq("authorization_id", authorizationId);

    const existingArtistIds = new Set((existing ?? []).map((recipient: any) => recipient.artist_id).filter(Boolean));
    const recipientsToInsert = participants
      .filter((tp: any) => tp.artist_id && !existingArtistIds.has(tp.artist_id))
      .map((tp: any) => {
        const artist = Array.isArray(tp.artists) ? tp.artists[0] : tp.artists;
        const contacts = artist?.artist_contacts ?? [];
        const email = pickPrimaryEmail(contacts) ?? `sem-email+${tp.artist_id}@aerdigital.local`;

        return {
          tenant_id: tenantId,
          authorization_id: authorizationId,
          artist_id: tp.artist_id,
          name: artist?.legal_name || artist?.stage_name || "Participante",
          email,
          reply_token: randomReplyToken(),
          status: "pendente",
        };
      });

    if (recipientsToInsert.length) {
      const { error: insertError } = await supabase.from("authorization_recipients").insert(recipientsToInsert);
      if (insertError) {
        console.error("Failed to create authorization recipients:", insertError);
        throw new Error("Falha ao gerar checklist de autorização");
      }
    }
  }
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
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("release_id", releaseId)
    .eq("track_id", track.id)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

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
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao gerar autorização: ${error.message}`);
  return data.id;
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

function revalidateRelease(releaseId: string) {
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath(`/releases/${releaseId}/autorizacao`);
  revalidatePath(`/releases/${releaseId}/registros`);
  revalidatePath(`/releases/${releaseId}/splits`);
}
