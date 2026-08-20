"use client";

import { AlertTriangle, CheckCheck, Clock, XCircle } from "lucide-react";
import { saveRegistrationStatus } from "@/app/releases/actions";
import { EditableActionForm } from "@/components/forms/editable-action-form";
import { Badge } from "@/components/ui/badge";
import { normalizeRegistrationStatus } from "@/lib/registration-status";
import { fmtDate } from "@ar/shared";

const REG_LABELS: Record<string, string> = {
  obra_ecad: "Status da obra",
  fonograma_ecad: "Status do fonograma",
  distribuicao: "Distribuicao",
};

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "danger"> = {
  pendente: "secondary",
  em_andamento: "warning",
  concluido: "success",
  rejeitado: "danger",
};

type Registration = {
  status?: string | null;
  entity?: string | null;
  external_id?: string | null;
  ecad_code?: string | null;
  notes?: string | null;
  due_at?: string | null;
};

export function RegistrationForm({
  releaseId,
  trackId,
  kind,
  registration,
  distributor,
  upc,
  isrc,
}: {
  releaseId: string;
  trackId: string;
  kind: string;
  registration?: Registration | null;
  distributor: string;
  upc: string;
  isrc: string;
}) {
  const status = normalizeRegistrationStatus(registration?.status);
  const isDistribution = kind === "distribuicao";
  const externalLabel = kind === "obra_ecad" ? "ISWC" : kind === "fonograma_ecad" ? "ISRC" : "UPC";
  const entity =
    registration?.entity ?? (isDistribution ? distributor || "Audiolink Brasil" : "UBC");
  const externalId =
    registration?.external_id ?? (isDistribution ? upc : kind === "fonograma_ecad" ? isrc : "");
  const label = REG_LABELS[kind] ?? "Registro";

  return (
    <EditableActionForm
      action={saveRegistrationStatus}
      className="border-border/50 bg-bg rounded-md border p-3"
      fieldsClassName="grid gap-3 md:grid-cols-5"
      controlsClassName="mt-3 flex justify-end gap-2"
      editLabel={`Editar ${label.toLowerCase()}`}
      saveLabel="Salvar registro"
      savedLabel="Registro salvo"
      hiddenFields={
        <>
          <input type="hidden" name="release_id" value={releaseId} />
          <input type="hidden" name="track_id" value={trackId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon status={status} />
              <div>
                <p className="text-fg text-sm font-medium">{label}</p>
                {kind === "obra_ecad" && status === "concluido" && registration?.due_at ? (
                  <p className="text-warning text-xs">
                    Verificar aceite/ISWC em {fmtDate(registration.due_at, "dd/MM/yyyy")}
                  </p>
                ) : null}
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className="w-fit text-xs">
              {status === "em_andamento" ? "em andamento" : status}
            </Badge>
          </div>
        </>
      }
    >
      <label className="text-fg-muted text-xs">
        Status
        <select
          name="status"
          defaultValue={status}
          className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluido</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
      </label>
      {isDistribution ? (
        <Field
          name="entity"
          label="Distribuidora"
          defaultValue={entity}
          placeholder="Audiolink Brasil"
        />
      ) : (
        <label className="text-fg-muted text-xs">
          Associacao
          <select
            name="entity"
            defaultValue={entity === "Abramus" ? "Abramus" : "UBC"}
            className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
          >
            <option value="UBC">UBC</option>
            <option value="Abramus">Abramus</option>
          </select>
        </label>
      )}
      <Field
        name="external_id"
        label={externalLabel}
        defaultValue={externalId}
        placeholder={externalLabel}
      />
      {!isDistribution ? (
        <Field
          name="ecad_code"
          label="Codigo ECAD"
          defaultValue={registration?.ecad_code ?? ""}
          placeholder="Codigo ECAD"
        />
      ) : (
        <span />
      )}
      <Field
        name="notes"
        label="Observacao"
        defaultValue={registration?.notes ?? ""}
        placeholder="Detalhes do cadastro"
      />
    </EditableActionForm>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "concluido") return <CheckCheck className="text-success h-4 w-4" />;
  if (status === "em_andamento") return <Clock className="text-warning h-4 w-4" />;
  if (status === "rejeitado") return <XCircle className="text-danger h-4 w-4" />;
  return <AlertTriangle className="text-fg-muted h-4 w-4" />;
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
        className="border-border bg-surface text-fg mt-1 w-full rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
      />
    </label>
  );
}
