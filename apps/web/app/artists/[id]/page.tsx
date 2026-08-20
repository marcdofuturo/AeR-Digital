import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getArtist, mapArtistReleases } from "@/lib/data/artists";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { EditableActionForm } from "@/components/forms/editable-action-form";
import { saveArtistProfile } from "@/app/artists/actions";
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
  const releaseEmail = primaryContact(contacts, "email");
  const phone = primaryContact(contacts, "whatsapp");
  const releases = mapArtistReleases(a.track_participants ?? []);

  return (
    <div className="max-w-[1200px] p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/artists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-fg text-2xl font-bold">{a.stage_name}</h1>
            {a.needs_review && <AlertTriangle className="text-warning h-5 w-5" />}
          </div>
          {a.legal_name && <p className="text-fg-muted mt-1">{a.legal_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableActionForm
                action={saveArtistProfile}
                fieldsClassName="space-y-3"
                editLabel="Editar dados do artista"
                saveLabel="Salvar artista"
                savedLabel="Artista salvo"
                hiddenFields={<input type="hidden" name="artist_id" value={a.id} />}
              >
                <ProfileField
                  label="Nome artistico"
                  name="stage_name"
                  value={a.stage_name}
                  required
                />
                <ProfileField label="Nome completo" name="legal_name" value={a.legal_name} />
                <ProfileField label="Codigo ECAD" name="ecad_code" value={a.ecad_code} />
                <ProfileField
                  label="Email de liberacao"
                  name="release_email"
                  type="email"
                  value={releaseEmail}
                />
                <ProfileField label="Telefone de contato" name="phone" value={phone} />
              </EditableActionForm>
              <Info label="Nome civil" value={a.legal_name} />
              <Info label="CPF/CNPJ" value={a.cpf_cnpj} mono />
              <Info label="Código ECAD" value={a.ecad_code} mono />
              <Info label="PRO / Associação" value={a.pro_affiliation} />
              {a.spotify_url && (
                <div>
                  <span className="text-fg-muted text-xs">Spotify</span>
                  <a
                    href={a.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand flex items-center gap-1 text-sm hover:underline"
                  >
                    {a.spotify_id ?? "Perfil"} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="text-fg-muted flex gap-2 text-xs">
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
                        <Mail className="text-fg-muted h-4 w-4" />
                      ) : (
                        <Phone className="text-fg-muted h-4 w-4" />
                      )}
                      <span className="text-fg">{c.value}</span>
                      {c.is_primary && (
                        <Badge variant="outline" className="text-[10px]">
                          Principal
                        </Badge>
                      )}
                      {c.label && <span className="text-fg-muted text-xs">({c.label})</span>}
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
              <p className="text-fg-muted py-8 text-center text-sm">Nenhuma música associada</p>
            ) : (
              <div className="space-y-1">
                {releases.map((rel) => (
                  <Link key={`${rel.id}-${rel.track_title}`} href={`/releases/${rel.id}`}>
                    <div className="hover:bg-surface-2/50 flex items-center justify-between rounded-md p-3 transition-colors">
                      <div>
                        <p className="text-fg text-sm font-medium">{rel.track_title}</p>
                        <p className="text-fg-muted text-xs">{rel.title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABEL[rel.stage] ?? rel.stage}
                        </Badge>
                        <span className="text-fg-muted text-xs">
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

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <span className="text-fg-muted text-xs">{label}</span>
      <p className={`text-fg text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ProfileField({
  label,
  name,
  value,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-fg-muted block text-xs">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        placeholder={`Adicionar ${label.toLowerCase()}`}
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
      />
    </label>
  );
}

function primaryContact(contacts: any[], kind: "email" | "whatsapp") {
  const matching = contacts.filter((contact) => contact.kind === kind);
  return matching.find((contact) => contact.is_primary)?.value ?? matching[0]?.value ?? "";
}
