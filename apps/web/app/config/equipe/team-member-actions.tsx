"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, ShieldCheck, UserMinus, X } from "lucide-react";
import { SaveButton } from "@/components/forms/save-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INITIAL_CONFIG_ACTION_STATE } from "../action-state";
import { removeTeamMember, updateTeamMemberRole } from "../actions";

export function TeamMemberActions({
  userId,
  memberName,
  role,
}: {
  userId: string;
  memberName: string;
  role: "ar" | "financeiro" | "viewer";
}) {
  const [updateState, updateAction] = useActionState(
    updateTeamMemberRole,
    INITIAL_CONFIG_ACTION_STATE,
  );
  const [removeState, removeAction] = useActionState(removeTeamMember, INITIAL_CONFIG_ACTION_STATE);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const previousUpdateState = useRef(updateState);

  useEffect(() => {
    if (removeState.status === "success") setRemoveOpen(false);
  }, [removeState.status]);

  useEffect(() => {
    if (previousUpdateState.current === updateState) return undefined;
    previousUpdateState.current = updateState;
    if (updateState.status !== "success") return undefined;
    const timer = window.setTimeout(() => setEditingRole(false), 700);
    return () => window.clearTimeout(timer);
  }, [updateState]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={updateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <label className="sr-only" htmlFor={`role-${userId}`}>
          Permissao de {memberName}
        </label>
        <select
          id={`role-${userId}`}
          name="role"
          defaultValue={role}
          disabled={!editingRole}
          className="border-border bg-bg text-fg h-9 rounded-md border px-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
        >
          <option value="ar">A&amp;R</option>
          <option value="financeiro">Financeiro</option>
          <option value="viewer">Viewer</option>
        </select>
        {editingRole ? (
          <>
            <Button type="reset" size="sm" variant="ghost" onClick={() => setEditingRole(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <SaveButton
              size="sm"
              variant="outline"
              resultStatus={updateState.status}
              pendingLabel="Salvando..."
              savedLabel="Permissao salva"
            >
              <ShieldCheck className="h-4 w-4" />
              Salvar permissao
            </SaveButton>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingRole(true)}>
            <Pencil className="h-4 w-4" />
            Editar permissao
          </Button>
        )}
      </form>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-danger"
        onClick={() => setRemoveOpen(true)}
      >
        <UserMinus className="h-4 w-4" />
        Retirar acesso
      </Button>
      <p
        aria-live="polite"
        className={updateState.status === "error" ? "text-danger text-xs" : "sr-only"}
      >
        {updateState.message}
      </p>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar acesso de {memberName}?</DialogTitle>
            <DialogDescription>
              O acesso a este selo sera revogado. A conta do usuario nao sera apagada.
            </DialogDescription>
          </DialogHeader>
          <form action={removeAction}>
            <input type="hidden" name="user_id" value={userId} />
            {removeState.status === "error" ? (
              <p className="text-danger mb-3 text-sm">{removeState.message}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)}>
                Cancelar
              </Button>
              <SaveButton
                variant="destructive"
                resultStatus={removeState.status}
                pendingLabel="Removendo..."
              >
                Retirar acesso
              </SaveButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
