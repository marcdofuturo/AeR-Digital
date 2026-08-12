import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArtist, mapArtistReleases } from "@/lib/data/artists";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { AlertTriangle, ArrowLeft, ExternalLink, Mail, Music, Phone } from "lucide-react";

const STAGE_LABEL = Object.fromEntries(KANBAN_STAGES.map((stage) => [stage.id, stage.label]));

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) notFound();

  const artist = await getArtist(tenantId, id);
  if (!artist) notFound();

  const a = artist as any;
  const contacts = a.artist_contacts ?? [];
  const releases = mapArtistReleases(a.track_participants ?? []);

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="mb-8 flex items-center gap-4">
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
            <p className="mt-1 text-fg-muted">{a.legal_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Nome civil" value={a.legal_name} />
              <Info label="CPF/CNPJ" value={a.cpf_cnpj} mono />
              <Info label="Código ECAD" value={a.ecad_code} mono />
              <Info label="PRO / Associação" value={a.pro_affiliation} />
              {a.spotify_url && (
                <div>
                  <span className="text-xs text-fg-muted">Spotify</span>
                  <a href={a.spotify_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-brand hover:underline">
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              Músicas ({releases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {releases.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">Nenhuma música associada</p>
            ) : (
              <div className="space-y-1">
                {releases.map((rel) => (
                  <Link key={`${rel.id}-${rel.track_title}`} href={`/releases/${rel.id}`}>
                    <div className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-surface-2/50">
                      <div>
                        <p className="text-sm font-medium text-fg">{rel.track_title}</p>
                        <p className="text-xs text-fg-muted">{rel.title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABEL[rel.stage] ?? rel.stage}
                        </Badge>
                        <span className="text-xs text-fg-muted">
                          {rel.release_date ? fmtDate(rel.release_date, "dd/MM/yyyy") : "-"}
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

function Info({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-fg-muted">{label}</span>
      <p className={`text-sm text-fg ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

