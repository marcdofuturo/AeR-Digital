import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getArtists } from "@/lib/data/artists";
import { getCurrentTenantId } from "@/lib/tenant";
import { MicVocal, Plus, AlertTriangle, Search } from "lucide-react";

interface ArtistsPageProps {
  searchParams: Promise<{ q?: string; precisa_revisao?: string }>;
}

async function ArtistsGrid({ search, needsReview }: { search?: string; needsReview?: boolean }) {
  const tenantId = await getCurrentTenantId();
  let artists = await getArtists(tenantId ?? undefined, search);

  if (needsReview) {
    artists = artists.filter((a: any) => a.needs_review);
  }

  if (!artists.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-3">
            <MicVocal className="h-10 w-10 text-fg-muted" />
          </div>
          <p className="text-fg-muted mb-1">Nenhum artista encontrado</p>
          <p className="text-sm text-fg-muted">
            Artistas são criados quando enviam submissões pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {artists.map((a: any) => (
        <Link key={a.id} href={`/artists/${a.id}`}>
          <Card className="hover:border-border/80 transition-colors h-full">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-fg truncate">{a.stage_name}</h3>
                {a.needs_review && (
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                )}
              </div>
              {a.legal_name && (
                <p className="text-sm text-fg-muted mb-3 truncate">{a.legal_name}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <Badge variant="secondary" className="text-[10px]">
                  {a.track_participants?.[0]?.count ?? 0} lançamentos
                </Badge>
                {a.needs_review && (
                  <Badge variant="warning" className="text-[10px]">Revisar</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const { q, precisa_revisao } = await searchParams;
  const showNeedsReview = precisa_revisao === "1";

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">Artistas</h1>
          <p className="text-sm text-fg-muted mt-1">
            Base de artistas cadastrados pelo WhatsApp e CRM
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/artists/new">
            <Plus className="h-4 w-4" />
            Novo
          </Link>
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 mb-6">
        <form className="flex-1 max-w-md" action="/artists" method="GET">
          {showNeedsReview && <input type="hidden" name="precisa_revisao" value="1" />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome artístico ou civil..."
              className="pl-9"
            />
          </div>
        </form>
        <Link
          href={showNeedsReview ? "/artists" : "/artists?precisa_revisao=1"}
          className={`px-4 py-2 rounded-md text-sm border transition-colors ${
            showNeedsReview
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-surface text-fg-muted hover:text-fg hover:border-border/80"
          }`}
        >
          Precisa revisão
        </Link>
      </div>

      {/* Grid */}
      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      }>
        <ArtistsGrid search={q} needsReview={showNeedsReview} />
      </Suspense>
    </div>
  );
}
