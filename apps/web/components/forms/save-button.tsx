"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type SaveButtonProps = ButtonProps & {
  pendingLabel?: string;
  savedLabel?: string;
  resultStatus?: "idle" | "success" | "error";
};

export function SaveButton({
  children,
  pendingLabel = "Salvando...",
  savedLabel = "Salvo",
  resultStatus,
  disabled,
  ...props
}: SaveButtonProps) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setSaved(false);
      return undefined;
    }

    if (resultStatus === "error") {
      wasPending.current = false;
      setSaved(false);
      return undefined;
    }

    if (wasPending.current) {
      wasPending.current = false;
      setSaved(true);
      const timer = window.setTimeout(() => setSaved(false), 1800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pending, resultStatus]);

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      data-state={pending ? "pending" : saved ? "saved" : "idle"}
      {...props}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-success" /> : null}
      {pending ? pendingLabel : saved ? savedLabel : children}
    </Button>
  );
}
