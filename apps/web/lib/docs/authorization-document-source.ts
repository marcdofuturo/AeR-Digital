import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AuthorizationReleaseSource,
  AuthorizationTenantSource,
  AuthorizationTrackSource,
} from "./authorization-document";

export const AUTHORIZATION_TRACK_SELECT = `
  id,
  title,
  isrc,
  track_participants(
    artist_id,
    position,
    artists(id, stage_name, legal_name)
  ),
  splits(scope, holder_type, artist_id, role_label, bps100, version)
`;

export type AuthorizationDocumentSource =
  | {
      status: "ok";
      release: AuthorizationReleaseSource;
      track: AuthorizationTrackSource;
      tenant: AuthorizationTenantSource;
    }
  | { status: "authorization-not-found" }
  | { status: "release-not-found" }
  | { status: "track-not-found" };

export async function getAuthorizationDocumentSource({
  tenantId,
  releaseId,
  authorizationId,
}: {
  tenantId: string;
  releaseId: string;
  authorizationId: string;
}): Promise<AuthorizationDocumentSource> {
  const supabase = createAdminClient();
  const { data: authorization } = await supabase
    .from("authorizations")
    .select("id, track_id")
    .eq("tenant_id", tenantId)
    .eq("release_id", releaseId)
    .eq("id", authorizationId)
    .single();

  if (!authorization?.track_id) return { status: "authorization-not-found" };

  const [releaseResult, trackResult, tenantResult] = await Promise.all([
    supabase
      .from("releases")
      .select("id, title, release_date, distributor, upc, album_id_ext")
      .eq("tenant_id", tenantId)
      .eq("id", releaseId)
      .single(),
    supabase
      .from("tracks")
      .select(AUTHORIZATION_TRACK_SELECT)
      .eq("tenant_id", tenantId)
      .eq("release_id", releaseId)
      .eq("id", authorization.track_id)
      .single(),
    supabase
      .from("tenants")
      .select("id, name, legal_name, responsible_name")
      .eq("id", tenantId)
      .single(),
  ]);

  if (!releaseResult.data) return { status: "release-not-found" };
  if (!trackResult.data) return { status: "track-not-found" };

  return {
    status: "ok",
    release: releaseResult.data,
    track: trackResult.data,
    tenant: tenantResult.data ?? { name: "Audiolink Brasil" },
  };
}
