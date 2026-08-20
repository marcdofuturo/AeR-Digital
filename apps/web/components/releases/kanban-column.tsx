"use client";

import { useDroppable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  count: number;
  children: ReactNode;
}

export function KanbanColumn({ id, label, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[min(280px,calc(100vw-2rem))] shrink-0 flex-col rounded-lg border transition-colors ${
        isOver ? "border-brand bg-brand/5" : "border-border bg-surface/50"
      }`}
    >
      {/* Column header */}
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-fg text-xs font-semibold tracking-wider uppercase">{label}</span>
        <span className="text-fg-muted bg-surface-2 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">
          {count}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="max-h-[calc(100dvh-230px)] flex-1 sm:max-h-[calc(100vh-260px)]">
        <div className="flex min-h-[60px] flex-col gap-2 p-2">{children}</div>
      </ScrollArea>
    </div>
  );
}
