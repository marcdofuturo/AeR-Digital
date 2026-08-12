// ─── HandlerDB Implementation (Supabase) ──────────────────────
import { createAdminClient } from "@/lib/supabase/admin";
import { persistAutomaticSplitsForTrack } from "@/lib/splits/persist";
import type { HandlerDB, ResolvedArtist } from "@ar/wa/types";

/**
 * Create a HandlerDB backed by Supabase (service_role client).
 * All queries filter by tenant_id explicitly — the service_role
 * bypasses RLS, so we must enforce multi-tenancy in code.
 */
export function createHandlerDB(): HandlerDB {
  const supabase = createAdminClient();

  return {
    async findArtist(tenantId: string, name: string): Promise<ResolvedArtist | null> {
      const norm = name.toLowerCase().trim();

      // Try exact match on stage_name first
      let { data } = await supabase
        .from("artists")
        .select("id, stage_name, legal_name, needs_review")
        .eq("tenant_id", tenantId)
        .ilike("stage_name", norm)
        .limit(1)
        .maybeSingle();

      // If not found, try broader search with trigram
      if (!data) {
        const { data: fuzzy } = await supabase
          .from("artists")
          .select("id, stage_name, legal_name, needs_review")
          .eq("tenant_id", tenantId)
          .or(`stage_name.ilike.%${norm}%,legal_name.ilike.%${norm}%`)
          .limit(1)
          .maybeSingle();
        data = fuzzy;
      }

      // Also check aliases
      if (!data) {
        const { data: aliasHit } = await supabase
          .from("artist_aliases")
          .select("artist_id, artists!inner(id, stage_name, legal_name, needs_review)")
          .eq("artists.tenant_id", tenantId)
          .ilike("alias", norm)
          .limit(1)
          .maybeSingle();

        if (aliasHit) {
          const artist = Array.isArray(aliasHit.artists)
            ? (aliasHit.artists[0] as { id: string; stage_name: string; legal_name: string | null; needs_review: boolean } | undefined)
            : (aliasHit.artists as { id: string; stage_name: string; legal_name: string | null; needs_review: boolean } | null);

          if (artist) {
            const matchLen = norm.length / artist.stage_name.length;
            return {
              id: artist.id,
              stage_name: artist.stage_name,
              input_name: name,
              position: 0,
              billing_role: "primary",
              is_producer: false,
              is_composer: true,
              is_performer: true,
              hidden_from_billing: false,
              match_score: Math.min(matchLen, 1.0),
              needs_review: artist.needs_review ?? false,
            };
          }
        }
      }

      if (!data) return null;

      const matchLen = norm.length / data.stage_name.length;
      return {
        id: data.id,
        stage_name: data.stage_name,
        input_name: name,
        position: 0,
        billing_role: "primary",
        is_producer: false,
        is_composer: true,
        is_performer: true,
        hidden_from_billing: false,
        match_score: Math.min(matchLen, 1.0),
        needs_review: data.needs_review ?? false,
      };
    },

    async createArtist(tenantId: string, stageName: string): Promise<ResolvedArtist> {
      const { data, error } = await supabase
        .from("artists")
        .insert({
          tenant_id: tenantId,
          stage_name: stageName,
          needs_review: true,
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to create artist: ${error.message}`);

      return {
        id: data!.id,
        stage_name: stageName,
        input_name: stageName,
        position: 0,
        billing_role: "primary",
        is_producer: false,
        is_composer: true,
        is_performer: true,
        hidden_from_billing: false,
        match_score: 0,
        needs_review: true,
      };
    },

    async createRelease(params) {
      // Insert release — map genres array to genre_primary / genre_secondary
      const { data: release, error: relErr } = await supabase
        .from("releases")
        .insert({
          tenant_id: params.tenantId,
          title: params.title,
          release_date: params.releaseDate,
          genre_primary: params.genres[0] ?? null,
          genre_secondary: params.genres[1] ?? null,
          cover_url: params.coverUrl ?? null,
          stage: "em_analise",
        })
        .select("id")
        .single();

      if (relErr) throw new Error(`Failed to create release: ${relErr.message}`);

      // Insert track
      const { data: track, error: trkErr } = await supabase
        .from("tracks")
        .insert({
          tenant_id: params.tenantId,
          release_id: release!.id,
          title: params.title,
          audio_url: params.audioUrl ?? null,
        })
        .select("id")
        .single();

      if (trkErr) throw new Error(`Failed to create track: ${trkErr.message}`);

      // Insert track participants
      const participantRows = params.participants.map((p) => ({
        tenant_id: params.tenantId,
        track_id: track!.id,
        artist_id: p.id,
        position: p.position,
        billing_role: p.billing_role,
        is_producer: p.is_producer,
        is_composer: p.is_composer,
        is_performer: p.is_performer,
        hidden_from_billing: p.hidden_from_billing,
      }));

      if (participantRows.length > 0) {
        const { error: partErr } = await supabase
          .from("track_participants")
          .insert(participantRows);

        if (partErr) throw new Error(`Failed to create participants: ${partErr.message}`);

        const [{ data: tenant }, { data: settings }] = await Promise.all([
          supabase.from("tenants").select("name").eq("id", params.tenantId).single(),
          supabase
            .from("label_split_settings")
            .select("digital_mode, digital_label_bps100, digital_weight_primary, digital_weight_featuring")
            .eq("tenant_id", params.tenantId)
            .maybeSingle(),
        ]);

        await persistAutomaticSplitsForTrack(supabase, {
          tenantId: params.tenantId,
          trackId: track!.id,
          participants: params.participants.map((p) => ({
            id: p.id,
            stage_name: p.stage_name,
            billing_role: p.billing_role,
            position: p.position,
            is_producer: p.is_producer,
            is_composer: true,
            is_performer: p.is_performer,
            hidden_from_billing: p.hidden_from_billing,
          })),
          labelName: tenant?.name ?? "Audiolink Brasil",
          settings,
        });
      }

      return { releaseId: release!.id, trackId: track!.id };
    },
  };
}
