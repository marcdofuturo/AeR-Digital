"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDaysInStage, deadlineColor } from "@ar/ai/crm";
import { AlertTriangle, Clock, Users } from "lucide-react";

export interface KanbanCardData {
  id: string;
  title: string;
  artists: string[];
  releaseDate: string;
  stage: string;
  daysInStage: number;
}

interface Props {
  card: KanbanCardData;
}

export function KanbanCard({ card }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: card,
  });

  const deadline = new Date(card.releaseDate);
  const isUrgent = deadlineColor(card.releaseDate) === "red";
  const daysLabel = formatDaysInStage(card.daysInStage);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={`p-3 cursor-grab active:cursor-grabbing transition-shadow ${
          isDragging ? "opacity-50 shadow-lg" : "hover:shadow-md"
        } ${isUrgent ? "border-danger/50 ring-1 ring-danger/20" : ""}`}
      >
        <div className="space-y-2">
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-fg leading-snug line-clamp-2">
              {card.title}
            </p>
            {isUrgent && <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0 mt-0.5" />}
          </div>

          {/* Artists */}
          {card.artists.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-fg-muted truncate">
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">{card.artists.join(", ")}</span>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted cursor-help">
                    <Clock className="h-3 w-3" />
                    {daysLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Dias neste estágio
                </TooltipContent>
              </Tooltip>
            </div>

            <Badge
              variant={deadlineColor(card.releaseDate) === "red" ? "danger" : deadlineColor(card.releaseDate) === "amber" ? "warning" : "outline"}
              className="text-[10px] px-1.5 py-0"
            >
              {deadline.toLocaleDateString("pt-BR")}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
