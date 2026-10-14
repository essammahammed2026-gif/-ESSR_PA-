"use client";

import React, { useState } from "react";
import type { BasePage } from "@/types/book_studio";

export interface DeckDragState {
  draggedIdx: number | null;
  dragOverIdx: number | null;
}

export interface DeckDragHandlers {
  draggable: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

interface DeckGridProps<T extends BasePage> {
  pages: T[];
  columns?: 2 | 3;
  emptyLabel?: string;
  onReorder: (fromIdx: number, toIdx: number) => void;
  renderCard: (page: T, index: number, drag: DeckDragState, handlers: DeckDragHandlers) => React.ReactNode;
}

/**
 * Shared draggable page-deck grid (fix.md Phase 2.3). Owns HTML5 drag state;
 * cards attach the provided handlers to their own roots (no wrapper divs).
 */
export function DeckGrid<T extends BasePage>({
  pages,
  columns = 2,
  emptyLabel = "No pages",
  onReorder,
  renderCard,
}: DeckGridProps<T>) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handlers: DeckDragHandlers = {
    draggable: true,
    onDragStart: (e, index) => {
      setDraggedIdx(index);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e, index) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverIdx !== index) setDragOverIdx(index);
    },
    onDrop: (e, index) => {
      e.preventDefault();
      setDragOverIdx(null);
      if (draggedIdx !== null && draggedIdx !== index) onReorder(draggedIdx, index);
      setDraggedIdx(null);
    },
    onDragEnd: () => {
      setDraggedIdx(null);
      setDragOverIdx(null);
    },
  };

  if (pages.length === 0) {
    return <div className="p-4 text-center text-xs text-slate-500">{emptyLabel}</div>;
  }

  const drag: DeckDragState = { draggedIdx, dragOverIdx };
  return (
    <div className={`grid ${columns === 3 ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
      {pages.map((p, idx) => (
        <React.Fragment key={p.id}>{renderCard(p, idx, drag, handlers)}</React.Fragment>
      ))}
    </div>
  );
}
