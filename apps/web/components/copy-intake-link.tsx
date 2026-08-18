"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyIntakeLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={copy}
      title="Copiar link"
      className="h-auto w-full justify-between gap-3 rounded-lg bg-bg px-4 py-3 text-left font-mono text-sm text-brand hover:border-brand/60"
    >
      <span className="break-all">{value}</span>
      {copied ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0" />}
    </Button>
  );
}
