"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveButton } from "./save-button";

export function EditMetadataButton({ formId }: { formId: string }) {
  const [editing, setEditing] = useState(false);
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  const setFieldsDisabled = useCallback(
    (disabled: boolean) => {
      document
        .querySelectorAll<HTMLInputElement>(`input[form="${formId}"][data-editable]`)
        .forEach((field) => {
          field.disabled = disabled;
        });
    },
    [formId],
  );

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return undefined;
    }
    if (!wasPending.current) return undefined;
    wasPending.current = false;
    setFieldsDisabled(true);
    const timer = window.setTimeout(() => setEditing(false), 700);
    return () => window.clearTimeout(timer);
  }, [pending, setFieldsDisabled]);

  if (editing) {
    return (
      <>
        <Button
          type="reset"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            document.querySelector<HTMLFormElement>(`form#${formId}`)?.reset();
            setFieldsDisabled(true);
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
          Cancelar
        </Button>
        <SaveButton size="sm" variant="outline" savedLabel="Salvo">
          Salvar
        </SaveButton>
      </>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => {
        setFieldsDisabled(false);
        setEditing(true);
        const field = document.querySelector<HTMLInputElement>(
          `input[form="${formId}"][data-editable]`,
        );
        field?.focus();
        field?.select();
      }}
    >
      <Pencil className="h-4 w-4" />
      Editar
    </Button>
  );
}
