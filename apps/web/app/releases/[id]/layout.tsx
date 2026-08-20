import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReleaseTabs } from "@/components/releases/release-tabs";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { fmtDate } from "@ar/shared";
import { ArrowLeft } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {};
for (const s of KANBAN_STAGES) STAGE_LABEL[s.id] = s.label;

export default async function ReleaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) notFound();

  const release = await getRelease(tenantId, id);
  if (!release) notFound();

  const r = release as any;
  const stageLabel = STAGE_LABEL[r.stage] ?? r.stage;

  return (
    <div className="max-w-[1600px] p-4 pt-20 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/releases">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-fg truncate text-xl font-bold">{r.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stageLabel}
              </Badge>
              {r.genre_primary && (
                <Badge variant="secondary" className="text-xs">
                  {r.genre_primary}
                  {r.genre_secondary ? ` / ${r.genre_secondary}` : ""}
                </Badge>
              )}
              <span className="text-fg-muted text-xs">{fmtDate(r.release_date)}</span>
              {r.upc && <span className="text-fg-muted font-mono text-xs">UPC: {r.upc}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar — Client Component for active detection */}
      <ReleaseTabs releaseId={id} />

      {/* Page content */}
      {children}
    </div>
  );
}
