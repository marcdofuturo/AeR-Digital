import type { WhatsAppProvider } from "./provider";

// ─── Step identifiers ────────────────────────────────────────
export type Step =
  | "ask_release_format"
  | "ask_album_track_count"
  | "ask_title"
  | "ask_artists"
  | "confirm_file_metadata"
  | "ask_metadata_correction"
  | "ask_producers"
  | "ask_producer_position"
  | "confirm_external_producer"
  | "ask_genres"
  | "ask_date"
  | "ask_audio"
  | "ask_cover"
  | "confirm"
  | "done";

// ─── Draft — accumulated answers ─────────────────────────────
export interface Draft {
  release_format?: "single" | "album";
  album_track_count?: number;
  current_track_index?: number;
  title?: string;
  audio_filename?: string;
  filename_title_guess?: string;
  filename_participants_guess?: string[];
  metadata_roles?: Array<{ name: string; role: string }>;
  corrected_title?: string;
  artists?: ResolvedArtist[];
  producers?: ProducerRef[];
  pending_external_producers?: string[];
  producer_position_index?: number; // current producer being positioned
  genres?: string[];
  release_date?: string; // ISO
  audio_url?: string;
  cover_url?: string;
  urgent?: boolean;
}

export interface IncomingMedia {
  kind: "audio" | "image";
  url?: string | null;
  fileName?: string | null;
  messageId?: string | null;
  mimeType?: string | null;
}

export interface ResolvedArtist {
  id: string;
  stage_name: string;
  input_name: string;
  position: number;
  billing_role: "primary" | "featuring";
  is_producer: boolean;
  is_composer: boolean;
  is_performer: boolean;
  hidden_from_billing: boolean;
  match_score: number; // 0–1
  needs_review: boolean;
}

export interface ProducerRef {
  name: string;
  artist_id?: string; // if found in artist list
  position?: number;
  hidden_from_billing?: boolean;
}

// ─── Handler signature ───────────────────────────────────────

export interface HandlerContext {
  tenant_id: string;
  tenant_name: string;
  phone: string;
  provider: WhatsAppProvider;
  db: HandlerDB;
  incomingMedia?: IncomingMedia;
}

export interface HandlerDB {
  findArtist(tenantId: string, name: string): Promise<ResolvedArtist | null>;
  createArtist(tenantId: string, stageName: string): Promise<ResolvedArtist>;
  createRelease(params: {
    tenantId: string;
    title: string;
    releaseDate: string;
    genres: string[];
    audioUrl?: string;
    coverUrl?: string;
    participants: ResolvedArtist[];
    producers: ProducerRef[];
  }): Promise<{ releaseId: string; trackId: string }>;
}

export interface StepResult {
  reply: string;
  nextStep: Step;
  draft: Partial<Draft>;
}

// ─── Handler type ────────────────────────────────────────────
export type StepHandler = (
  input: string,
  draft: Draft,
  ctx: HandlerContext,
) => Promise<StepResult>;
