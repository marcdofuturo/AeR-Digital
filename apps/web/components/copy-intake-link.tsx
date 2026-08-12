"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyIntakeLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar link"
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-bg px-4 py-3 text-left font-mono text-sm text-brand transition-colors hover:border-brand/60"
    >
      <span className="break-all">{value}</span>
      {copied ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0" />}
    </button>
  );
}
