import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROLE_FIXES = new Map([
  ["Produtor fonogr?fico", "Produtor fonográfico"],
  ["Produtor fonogr�fico", "Produtor fonográfico"],
  ["Produtor fonogrÃ¡fico", "Produtor fonográfico"],
  ["Int?rprete", "Intérprete"],
  ["Int�rprete", "Intérprete"],
  ["IntÃ©rprete", "Intérprete"],
  ["M?sico", "Músico"],
  ["M?sico acompanhante", "Músico acompanhante"],
  ["M�sico", "Músico"],
  ["M�sico acompanhante", "Músico acompanhante"],
  ["MÃºsico", "Músico"],
  ["MÃºsico acompanhante", "Músico acompanhante"],
  ["Interprete", "Intérprete"],
  ["Musico", "Músico"],
  ["Musico acompanhante", "Músico acompanhante"],
  ["Produtor fonografico", "Produtor fonográfico"],
]);

const splitFixes = await fixSplitRoleLabels();
const backfill = await backfillAuthorizationRecipients();

console.log(JSON.stringify({ splitFixes, ...backfill }, null, 2));

async function fixSplitRoleLabels() {
  let fixed = 0;

  for (const [from, to] of ROLE_FIXES) {
    const { data, error } = await supabase
      .from("splits")
      .update({ role_label: to })
      .eq("role_label", from)
      .select("id");

    if (error) throw new Error(`Failed to fix split role labels: ${error.message}`);
    fixed += data?.length ?? 0;
  }

  return fixed;
}

async function backfillAuthorizationRecipients() {
  const { data: releases, error } = await supabase
    .from("releases")
    .select(`
      id,
      tenant_id,
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
    `);

  if (error) throw new Error(`Failed to load releases: ${error.message}`);

  let authorizationsCreated = 0;
  let recipientsCreated = 0;
  let releasesTouched = 0;

  for (const release of releases ?? []) {
    let touched = false;
    for (const track of release.tracks ?? []) {
      const participants = [...(track.track_participants ?? [])]
        .filter((participant) => participant.artist_id)
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));

      if (!participants.length) continue;

      const authorization = await ensureAuthorization(release, track, participants);
      if (authorization.created) authorizationsCreated += 1;

      const inserted = await ensureRecipients(release.tenant_id, authorization.id, participants);
      recipientsCreated += inserted;
      touched = touched || authorization.created || inserted > 0;
    }
    if (touched) releasesTouched += 1;
  }

  return { releasesTouched, authorizationsCreated, recipientsCreated };
}

async function ensureAuthorization(release, track, participants) {
  const { data: existing, error: existingError } = await supabase
    .from("authorizations")
    .select("id")
    .eq("tenant_id", release.tenant_id)
    .eq("release_id", release.id)
    .eq("track_id", track.id)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to load authorization: ${existingError.message}`);
  if (existing?.id) return { id: existing.id, created: false };

  const snapshot = {
    release_title: release.title,
    track_title: track.title,
    participants: participants.map((participant) => {
      const artist = Array.isArray(participant.artists) ? participant.artists[0] : participant.artists;
      return {
        artist_id: participant.artist_id,
        name: artist?.legal_name || artist?.stage_name || "Participante",
        position: participant.position,
      };
    }),
  };

  const { data, error } = await supabase
    .from("authorizations")
    .insert({
      tenant_id: release.tenant_id,
      release_id: release.id,
      track_id: track.id,
      snapshot,
      status: "rascunho",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create authorization: ${error.message}`);
  return { id: data.id, created: true };
}

async function ensureRecipients(tenantId, authorizationId, participants) {
  const { data: existing, error } = await supabase
    .from("authorization_recipients")
    .select("artist_id")
    .eq("tenant_id", tenantId)
    .eq("authorization_id", authorizationId);

  if (error) throw new Error(`Failed to load recipients: ${error.message}`);

  const existingArtistIds = new Set((existing ?? []).map((recipient) => recipient.artist_id).filter(Boolean));
  const rows = participants
    .filter((participant) => participant.artist_id && !existingArtistIds.has(participant.artist_id))
    .map((participant) => {
      const artist = Array.isArray(participant.artists) ? participant.artists[0] : participant.artists;
      return {
        tenant_id: tenantId,
        authorization_id: authorizationId,
        artist_id: participant.artist_id,
        name: artist?.legal_name || artist?.stage_name || "Participante",
        email: pickPrimaryEmail(artist?.artist_contacts ?? []) ?? `sem-email+${participant.artist_id}@aerdigital.local`,
        reply_token: crypto.randomUUID(),
        status: "pendente",
      };
    });

  if (!rows.length) return 0;

  const { data, error: insertError } = await supabase
    .from("authorization_recipients")
    .insert(rows)
    .select("id");

  if (insertError) throw new Error(`Failed to create recipients: ${insertError.message}`);
  return data?.length ?? 0;
}

function pickPrimaryEmail(contacts) {
  const emails = contacts.filter((contact) => contact.kind === "email");
  return emails.find((contact) => contact.is_primary)?.value ?? emails[0]?.value ?? null;
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const content = fs.readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] = value;
  }
}
