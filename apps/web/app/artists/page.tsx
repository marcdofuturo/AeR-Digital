import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getArtists } from "@/lib/data/artists";
import { getCurrentTenantId } from "@/lib/tenant";
import { AlertTriangle, MicVocal, Plus, Search } from "lucide-react";

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
          <div className="mb-3 flex justify-center">
            <MicVocal className="h-10 w-10 text-fg-muted" />
          </div>
          <p className="mb-1 text-fg-muted">Nenhum artista encontrado</p>
          <p className="text-sm text-fg-muted">
            Artistas são criados quando enviam submissões pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {artists.map((artist: any) => {
        const participations = artist.track_participants ?? [];

        return (
          <Link key={artist.id} href={`/artists/${artist.id}`}>
            <Card className="h-full transition-colors hover:border-border/80">
              <CardContent className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="truncate font-semibold text-fg">{artist.stage_name}</h3>
                  {artist.needs_review && (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  )}
                </div>

                {artist.legal_name && (
                  <p className="mb-3 truncate text-sm text-fg-muted">{artist.legal_name}</p>
                )}

                <div className="mb-3 space-y-1">
                  {participations.slice(0, 3).map((tp: any) => (
                    <p key={tp.track_id} className="truncate text-xs text-fg-muted">
                      {tp.tracks?.title ?? "Música sem título"}
                    </p>
                  ))}
                  {participations.length > 3 && (
                    <p className="text-xs text-fg-muted">
                      +{participations.length - 3} música(s)
                    </p>
                  )}
                  {participations.length === 0 && (
                    <p className="text-xs text-fg-muted">Sem músicas vinculadas</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <Badge variant="secondary" className="text-[10px]">
                    {participations.length} música(s)
                  </Badge>
                  {artist.needs_review && (
                    <Badge variant="warning" className="text-[10px]">Revisar</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const { q, precisa_revisao } = await searchParams;
  const showNeedsReview = precisa_revisao === "1";
  const artistsGrid = await ArtistsGrid({ search: q, needsReview: showNeedsReview });

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Artistas</h1>
          <p className="mt-1 text-sm text-fg-muted">
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

      <div className="mb-6 flex gap-3">
        <form className="max-w-md flex-1" action="/artists" method="GET">
          {showNeedsReview && <input type="hidden" name="precisa_revisao" value="1" />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
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
          className={`rounded-md border px-4 py-2 text-sm transition-colors ${
            showNeedsReview
              ? "border-brand bg-brand/10 text-brand"
              : "border-border bg-surface text-fg-muted hover:border-border/80 hover:text-fg"
          }`}
        >
          Precisa revisão
        </Link>
      </div>

      {artistsGrid}
    </div>
  );
}

