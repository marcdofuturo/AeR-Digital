"use client";

import { useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthorizationDocumentData, AuthorizationSplitRow } from "@/lib/docs/authorization-document";
import { buildAuthorizationSections } from "@/lib/docs/authorization-document";
import { buildAuthorizationClipboardPayload } from "@/lib/docs/authorization-clipboard";

export function AuthorizationDocumentPreview({ data }: { data: AuthorizationDocumentData }) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyDocument() {
    setCopyState("copying");
    const payload = buildAuthorizationClipboardPayload(data);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([payload.html], { type: "text/html" }),
            "text/plain": new Blob([payload.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(payload.text);
      }
      setCopyState("copied");
    } catch {
      try {
        await navigator.clipboard.writeText(payload.text);
        setCopyState("copied");
      } catch {
        setCopyState("error");
      }
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
        <span aria-live="polite" className="text-xs text-fg-muted">
          {copyState === "error" ? "Nao foi possivel copiar" : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={copyState === "copying"}
          onClick={copyDocument}
          aria-label="Copiar autorizacao formatada"
        >
          {copyState === "copying" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copyState === "copied" ? <Check aria-hidden /> : null}
          {copyState === "idle" || copyState === "error" ? <Copy aria-hidden /> : null}
          {copyState === "copied" ? "Copiado" : copyState === "copying" ? "Copiando..." : "Copiar texto"}
        </Button>
      </div>
      <article className="rounded-md border border-border bg-[#111418] px-8 py-10 text-[15px] leading-7 text-fg shadow-xl sm:px-12">
        {buildAuthorizationSections(data).map((section, index) => {
        if (section.kind === "paragraph") {
          return <p key={index} className="mb-4 whitespace-pre-wrap">{section.text}</p>;
        }

        if (section.kind === "heading") {
          return <h2 key={index} className="mb-4 mt-7 text-base font-bold text-fg">{section.text}</h2>;
        }

        if (section.kind === "kvTable") {
          return (
            <table key={index} className="mb-7 w-full border-collapse text-sm">
              <tbody>
                {section.rows.map(([label, value]) => (
                  <tr key={label}>
                    <th className="w-48 border border-border bg-surface px-3 py-2 text-left font-semibold text-fg">{label}</th>
                    <td className="border border-border px-3 py-2 text-fg">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }

        if (section.kind === "splitTable") {
          return <SplitTable key={index} title={section.title} rows={section.rows} />;
        }

        return (
          <ul key={index} className="mb-5 list-disc space-y-1 pl-5">
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        );
        })}
      </article>
    </div>
  );
}

function SplitTable({ title, rows }: { title: string; rows: AuthorizationSplitRow[] }) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 text-base font-bold text-fg">{title}</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface">
            <th className="w-14 border border-border px-3 py-2 text-left font-semibold text-fg">ID</th>
            <th className="border border-border px-3 py-2 text-left font-semibold text-fg">Artista</th>
            <th className="border border-border px-3 py-2 text-left font-semibold text-fg">Classe</th>
            <th className="w-36 border border-border px-3 py-2 text-left font-semibold text-fg">Participação (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.id}`}>
              <td className="border border-border px-3 py-2 text-fg-muted">{row.id}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.artist}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.role}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.percent}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-border px-3 py-2" />
            <td className="border border-border px-3 py-2" />
            <td className="border border-border px-3 py-2 font-bold text-fg">Total:</td>
            <td className="border border-border px-3 py-2 font-bold text-fg">100%</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
