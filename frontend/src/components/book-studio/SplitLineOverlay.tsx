"use client";

import React from "react";
import { SplitLine } from "@/types/book_studio";

export interface SplitLineOverlayProps {
  line: SplitLine;
  index: number;
  active: boolean;
  onPointerDown: (handle: string, e: React.PointerEvent) => void;
}

const ACCENT = "var(--app-accent, #f59e0b)";

/** A cut line drawn inside the crop box. The entire line (14px strip) is draggable. */
export function SplitLineOverlay({ line, index, active, onPointerDown }: SplitLineOverlayProps) {
  const isH = line.direction === "horizontal";
  const pct = `${line.pos * 100}%`;
  const start = (e: React.PointerEvent) => onPointerDown(`spine-${index}`, e);

  return (
    <div
      onPointerDown={start}
      className={`group absolute z-40 touch-none ${
        isH ? "left-0 right-0 h-3.5 -translate-y-1/2 cursor-ns-resize" : "top-0 bottom-0 w-3.5 -translate-x-1/2 cursor-ew-resize"
      }`}
      style={isH ? { top: pct } : { left: pct }}
      title={`Drag to move ${line.direction} cut line ${index + 1}`}
    >
      {/* Visible line */}
      <div
        className={`absolute pointer-events-none transition-all ${
          isH ? "left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed" : "top-0 bottom-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed"
        } ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
        style={{ borderColor: ACCENT, filter: "drop-shadow(0 0 2px rgba(0,0,0,0.9))" }}
      />
      {/* Hover / active glow */}
      <div
        className={`absolute pointer-events-none rounded-full transition-opacity ${
          isH ? "left-0 right-0 top-1/2 -translate-y-1/2 h-1.5" : "top-0 bottom-0 left-1/2 -translate-x-1/2 w-1.5"
        } ${active ? "opacity-40" : "opacity-0 group-hover:opacity-25"}`}
        style={{ backgroundColor: ACCENT }}
      />
      {/* Position pill */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-slate-950 font-mono font-semibold text-[10px] shadow-lg ring-1 ring-black/60 pointer-events-none whitespace-nowrap transition-transform ${
          active ? "scale-110" : "group-hover:scale-105"
        }`}
        style={{ backgroundColor: ACCENT }}
      >
        {(line.pos * 100).toFixed(1)}%
      </div>
    </div>
  );
}
