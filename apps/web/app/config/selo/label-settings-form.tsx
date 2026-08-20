"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { SaveButton } from "@/components/forms/save-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/lib/tenant";
import { INITIAL_CONFIG_ACTION_STATE } from "../action-state";
import { updateLabelSettings } from "../actions";

export function LabelSettingsForm({ tenant }: { tenant: Tenant }) {
  const [state, action] = useActionState(updateLabelSettings, INITIAL_CONFIG_ACTION_STATE);
  const [editing, setEditing] = useState(false);
  const previousState = useRef(state);

  useEffect(() => {
    if (previousState.current === state) return undefined;
    previousState.current = state;
    if (state.status !== "success") return undefined;
    const timer = window.setTimeout(() => setEditing(false), 700);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field
        id="label-name"
        name="name"
        label="Nome do selo"
        defaultValue={tenant.name}
        required
        disabled={!editing}
      />
      <Field id="label-code" label="Codigo do selo" defaultValue={tenant.intake_code} disabled />
      <Field
        id="label-legal-name"
        name="legal_name"
        label="Razao social"
        defaultValue={tenant.legal_name ?? ""}
        disabled={!editing}
      />
      <Field
        id="label-cnpj"
        name="cnpj"
        label="CNPJ"
        defaultValue={tenant.cnpj ?? ""}
        disabled={!editing}
      />
      <Field
        id="label-responsible"
        name="responsible_name"
        label="Responsavel"
        defaultValue={tenant.responsible_name ?? ""}
        disabled={!editing}
      />
      <Field
        id="label-email"
        name="contact_email"
        label="Email de contato"
        type="email"
        defaultValue={tenant.contact_email ?? ""}
        disabled={!editing}
      />
      <Field
        id="label-phone"
        name="contact_phone"
        label="Telefone de contato"
        type="tel"
        defaultValue={tenant.contact_phone ?? ""}
        disabled={!editing}
      />
      <Field
        id="label-logo"
        name="logo_url"
        label="URL do logotipo"
        type="url"
        defaultValue={tenant.logo_url ?? ""}
        className="md:col-span-2"
        disabled={!editing}
      />
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        {editing ? (
          <>
            <Button type="reset" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <SaveButton
              resultStatus={state.status}
              pendingLabel="Salvando selo..."
              savedLabel="Selo atualizado"
            >
              Salvar dados do selo
            </SaveButton>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Editar dados do selo
          </Button>
        )}
        <p
          aria-live="polite"
          className={cn("text-xs", state.status === "error" ? "text-danger" : "text-success")}
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <label className={cn("text-fg-muted flex flex-col gap-1.5 text-sm", className)} htmlFor={id}>
      {label}
      <Input id={id} {...props} />
    </label>
  );
}
