"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { SaveButton } from "@/components/forms/save-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { INITIAL_CONFIG_ACTION_STATE, inviteTeamMember } from "../actions";

export function InviteMemberForm() {
  const [state, action] = useActionState(inviteTeamMember, INITIAL_CONFIG_ACTION_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus aria-hidden />
          Adicionar membro
        </CardTitle>
        <CardDescription>O convite sera enviado por email com o nivel escolhido.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-fg-muted" htmlFor="member-name">
            Nome completo
            <Input id="member-name" name="full_name" autoComplete="name" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-fg-muted" htmlFor="member-email">
            Email
            <Input id="member-email" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-fg-muted" htmlFor="member-role">
            Nivel de permissao
            <select
              id="member-role"
              name="role"
              defaultValue="ar"
              className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <option value="ar">A&amp;R - operacao de catalogo</option>
              <option value="financeiro">Financeiro - relatorios e repasses</option>
              <option value="viewer">Viewer - somente leitura</option>
            </select>
          </label>
          <div className="flex flex-col items-start justify-end gap-2">
            <SaveButton resultStatus={state.status} pendingLabel="Enviando convite..." savedLabel="Convite enviado">
              Convidar membro
            </SaveButton>
            <p aria-live="polite" className={cn("min-h-5 text-xs", state.status === "error" ? "text-danger" : "text-success")}>
              {state.message}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
