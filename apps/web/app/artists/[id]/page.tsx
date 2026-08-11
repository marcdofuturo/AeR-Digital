import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArtist } from "@/lib/data/artists";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { ArrowLeft, Music, Mail, Phone, ExternalLink, AlertTriangle } from "lucide-react";

const STAGE_LABEL = Object.fromEntries(KANBAN_STAGES.map((stage) => [stage.id, stage.label]));

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) notFound();

  const artist = await getArtist(tenantId, id);
  if (!artist) notFound();

  const a = artist as any;
  const contacts = a.artist_contacts ?? [];
  const participations = a.track_participants ?? [];

  const releaseMap = new Map<string, { id: string; title: string; release_date: string; stage: string; track_title: string }>();
  for (const tp of participations) {
    const t = tp.tracks;
    if (!t) continue;
    const rel = t.releases;
    if (!rel) continue;
    releaseMap.set(t.release_id ?? t.track_id, {
      id: rel.release_id ?? t.release_id,
      title: rel.title ?? "-",
      release_date: rel.release_date,
      stage: rel.stage,
      track_title: t.title,
    });
  }
  const releases = Array.from(releaseMap.values()).sort(
    (a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime(),
  );

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/artists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-fg">{a.stage_name}</h1>
            {a.needs_review && <AlertTriangle className="h-5 w-5 text-warning" />}
          </div>
          {a.legal_name && (
            <p className="text-fg-muted mt-1">{a.legal_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {a.legal_name && (
                <div>
                  <span className="text-xs text-fg-muted">Nome civil</span>
                  <p className="text-sm text-fg">{a.legal_name}</p>
                </div>
              )}
              {a.cpf_cnpj && (
                <div>
                  <span className="text-xs text-fg-muted">CPF/CNPJ</span>
                  <p className="text-sm text-fg font-mono">{a.cpf_cnpj}</p>
                </div>
              )}
              {a.ecad_code && (
                <div>
                  <span className="text-xs text-fg-muted">Código ECAD</span>
                  <p className="text-sm text-fg font-mono">{a.ecad_code}</p>
                </div>
              )}
              {a.pro_affiliation && (
                <div>
                  <span className="text-xs text-fg-muted">PRO / Afiliação</span>
                  <p className="text-sm text-fg">{a.pro_affiliation}</p>
                </div>
              )}
              {a.spotify_url && (
                <div>
                  <span className="text-xs text-fg-muted">Spotify</span>
                  <a href={a.spotify_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                    {a.spotify_id ?? "Perfil"} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="flex gap-2 text-xs text-fg-muted">
                <span>Cadastrado em {fmtDate(a.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          {contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contatos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      {c.kind === "email" ? (
                        <Mail className="h-4 w-4 text-fg-muted" />
                      ) : (
                        <Phone className="h-4 w-4 text-fg-muted" />
                      )}
                      <span className="text-fg">{c.value}</span>
                      {c.is_primary && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                      {c.label && <span className="text-xs text-fg-muted">({c.label})</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" />
              Catálogo ({releases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {releases.length === 0 ? (
              <p className="text-sm text-fg-muted py-8 text-center">Nenhum lançamento associado</p>
            ) : (
              <div className="space-y-1">
                {releases.map((rel) => (
                  <Link key={rel.id} href={`/releases/${rel.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-md hover:bg-surface-2/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-fg">{rel.title}</p>
                        <p className="text-xs text-fg-muted">{rel.track_title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABEL[rel.stage] ?? rel.stage}
                        </Badge>
                        <span className="text-xs text-fg-muted">
                          {fmtDate(rel.release_date, "dd/MM/yyyy")}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
