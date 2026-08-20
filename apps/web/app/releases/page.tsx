import Link from "next/link";
import { KanbanBoard } from "@/components/releases/kanban-board";
import { ReleasesTable } from "@/components/releases/releases-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getReleases } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { LayoutGrid, List, Plus, Inbox } from "lucide-react";
import type { KanbanCardData } from "@/components/releases/kanban-card";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

interface ReleasesPageProps {
  searchParams: Promise<{ view?: string; stage?: string }>;
}

type ReleaseListParticipant = {
  position?: number | null;
  artists?: { stage_name?: string | null } | null;
};

type ReleaseListRegistration = {
  status?: string | null;
};

type ReleaseListAuthorizationRecipient = {
  status?: string | null;
};

type ReleaseListTrack = {
  id: string;
  title: string;
  isrc?: string | null;
  audio_url?: string | null;
  audio_duration_sec?: number | null;
  audio_bpm?: number | string | null;
  audio_key?: string | null;
  explicit?: boolean | null;
  track_participants?: ReleaseListParticipant[] | null;
  registrations?: ReleaseListRegistration[] | null;
};

type ReleaseListRow = {
  id: string;
  title: string;
  release_date: string;
  stage: string;
  stage_since?: string | null;
  genre_primary?: string | null;
  genre_secondary?: string | null;
  cover_url?: string | null;
  upc?: string | null;
  album_id_ext?: string | null;
  distributor?: string | null;
  tracks?: ReleaseListTrack[] | null;
  authorizations?: Array<{
    authorization_recipients?: ReleaseListAuthorizationRecipient[] | null;
  }> | null;
};

async function ReleasesContent({ view, stage }: { view: string; stage?: string }) {
  const tenantId = await getCurrentTenantId();
  const rows = (await getReleases(tenantId ?? undefined)) as ReleaseListRow[];
  const visibleRows = stage ? rows.filter((r) => r.stage === stage) : rows;

  const cards: KanbanCardData[] = visibleRows.map((r) => {
    const daysInStage = r.stage_since
      ? Math.floor((Date.now() - new Date(r.stage_since).getTime()) / 86400000)
      : 0;
    const trackParticipants = (r.tracks ?? []).flatMap((track) => track.track_participants ?? []);
    const artists = trackParticipants.map((tp) => tp.artists?.stage_name).filter(Boolean);
    const tracks = (r.tracks ?? []).map((track) => {
      const participants = [...(track.track_participants ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((tp) => tp.artists?.stage_name)
        .filter(Boolean);

      return {
        id: track.id,
        title: track.title,
        isrc: track.isrc ?? null,
        audioReceived: Boolean(track.audio_url),
        durationSec: track.audio_duration_sec ?? null,
        bpm: track.audio_bpm == null ? null : Number(track.audio_bpm),
        key: track.audio_key ?? null,
        explicit: track.explicit ?? false,
        participants: [...new Set(participants)] as string[],
      };
    });
    const registrations = (r.tracks ?? []).flatMap((track) => track.registrations ?? []);
    const authorizationRecipients = (r.authorizations ?? []).flatMap(
      (auth) => auth.authorization_recipients ?? [],
    );
    const authorizationTotal = authorizationRecipients.length;
    const registrationTotal = registrations.length;

    return {
      id: r.id,
      title: r.title,
      artists: [...new Set(artists)] as string[],
      releaseDate: r.release_date,
      stage: r.stage,
      daysInStage,
      stageSince: r.stage_since ?? null,
      genrePrimary: r.genre_primary ?? null,
      genreSecondary: r.genre_secondary ?? null,
      coverUrl: r.cover_url ?? null,
      coverReceived: Boolean(r.cover_url),
      upc: r.upc ?? null,
      albumIdExt: r.album_id_ext ?? null,
      distributor: r.distributor ?? null,
      tracks,
      authorizations: {
        total: authorizationTotal,
        approved: authorizationRecipients.filter((recipient) => recipient.status === "aprovado")
          .length,
        pending: authorizationRecipients.filter(
          (recipient) => !["aprovado", "recusado"].includes(recipient.status ?? ""),
        ).length,
        rejected: authorizationRecipients.filter((recipient) => recipient.status === "recusado")
          .length,
      },
      registrations: {
        total: registrationTotal,
        completed: registrations.filter((registration) => registration.status === "concluido")
          .length,
        pending: registrations.filter(
          (registration) => !["concluido", "rejeitado", "na"].includes(registration.status ?? ""),
        ).length,
        rejected: registrations.filter((registration) => registration.status === "rejeitado")
          .length,
      },
    };
  });

  if (!cards.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="mb-3 flex justify-center">
            <Inbox className="text-fg-muted h-10 w-10" />
          </div>
          <p className="text-fg-muted mb-1">Nenhum lançamento no pipeline</p>
          <p className="text-fg-muted mb-4 text-sm">
            Os lançamentos enviados pelo WhatsApp ou convertidos pelo inbox aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view === "table") {
    return <ReleasesTable releases={cards} />;
  }

  return <KanbanBoard releases={cards} />;
}

export default async function ReleasesPage({ searchParams }: ReleasesPageProps) {
  const { view, stage } = await searchParams;
  const isTable = view === "table";
  const selectedStageLabel = stage ? (STAGE_LABEL[stage] ?? stage) : null;
  const releasesContent = await ReleasesContent({ view: view ?? "kanban", stage });

  return (
    <div className="max-w-full p-4 pt-20 pb-16 sm:p-8 sm:pb-16">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-fg text-2xl font-bold">Lançamentos</h1>
          <p className="text-fg-muted mt-1 text-sm">
            {selectedStageLabel
              ? `Filtrando: ${selectedStageLabel}`
              : "Pipeline de gerenciamento de lançamentos"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="bg-surface border-border mr-2 flex rounded-md border p-0.5">
            <Link
              href={stage ? `/releases?stage=${stage}` : "/releases"}
              className={`rounded-sm p-1.5 transition-colors ${
                !isTable ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </Link>
            <Link
              href={stage ? `/releases?view=table&stage=${stage}` : "/releases?view=table"}
              className={`rounded-sm p-1.5 transition-colors ${
                isTable ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              <List className="h-4 w-4" />
            </Link>
          </div>

          <Button asChild size="sm">
            <Link href="/releases/new">
              <Plus className="h-4 w-4" />
              Novo
            </Link>
          </Button>
        </div>
      </div>

      {/* Stage legend */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2">
        {KANBAN_STAGES.map((s, i) => (
          <div key={s.id} className="text-fg-muted flex shrink-0 items-center gap-1.5 text-xs">
            <span className="bg-brand/60 h-2 w-2 rounded-full" />
            {s.label}
            {i < KANBAN_STAGES.length - 1 && <span className="text-border mx-1">→</span>}
          </div>
        ))}
      </div>

      {/* Content */}
      {releasesContent}
    </div>
  );
}
