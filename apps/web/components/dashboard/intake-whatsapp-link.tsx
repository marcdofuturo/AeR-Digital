"use client";

import { useState } from "react";
import { Check, Clipboard, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_INTAKE_PHONE = "5511948059297";

export function buildWhatsappIntakeLink(code: string) {
  return `https://wa.me/${WHATSAPP_INTAKE_PHONE}?text=${encodeURIComponent(code)}`;
}

export function IntakeWhatsappLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = buildWhatsappIntakeLink(code);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-8 rounded-lg border border-brand/20 bg-gradient-to-r from-brand/10 to-green-900/20 p-6">
      <div className="mb-2 flex items-center gap-3">
        <Link2 className="h-5 w-5 text-brand" />
        <h2 className="font-semibold text-fg">Envie sua Música pelo WhatsApp</h2>
      </div>
      <p className="mb-3 text-sm text-fg-muted">
        Compartilhe este link com seus artistas para receber lançamentos direto no painel:
      </p>
      <div className="group flex flex-col gap-2 rounded-lg border border-border bg-bg p-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all px-2 py-2 font-mono text-sm text-brand">
          {link}
        </code>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label="Copiar link do WhatsApp"
          onClick={copyLink}
          className="shrink-0"
        >
          {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        O código <span className="font-mono text-brand">{code}</span> identifica seu selo automaticamente.
      </p>
    </div>
  );
}

