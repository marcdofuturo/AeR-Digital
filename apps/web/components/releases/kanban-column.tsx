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
      className={`flex flex-col w-[280px] shrink-0 rounded-lg border transition-colors ${
        isOver ? "border-brand bg-brand/5" : "border-border bg-surface/50"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <span className="text-xs font-semibold text-fg uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] text-fg-muted bg-surface-2 px-1.5 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-260px)]">
        <div className="flex flex-col gap-2 p-2 min-h-[60px]">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
