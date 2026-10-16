"use client";

import React from "react";
import { GripVertical } from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";

export interface DeckCardProps {
  page: BookStudioPage;
  index: number;
  isSelected: boolean;
  isDragTarget: boolean;
  isSelfDragging: boolean;
  thumbnailUrl: string;
  onSelect: (id: string, e?: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
  onContextMenu?: (e: React.MouseEvent, page: BookStudioPage) => void;
}

export function DeckCard({
  page,
  index,
  isSelected,
  isDragTarget,
  isSelfDragging,
  thumbnailUrl,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onContextMenu,
}: DeckCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={(e) => onSelect(page.id, e)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, page);
        }
      }}
      className={`group relative flex flex-col rounded-lg border cursor-pointer transition-all ${
        isSelfDragging
          ? "opacity-30 border-dashed border-cyan-500 scale-95"
          : isDragTarget
          ? "border-cyan-400 bg-cyan-950/20 scale-[1.02]"
          : isSelected
          ? "border-cyan-500 ring-2 ring-cyan-500/40 bg-[#1E2638] shadow"
          : "border-[#272E3F] hover:border-slate-500 bg-[#131720]"
      }`}
    >
      <div className="relative aspect-[3/4] bg-[#0A0D14] rounded-t-lg overflow-hidden flex items-center justify-center p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={page.label}
          loading="lazy"
          decoding="async"
          className="object-contain max-h-full max-w-full pointer-events-none transition-transform duration-150"
        />
        {page.rotation !== 0 && (
          <span className="absolute top-1 right-1 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[8px] font-mono px-1 rounded shadow-sm">
            {page.rotation}°
          </span>
        )}
        <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded px-1 py-0.5 text-white/80 flex items-center pointer-events-none">
          <GripVertical size={10} />
        </div>
      </div>
      <div className="px-1.5 py-1 text-[10px] text-slate-300 truncate font-medium bg-[#131720]/80 rounded-b-lg border-t border-[#242A38]">
        {page.label}
      </div>
    </div>
  );
}
