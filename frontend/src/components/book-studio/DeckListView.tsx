"use client";

import React, { useState } from "react";
import { GripVertical, Scissors } from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";

export interface DeckListViewProps {
  pages: BookStudioPage[];
  selectedPageId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onContextMenu?: (e: React.MouseEvent, page: BookStudioPage) => void;
  emptyLabel?: string;
}

export function DeckListView({
  pages,
  selectedPageId,
  onSelect,
  onReorder,
  onContextMenu,
  emptyLabel = "No pages in deck",
}: DeckListViewProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      onReorder(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs select-none">
        <span>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-1 select-none">
      {pages.map((p, idx) => {
        const isSelected = p.id === selectedPageId;
        const isSelfDragging = draggedIdx === idx;
        const isTarget = dragOverIdx === idx;
        const isSplit = Boolean(
          p.half === "left" ||
          p.half === "right" ||
          p.slice_box != null ||
          (p.half && (p.half.startsWith("col_") || p.half.startsWith("row_")))
        );

        return (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelect(p.id)}
            onContextMenu={(e) => {
              if (onContextMenu) {
                e.preventDefault();
                onContextMenu(e, p);
              }
            }}
            className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
              isSelfDragging
                ? "opacity-30 border-dashed border-cyan-500 scale-95"
                : isTarget
                ? "border-cyan-400 bg-cyan-950/30 scale-[1.01]"
                : isSelected
                ? "border-cyan-500 bg-[#1E2638] text-white shadow-sm ring-1 ring-cyan-500/40"
                : "border-[#272E3F] hover:border-slate-500 bg-[#131720] text-slate-300 hover:text-white"
            }`}
          >
            {/* Left: Drag Handle, Page Index, Label */}
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-slate-500 hover:text-slate-300 cursor-grab shrink-0">
                <GripVertical size={13} />
              </span>
              <span className="font-mono text-[11px] text-slate-400 shrink-0">
                #{idx + 1}
              </span>
              <span className="font-medium truncate text-xs">
                {p.label || `Page ${idx + 1}`}
              </span>
            </div>

            {/* Right: Badges (Split, Rotation, Dimensions) */}
            <div className="flex items-center space-x-1.5 shrink-0 pl-2">
              {isSplit && (
                <span className="flex items-center space-x-0.5 px-1 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] rounded font-medium">
                  <Scissors size={10} />
                  <span>{p.half || "Split"}</span>
                </span>
              )}
              {p.rotation !== 0 && (
                <span className="px-1 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[10px] font-mono rounded">
                  {p.rotation}°
                </span>
              )}
              <span className="text-[10px] font-mono text-slate-400">
                {p.width_mm}×{p.height_mm}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
