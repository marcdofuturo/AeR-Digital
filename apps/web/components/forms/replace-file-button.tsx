"use client";

import { useRef } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReplaceFileButtonProps = {
  name: string;
  accept: string;
  label: string;
  disabled?: boolean;
};

export function ReplaceFileButton({
  name,
  accept,
  label,
  disabled = false,
}: ReplaceFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <RefreshCw className="h-4 w-4" />
        {label}
      </Button>
    </>
  );
}
