"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveButton } from "./save-button";

type EditableActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  hiddenFields?: ReactNode;
  editLabel?: string;
  saveLabel?: string;
  savedLabel?: string;
  className?: string;
  fieldsClassName?: string;
  controlsClassName?: string;
};

export function EditableActionForm({
  action,
  children,
  hiddenFields,
  editLabel = "Editar",
  saveLabel = "Salvar",
  savedLabel = "Salvo",
  className,
  fieldsClassName,
  controlsClassName = "flex justify-end gap-2",
}: EditableActionFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className={className}
      action={async (formData) => {
        setSaving(true);
        try {
          await action(formData);
          setSaved(true);
          window.setTimeout(() => {
            setSaved(false);
            setEditing(false);
          }, 700);
        } finally {
          setSaving(false);
        }
      }}
    >
      {hiddenFields}
      <fieldset disabled={!editing || saving || saved} className={fieldsClassName}>
        {children}
      </fieldset>
      <div className={controlsClassName}>
        {editing ? (
          <>
            <Button
              type="reset"
              size="sm"
              variant="cancel"
              disabled={saving || saved}
              onClick={() => setEditing(false)}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <SaveButton
              size="sm"
              variant="success"
              savedLabel={savedLabel}
              disabled={saving || saved}
            >
              {saveLabel}
            </SaveButton>
          </>
        ) : (
          <Button type="button" size="sm" variant="edit" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {editLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
