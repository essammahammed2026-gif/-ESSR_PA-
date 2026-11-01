"use client";

import React, { useState } from "react";
import { RotateCw, RotateCcw, Plus, ArrowLeftRight, Check, SlidersHorizontal } from "lucide-react";
import { ImposingPage } from "@/types/prepress";

interface PageToolsPanelProps {
  pages: ImposingPage[];
  batchRotateSelected?: (dir: "cw" | "ccw") => void;
  selectedPageIds?: string[];
  rotatePage?: (id: string, dir: "cw" | "ccw") => void;
}

export function PageToolsPanel({
  pages,
  batchRotateSelected,
  selectedPageIds = [],
  rotatePage,
}: PageToolsPanelProps) {
  const [fitMode, setFitMode] = useState<"stretch" | "fit" | "center">("fit");
  const [isRtl, setIsRtl] = useState(false);

  return (
    <div className="space-y-4 select-none">
      {/* 1. Batch Rotations */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Orientation & Rotation
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => batchRotateSelected?.("cw")}
            className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-inset,#11151E)] border border-[var(--border-subtle,#242C3D)] text-xs text-[var(--text-primary,#F1F5F9)] cursor-pointer"
          >
            <RotateCw size={13} className="text-[var(--app-accent,#F59E0B)]" />
            <span>Rotate 90° CW</span>
          </button>
          <button
            type="button"
            onClick={() => batchRotateSelected?.("ccw")}
            className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-inset,#11151E)] border border-[var(--border-subtle,#242C3D)] text-xs text-[var(--text-primary,#F1F5F9)] cursor-pointer"
          >
            <RotateCcw size={13} className="text-[var(--app-accent,#F59E0B)]" />
            <span>Rotate 90° CCW</span>
          </button>
        </div>
      </div>

      {/* 2. Blank Page Insertion for Booklets */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Booklet Signature Alignment
        </label>
        <div className="p-2.5 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted,#64748B)]">Total Pages:</span>
            <span className="font-mono font-semibold text-[var(--text-primary,#F1F5F9)]">
              {pages.length} {pages.length % 4 === 0 ? "✓ (Multiple of 4)" : `⚠️ (${pages.length % 4}/4)`}
            </span>
          </div>

          {pages.length % 4 !== 0 && (
            <button
              type="button"
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded bg-[var(--app-accent-15)] hover:bg-[var(--app-accent-30)] text-[var(--app-accent,#F59E0B)] border border-[var(--app-accent-30)] text-xs font-semibold cursor-pointer"
            >
              <Plus size={13} />
              <span>Insert {4 - (pages.length % 4)} Blank Page{4 - (pages.length % 4) > 1 ? "s" : ""}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Scale & Fit Modes */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Artwork Fit in Slot
        </label>
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-inset,#11151E)] p-1 rounded-lg border border-[var(--border-subtle,#242C3D)] text-xs">
          {[
            { id: "fit", label: "Proportional" },
            { id: "stretch", label: "Stretch" },
            { id: "center", label: "1:1 Center" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setFitMode(mode.id as typeof fitMode)}
              className={`py-1.5 rounded font-semibold text-center transition-colors cursor-pointer ${
                fitMode === mode.id
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Page Inversion (RTL / Arabic) */}
      <div className="pt-2 border-t border-[var(--border-subtle,#242C3D)]">
        <label className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] cursor-pointer">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight size={14} className="text-[var(--app-accent,#F59E0B)]" />
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)]">Right-to-Left (RTL) Order</div>
              <div className="text-[10px] text-[var(--text-muted,#64748B)]">Inverts page collation for Arabic books</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isRtl}
            onChange={(e) => setIsRtl(e.target.checked)}
            className="rounded bg-[var(--surface-inset,#11151E)] border-[var(--border-subtle,#242C3D)] text-[var(--app-accent,#F59E0B)]"
          />
        </label>
      </div>
    </div>
  );
}
