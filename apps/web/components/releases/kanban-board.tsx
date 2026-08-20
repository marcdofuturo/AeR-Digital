"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCorners,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, type KanbanCardData } from "./kanban-card";
import { ReleaseDetailsDialog } from "./release-details-dialog";
import { KANBAN_STAGES } from "@ar/ai/crm";
import { updateReleaseStage } from "@/app/releases/actions";
import type { ReleaseStage } from "@ar/shared";

interface Props {
  releases: KanbanCardData[];
}

export function KanbanBoard({ releases }: Props) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCardData | null>(null);
  const suppressOpenRef = useRef(false);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(1);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const board = boardScrollRef.current;
    if (!board) return undefined;
    const measure = () => {
      setScrollWidth(Math.max(1, board.scrollWidth));
      setHasOverflow(board.scrollWidth > board.clientWidth + 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(board);
    if (board.firstElementChild) observer?.observe(board.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [releases]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columns = KANBAN_STAGES.map((stage) => ({
    ...stage,
    cards: releases.filter((r) => r.stage === stage.id),
  }));

  function handleDragStart(event: DragStartEvent) {
    const card = releases.find((r) => r.id === event.active.id);
    suppressOpenRef.current = true;
    if (card) setActiveCard(card);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
    if (!over) return;

    const card = releases.find((r) => r.id === active.id);
    if (!card) return;

    const newStage = over.id as ReleaseStage;
    if (newStage === card.stage) return;

    // Optimistic update — the parent re-renders on revalidatePath
    try {
      await updateReleaseStage(card.id, newStage);
    } catch {
      // Let the page re-fetch on error; no optimistic revert needed since
      // server state wins via cache revalidation
    }
  }

  function handleDragCancel() {
    setActiveCard(null);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
  }

  const handleOpenRelease = useCallback((card: KanbanCardData) => {
    if (suppressOpenRef.current) return;
    setSelectedCard(card);
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={boardScrollRef}
          className="[scrollbar-width:none] overflow-x-auto pb-12 [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            if (bottomScrollRef.current)
              bottomScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <div className="flex w-max gap-3">
            {columns.map((col) => (
              <KanbanColumn key={col.id} id={col.id} label={col.label} count={col.cards.length}>
                {col.cards.map((card) => (
                  <KanbanCard key={card.id} card={card} onOpenRelease={handleOpenRelease} />
                ))}
              </KanbanColumn>
            ))}
          </div>
        </div>

        <DragOverlay>{activeCard ? <KanbanCard card={activeCard} /> : null}</DragOverlay>
      </DndContext>

      <div
        className={`border-border bg-bg/95 fixed right-0 bottom-0 left-0 z-30 border-t px-3 py-2 backdrop-blur md:left-[var(--app-sidebar-width)] ${hasOverflow ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!hasOverflow}
      >
        <div
          ref={bottomScrollRef}
          aria-label="Rolagem horizontal dos lancamentos"
          className="h-4 overflow-x-auto overflow-y-hidden"
          onScroll={(event) => {
            if (boardScrollRef.current)
              boardScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      </div>

      <ReleaseDetailsDialog
        release={selectedCard}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null);
        }}
      />
    </>
  );
}
