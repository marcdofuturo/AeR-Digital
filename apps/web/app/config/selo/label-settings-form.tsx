"use client";

import { useActionState } from "react";
import { SaveButton } from "@/components/forms/save-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/lib/tenant";
import { INITIAL_CONFIG_ACTION_STATE, updateLabelSettings } from "../actions";

export function LabelSettingsForm({ tenant }: { tenant: Tenant }) {
  const [state, action] = useActionState(updateLabelSettings, INITIAL_CONFIG_ACTION_STATE);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field id="label-name" name="name" label="Nome do selo" defaultValue={tenant.name} required />
      <Field id="label-legal-name" name="legal_name" label="Razao social" defaultValue={tenant.legal_name ?? ""} />
      <Field id="label-cnpj" name="cnpj" label="CNPJ" defaultValue={tenant.cnpj ?? ""} />
      <Field id="label-responsible" name="responsible_name" label="Responsavel" defaultValue={tenant.responsible_name ?? ""} />
      <Field id="label-email" name="contact_email" label="Email de contato" type="email" defaultValue={tenant.contact_email ?? ""} />
      <Field id="label-phone" name="contact_phone" label="Telefone de contato" type="tel" defaultValue={tenant.contact_phone ?? ""} />
      <Field id="label-logo" name="logo_url" label="URL do logotipo" type="url" defaultValue={tenant.logo_url ?? ""} className="md:col-span-2" />
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <SaveButton pendingLabel="Salvando selo..." savedLabel="Selo atualizado">Salvar dados do selo</SaveButton>
        <p aria-live="polite" className={cn("text-xs", state.status === "error" ? "text-danger" : "text-success")}>
          {state.message}
        </p>
      </div>
    </form>
  );
}

function Field({ id, label, className, ...props }: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm text-fg-muted", className)} htmlFor={id}>
      {label}
      <Input id={id} {...props} />
    </label>
  );
}
