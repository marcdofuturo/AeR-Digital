import { Suspense } from "react";
import Link from "next/link";
import { KanbanBoard } from "@/components/releases/kanban-board";
import { ReleasesTable } from "@/components/releases/releases-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getReleases } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { LayoutGrid, List, Plus, Inbox } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

interface ReleasesPageProps {
  searchParams: Promise<{ view?: string; stage?: string }>;
}

async function ReleasesContent({ view, stage }: { view: string; stage?: string }) {
  const tenantId = await getCurrentTenantId();
  const rows = await getReleases(tenantId ?? undefined);
  const visibleRows = stage ? rows.filter((r: any) => r.stage === stage) : rows;

  const cards = visibleRows.map((r: any) => {
    const daysInStage = r.stage_since
      ? Math.floor((Date.now() - new Date(r.stage_since).getTime()) / 86400000)
      : 0;
    const trackParticipants = (r.tracks ?? []).flatMap((track: any) => track.track_participants ?? []);
    const artists = trackParticipants
      .map((tp: any) => tp.artists?.stage_name)
      .filter(Boolean);

    return {
      id: r.id,
      title: r.title,
      artists: [...new Set(artists)] as string[],
      releaseDate: r.release_date,
      stage: r.stage,
      daysInStage,
    };
  });

  if (!cards.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-3">
            <Inbox className="h-10 w-10 text-fg-muted" />
          </div>
          <p className="text-fg-muted mb-1">Nenhum lançamento no pipeline</p>
          <p className="text-sm text-fg-muted mb-4">
            Os lançamentos enviados pelo WhatsApp ou convertidos pelo inbox aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view === "table") {
    return <ReleasesTable releases={cards} />;
  }

  return (
    <div className="overflow-x-auto">
      <KanbanBoard releases={cards} />
    </div>
  );
}

export default async function ReleasesPage({ searchParams }: ReleasesPageProps) {
  const { view, stage } = await searchParams;
  const isTable = view === "table";
  const selectedStageLabel = stage ? STAGE_LABEL[stage] ?? stage : null;

  return (
    <div className="p-8 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">Lançamentos</h1>
          <p className="text-sm text-fg-muted mt-1">
            {selectedStageLabel ? `Filtrando: ${selectedStageLabel}` : "Pipeline de gerenciamento de lançamentos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-surface border border-border rounded-md p-0.5 mr-2">
            <Link
              href={stage ? `/releases?stage=${stage}` : "/releases"}
              className={`p-1.5 rounded-sm transition-colors ${
                !isTable ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </Link>
            <Link
              href={stage ? `/releases?view=table&stage=${stage}` : "/releases?view=table"}
              className={`p-1.5 rounded-sm transition-colors ${
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
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {KANBAN_STAGES.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs text-fg-muted shrink-0">
            <span className="w-2 h-2 rounded-full bg-brand/60" />
            {s.label}
            {i < KANBAN_STAGES.length - 1 && (
              <span className="text-border mx-1">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <Suspense
        fallback={
          <div className="flex gap-3 pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[280px] shrink-0">
                <Skeleton className="h-96 w-full rounded-lg" />
              </div>
            ))}
          </div>
        }
      >
        <ReleasesContent view={view ?? "kanban"} stage={stage} />
      </Suspense>
    </div>
  );
}
