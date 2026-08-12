import { computeDigital, computeFonograma, computeObra } from "@ar/splits";
import type { DigitalConfig, Participant, SplitLine } from "@ar/splits";

export type SplitSettingsLike = {
  digital_mode?: "pro_rata" | "fixo" | null;
  digital_label_bps100?: number | null;
  digital_weight_primary?: number | null;
  digital_weight_featuring?: number | null;
};

export type PersistableSplitRow = {
  tenant_id: string;
  track_id: string;
  scope: "obra" | "fonograma" | "digital";
  holder_type: "artist" | "label";
  artist_id: string | null;
  role_label: string;
  bps100: number;
  is_manual_override: boolean;
  version: number;
};

export function normalizeDigitalConfig(settings?: SplitSettingsLike | null): DigitalConfig {
  return {
    mode: settings?.digital_mode === "pro_rata" ? "pro_rata" : "fixo",
    label_bps100: settings?.digital_mode === "pro_rata"
      ? 0
      : clampInt(settings?.digital_label_bps100 ?? 2500, 0, 10_000),
    weight_primary: clampInt(settings?.digital_weight_primary ?? 100, 1, 1000),
    weight_featuring: clampInt(settings?.digital_weight_featuring ?? 100, 1, 1000),
  };
}

export function buildAutomaticSplitRows({
  tenantId,
  trackId,
  participants,
  labelName,
  settings,
  version = 1,
}: {
  tenantId: string;
  trackId: string;
  participants: Participant[];
  labelName: string;
  settings?: SplitSettingsLike | null;
  version?: number;
}): PersistableSplitRow[] {
  if (participants.length === 0) return [];

  const sorted = [...participants].sort((a, b) => a.position - b.position);
  const scopes = [
    ["obra", computeObra(sorted)] as const,
    ["fonograma", computeFonograma(sorted, labelName)] as const,
    ["digital", computeDigital(sorted, normalizeDigitalConfig(settings), labelName)] as const,
  ];

  return scopes.flatMap(([scope, lines]) =>
    lines.map((line) => toPersistableRow(tenantId, trackId, scope, line, version)),
  );
}

export async function persistAutomaticSplitsForTrack(
  supabase: any,
  params: {
    tenantId: string;
    trackId: string;
    participants: Participant[];
    labelName: string;
    settings?: SplitSettingsLike | null;
    forceNewVersion?: boolean;
  },
) {
  if (params.participants.length === 0) return [];

  const nextVersion = await resolveNextVersion(supabase, params.tenantId, params.trackId, params.forceNewVersion ?? false);
  if (nextVersion === null) return [];

  const rows = buildAutomaticSplitRows({
    tenantId: params.tenantId,
    trackId: params.trackId,
    participants: params.participants,
    labelName: params.labelName,
    settings: params.settings,
    version: nextVersion,
  });

  if (!rows.length) return [];

  const { error } = await supabase.from("splits").insert(rows);
  if (error) throw new Error(`Falha ao gerar splits automaticos: ${error.message}`);

  return rows;
}

async function resolveNextVersion(supabase: any, tenantId: string, trackId: string, forceNewVersion: boolean) {
  const { data, error } = await supabase
    .from("splits")
    .select("version")
    .eq("tenant_id", tenantId)
    .eq("track_id", trackId)
    .order("version", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Falha ao ler splits existentes: ${error.message}`);

  const current = Number(data?.[0]?.version ?? 0);
  if (current > 0 && !forceNewVersion) return null;
  return current + 1;
}

function toPersistableRow(
  tenantId: string,
  trackId: string,
  scope: PersistableSplitRow["scope"],
  line: SplitLine,
  version: number,
): PersistableSplitRow {
  return {
    tenant_id: tenantId,
    track_id: trackId,
    scope,
    holder_type: line.holder_type,
    artist_id: line.artist_id ?? null,
    role_label: line.role_label,
    bps100: line.bps100,
    is_manual_override: false,
    version,
  };
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

