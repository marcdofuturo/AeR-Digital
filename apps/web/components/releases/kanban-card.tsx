"use client";

import { useDraggable } from "@dnd-kit/core";
import type { KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDaysInStage, deadlineColor } from "@ar/ai/crm";
import { AlertTriangle, Clock, Users } from "lucide-react";

export interface KanbanCardTrackData {
  id: string;
  title: string;
  isrc?: string | null;
  audioReceived?: boolean;
  durationSec?: number | null;
  bpm?: number | null;
  key?: string | null;
  explicit?: boolean | null;
  participants: string[];
}

export interface ReleaseProgressSummary {
  total: number;
  approved?: number;
  completed?: number;
  pending: number;
  rejected: number;
}

export interface KanbanCardData {
  id: string;
  title: string;
  artists: string[];
  releaseDate: string;
  stage: string;
  daysInStage: number;
  genrePrimary?: string | null;
  genreSecondary?: string | null;
  coverUrl?: string | null;
  coverReceived?: boolean;
  upc?: string | null;
  albumIdExt?: string | null;
  distributor?: string | null;
  tracks?: KanbanCardTrackData[];
  authorizations?: ReleaseProgressSummary;
  registrations?: ReleaseProgressSummary;
}

interface Props {
  card: KanbanCardData;
  onOpenRelease?: (card: KanbanCardData) => void;
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("T")[0]?.split("-") ?? [];
  if (year && month && day) return `${day}/${month}/${year}`;
  return new Date(value).toLocaleDateString("pt-BR");
}

export function KanbanCard({ card, onOpenRelease }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: card,
  });

  const isUrgent = deadlineColor(card.releaseDate) === "red";
  const daysLabel = formatDaysInStage(card.daysInStage);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpenRelease || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onOpenRelease(card);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      aria-label={onOpenRelease ? `Abrir detalhes de ${card.title}` : undefined}
      onClick={onOpenRelease ? () => onOpenRelease(card) : undefined}
      onKeyDown={handleKeyDown}
    >
      <Card
        className={`p-3 cursor-pointer active:cursor-grabbing transition-shadow ${
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
              {formatDateOnly(card.releaseDate)}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
