import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SaveButton } from "@/components/forms/save-button";
import { RegistrationForm } from "@/components/releases/registration-form";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import { addTrackParticipant, setReleaseStageFromForm } from "@/app/releases/actions";
import { Plus } from "lucide-react";
const REGISTRATION_ORDER = ["obra_ecad", "fonograma_ecad", "distribuicao"];

export default async function RegistrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  const [release, tenant] = await Promise.all([getRelease(tenantId, id), getTenant()]);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];
  const allObrasDone =
    tracks.length > 0 &&
    tracks.every((track: any) =>
      (track.registrations ?? []).some(
        (reg: any) => reg.kind === "obra_ecad" && reg.status === "concluido",
      ),
    );
  const allFonogramasDone =
    tracks.length > 0 &&
    tracks.every((track: any) =>
      (track.registrations ?? []).some(
        (reg: any) => reg.kind === "fonograma_ecad" && reg.status === "concluido",
      ),
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de registros</CardTitle>
          <CardDescription>
            ISWC identifica a obra. ISRC identifica o fonograma. O codigo ECAD pode ser registrado
            em ambos. Selecione a associacao ECAD correta e informe a distribuidora contratada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allObrasDone && r.stage === "registrar_obra" ? (
            <StageForm
              releaseId={id}
              stage="registrar_fonograma"
              label="Avancar para registrar fonograma"
            />
          ) : null}
          {allFonogramasDone && r.stage === "registrar_fonograma" ? (
            <StageForm
              releaseId={id}
              stage="pronto_p_distribuir"
              label="Avancar para pronto p/ distribuir"
            />
          ) : null}
          {tracks.length === 0 ? (
            <p className="text-fg-muted py-8 text-center text-sm">Nenhuma faixa cadastrada</p>
          ) : null}
        </CardContent>
      </Card>

      {tracks.map((track: any) => {
        const registrations = Object.fromEntries(
          (track.registrations ?? []).map((reg: any) => [reg.kind, reg]),
        );
        const participants = [...(track.track_participants ?? [])].sort(
          (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
        );
        const producers = participants.filter((item: any) => item.is_producer);
        const performers = participants.filter(
          (item: any) => item.is_performer && !item.is_producer,
        );
        return (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>
                {participants.length} participante(s) - {producers.length} produtor(es)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParticipantSummary
                title="Registrar obra"
                participants={participants}
                role="Autor/compositor"
              />
              <AddParticipantPanel
                releaseId={id}
                trackId={track.id}
                defaultComposer
                defaultPerformer
              />
              <div className="border-border/50 bg-bg rounded-md border p-3">
                <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                  Registrar fonograma
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Person name={tenant?.name ?? "Audiolink Brasil"} role="Produtor fonografico" />
                  {performers.map((item: any) => (
                    <Person key={item.id} name={artistName(item)} role="Interprete" />
                  ))}
                  {producers.map((item: any) => (
                    <Person key={item.id} name={artistName(item)} role="Musico acompanhante" />
                  ))}
                </div>
              </div>
              <AddParticipantPanel releaseId={id} trackId={track.id} defaultProducer />

              <div className="space-y-3">
                {REGISTRATION_ORDER.map((kind) => (
                  <RegistrationForm
                    key={kind}
                    releaseId={id}
                    trackId={track.id}
                    kind={kind}
                    registration={registrations[kind]}
                    distributor={r.distributor ?? ""}
                    upc={r.upc ?? ""}
                    isrc={track.isrc ?? ""}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StageForm({
  releaseId,
  stage,
  label,
}: {
  releaseId: string;
  stage: string;
  label: string;
}) {
  return (
    <form action={setReleaseStageFromForm}>
      <input type="hidden" name="release_id" value={releaseId} />
      <input type="hidden" name="stage" value={stage} />
      <SaveButton size="sm" pendingLabel="Avancando...">
        {label}
      </SaveButton>
    </form>
  );
}

function ParticipantSummary({
  title,
  participants,
  role,
}: {
  title: string;
  participants: any[];
  role: string;
}) {
  return (
    <div className="border-border/50 bg-bg rounded-md border p-3">
      <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {participants.map((item) => (
          <Person key={item.id} name={artistName(item)} role={role} />
        ))}
      </div>
    </div>
  );
}

function Person({ name, role }: { name: string; role: string }) {
  return (
    <div className="text-fg text-sm">
      {name}
      <span className="text-fg-muted ml-2 text-xs">{role}</span>
    </div>
  );
}

function artistName(item: any) {
  return item.artists?.legal_name ?? item.artists?.stage_name ?? "Artista";
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="text-fg-muted text-xs">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm"
      />
    </label>
  );
}

function AddParticipantPanel({
  releaseId,
  trackId,
  defaultComposer = false,
  defaultPerformer = false,
  defaultProducer = false,
}: {
  releaseId: string;
  trackId: string;
  defaultComposer?: boolean;
  defaultPerformer?: boolean;
  defaultProducer?: boolean;
}) {
  return (
    <details className="border-border/70 bg-surface/40 rounded-md border border-dashed p-3">
      <summary className="text-brand flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Plus className="h-4 w-4" />
        Adicionar participante
      </summary>
      <form action={addTrackParticipant} className="mt-3 grid gap-3 md:grid-cols-5">
        <input type="hidden" name="release_id" value={releaseId} />
        <input type="hidden" name="track_id" value={trackId} />
        <Field
          name="stage_name"
          label="Nome artistico"
          defaultValue=""
          placeholder="Nome no credito"
        />
        <Field name="legal_name" label="Nome completo" defaultValue="" placeholder="Nome civil" />
        <Field name="ecad_code" label="Codigo ECAD" defaultValue="" placeholder="ECAD" />
        <label className="text-fg-muted text-xs">
          Papel
          <select
            name="billing_role"
            defaultValue=""
            className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Automatico pela ordem</option>
            <option value="primary">Primario</option>
            <option value="featuring">Featuring</option>
          </select>
        </label>
        <div className="text-fg-muted space-y-1 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_composer"
              defaultChecked={defaultComposer}
              className="accent-brand"
            />
            Compositor
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_performer"
              defaultChecked={defaultPerformer}
              className="accent-brand"
            />
            Interprete
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_producer"
              defaultChecked={defaultProducer}
              className="accent-brand"
            />
            Produtor
          </label>
          <SaveButton
            size="sm"
            className="mt-2 w-full"
            pendingLabel="Adicionando..."
            savedLabel="Adicionado"
          >
            Adicionar
          </SaveButton>
        </div>
      </form>
    </details>
  );
}
