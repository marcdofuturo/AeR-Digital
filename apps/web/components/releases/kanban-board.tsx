"use client";

import { useCallback, useRef, useState } from "react";
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn key={col.id} id={col.id} label={col.label} count={col.cards.length}>
              {col.cards.map((card) => (
                <KanbanCard key={card.id} card={card} onOpenRelease={handleOpenRelease} />
              ))}
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <KanbanCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      <ReleaseDetailsDialog
        release={selectedCard}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null);
        }}
      />
    </>
  );
}
