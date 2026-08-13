"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditMetadataButton({ formId }: { formId: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => {
        const field = document.querySelector<HTMLInputElement>(`input[form="${formId}"]`);
        field?.focus();
        field?.select();
      }}
    >
      <Pencil className="h-4 w-4" />
      Editar
    </Button>
  );
}
