"use client";

import { useState } from "react";
import { Download, Expand, Image as ImageIcon, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ReleaseCoverViewerProps = {
  title: string;
  available: boolean;
  previewUrl: string;
  downloadUrl: string;
};

export function ReleaseCoverViewer({
  title,
  available,
  previewUrl,
  downloadUrl,
}: ReleaseCoverViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);

  if (!available) {
    return (
      <div className="border-border text-fg-muted grid h-16 w-16 place-items-center rounded-md border border-dashed">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setZoom(1);
          setExpanded(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Visualizar capa"
          className="group border-border bg-bg focus-visible:ring-brand/60 relative h-16 w-16 overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
        >
          <img
            src={previewUrl}
            alt={`Capa de ${title}`}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/0 text-transparent transition-colors group-hover:bg-black/35 group-hover:text-white">
            <Expand className="h-4 w-4" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 transition-[max-width,height]",
          expanded ? "h-[94vh] max-w-[94vw]" : "max-w-4xl",
        )}
      >
        <DialogHeader className="border-border border-b px-5 py-4 pr-12">
          <DialogTitle>Capa de {title}</DialogTitle>
          <DialogDescription>
            Amplie, reduza ou baixe o arquivo sem sair desta página.
          </DialogDescription>
        </DialogHeader>
        <div className="border-border bg-bg flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Reduzir"
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-fg-muted w-14 text-center text-xs tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Ampliar"
              onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setZoom(1)}>
              100%
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((value) => !value)}
            >
              <Expand className="h-4 w-4" />
              {expanded ? "Restaurar" : "Expandir"}
            </Button>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={downloadUrl} download>
              <Download className="h-4 w-4" />
              Baixar capa
            </a>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-black/80 p-5">
          <div className="grid min-h-[28rem] place-items-center">
            <img
              src={previewUrl}
              alt={`Capa de ${title}`}
              className="max-h-[72vh] max-w-full origin-center object-contain transition-transform duration-150"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
