"use client";

import React, { useState } from "react";
import {
  Upload,
  Trash2,
  Loader2,
  RotateCw,
  RotateCcw,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  X,
  LayoutGrid,
  List,
  CheckSquare,
  ChevronDown,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { formatMmInUnit, LengthUnit } from "@/lib/units";
import { ImposingItem, ImposingPage } from "@/types/prepress";

interface LeftAssetPanelProps {
  items: ImposingItem[];
  pages: ImposingPage[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  rotatePage: (id: string, dir: "cw" | "ccw") => void;
  toggleDeletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  clearAllPages: () => void;
  deckViewMode?: "grid" | "list";
  setDeckViewMode?: (mode: "grid" | "list") => void;
  selectedPageIds?: string[];
  toggleSelectPage?: (id: string, isShift?: boolean, isCtrl?: boolean) => void;
  selectAllPages?: () => void;
  deselectAllPages?: () => void;
  invertSelectedPages?: () => void;
  batchRotateSelected?: (dir: "cw" | "ccw") => void;
  batchToggleDeleteSelected?: () => void;
  batchDuplicateSelected?: () => void;
  unit?: string;
  onCollapse?: () => void;
}

export function LeftAssetPanel({
  pages,
  handleFileUpload,
  isUploading,
  reorderPages,
  rotatePage,
  toggleDeletePage,
  duplicatePage,
  clearAllPages,
  deckViewMode = "grid",
  setDeckViewMode,
  selectedPageIds = [],
  toggleSelectPage,
  selectAllPages,
  deselectAllPages,
  invertSelectedPages,
  batchRotateSelected,
  batchToggleDeleteSelected,
  batchDuplicateSelected,
  unit = "mm",
  onCollapse,
}: LeftAssetPanelProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);

  const activeCount = pages.filter((p) => !p.is_deleted).length;
  const deletedCount = pages.length - activeCount;
  const selectedCount = selectedPageIds.length;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    const sourceIdxStr = e.dataTransfer.getData("text/plain");
    const sourceIdx = parseInt(sourceIdxStr, 10);
    if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      reorderPages(sourceIdx, targetIdx);
    }
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel,#141923)] border-r border-[var(--border-subtle,#242C3D)] overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle,#242C3D)] bg-[var(--surface-panel,#141923)] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <span className="text-xs font-bold text-[var(--text-primary,#F1F5F9)]">Deck</span>
          {pages.length > 0 && (
            <span className="text-[10px] font-mono text-[var(--text-muted,#64748B)]">
              {activeCount} active{deletedCount > 0 ? `, ${deletedCount} excl.` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {/* View Mode Toggle (Grid vs List) */}
          {setDeckViewMode && (
            <div className="flex items-center bg-[var(--surface-inset,#11151E)] p-0.5 rounded border border-[var(--border-subtle,#242C3D)]">
              <button
                type="button"
                onClick={() => setDeckViewMode("grid")}
                className={`p-1 rounded transition-colors ${
                  deckViewMode === "grid"
                    ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                    : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-secondary,#94A3B8)]"
                }`}
                title="Grid View (Thumbnails)"
              >
                <LayoutGrid size={12} />
              </button>
              <button
                type="button"
                onClick={() => setDeckViewMode("list")}
                className={`p-1 rounded transition-colors ${
                  deckViewMode === "list"
                    ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                    : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-secondary,#94A3B8)]"
                }`}
                title="List View (Dense Table)"
              >
                <List size={12} />
              </button>
            </div>
          )}

          {/* Close Panel Button */}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] rounded transition-colors cursor-pointer"
              title="Close Page Deck"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Action Strip (Selection & Batch Controls) */}
      {pages.length > 0 && (
        <div className="px-2.5 py-1.5 border-b border-[var(--border-subtle,#242C3D)] bg-[var(--surface-inset,#11151E)] flex items-center justify-between text-xs shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSelectMenuOpen((prev) => !prev)}
              className="flex items-center space-x-1 px-1.5 py-1 rounded bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] text-[11px] font-medium transition-colors cursor-pointer"
            >
              <CheckSquare size={11} className="text-[var(--app-accent,#F59E0B)]" />
              <span>Select</span>
              <ChevronDown size={11} />
            </button>

            {/* Select Dropdown Menu */}
            {isSelectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsSelectMenuOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-28 bg-[var(--surface-panel,#141923)] border border-[var(--border-strong,#333E54)] rounded-md shadow-xl py-1 z-40 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      selectAllPages?.();
                      setIsSelectMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[var(--surface-card,#181D27)] text-[var(--text-primary,#F1F5F9)]"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deselectAllPages?.();
                      setIsSelectMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[var(--surface-card,#181D27)] text-[var(--text-secondary,#94A3B8)]"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      invertSelectedPages?.();
                      setIsSelectMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-[var(--surface-card,#181D27)] text-[var(--text-secondary,#94A3B8)]"
                  >
                    Invert Selection
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Batch Actions when items are selected */}
          {selectedCount > 0 ? (
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-[var(--app-accent,#F59E0B)] font-mono font-semibold mr-1">
                {selectedCount} sel.
              </span>
              <button
                type="button"
                onClick={() => batchRotateSelected?.("cw")}
                title="Rotate Selected 90° CW"
                className="p-1 rounded bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-panel,#141923)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] border border-[var(--border-subtle,#242C3D)] cursor-pointer"
              >
                <RotateCw size={11} />
              </button>
              <button
                type="button"
                onClick={() => batchRotateSelected?.("ccw")}
                title="Rotate Selected 90° CCW"
                className="p-1 rounded bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-panel,#141923)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] border border-[var(--border-subtle,#242C3D)] cursor-pointer"
              >
                <RotateCcw size={11} />
              </button>
              <button
                type="button"
                onClick={() => batchDuplicateSelected?.()}
                title="Duplicate Selected"
                className="p-1 rounded bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-panel,#141923)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] border border-[var(--border-subtle,#242C3D)] cursor-pointer"
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                onClick={() => batchToggleDeleteSelected?.()}
                title="Toggle Exclude on Selected"
                className="p-1 rounded bg-[var(--surface-card,#181D27)] hover:bg-[var(--surface-panel,#141923)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] border border-[var(--border-subtle,#242C3D)] cursor-pointer"
              >
                <EyeOff size={11} />
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-[var(--text-muted,#64748B)] font-mono">
              Drag to reorder
            </span>
          )}
        </div>
      )}

      {/* Pages Container */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-[var(--border-strong,#333E54)] rounded-lg p-4 text-center">
            <div className="text-[var(--text-secondary,#94A3B8)] text-xs mb-1 font-medium">
              No pages loaded
            </div>
            <div className="text-[var(--text-muted,#64748B)] text-[11px] mb-3">
              Upload a PDF or images to begin imposition
            </div>
            <label className="cursor-pointer px-3 py-1.5 bg-[var(--app-accent,#F59E0B)] hover:brightness-110 text-[var(--app-accent-fg,#0F172A)] rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm">
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              <span>Import Artwork</span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        ) : deckViewMode === "grid" ? (
          /* Grid View (2-column layout matching Book Studio) */
          <div className="grid grid-cols-2 gap-2">
            {pages.map((pg, i) => {
              const isOver = dragOverIdx === i;
              const isSelfDragging = draggedIdx === i;
              const isSelected = selectedPageIds.includes(pg.id);
              const thumbSrc = pg.thumb_url.startsWith("http")
                ? pg.thumb_url
                : getApiUrl(pg.thumb_url);

              return (
                <div
                  key={pg.id}
                  draggable={!pg.is_deleted}
                  onClick={(e) => toggleSelectPage?.(pg.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`group relative flex flex-col items-center rounded-lg border transition-all duration-150 cursor-pointer ${
                    isSelfDragging
                      ? "opacity-30 border-dashed border-[var(--app-accent,#F59E0B)] scale-95"
                      : isOver
                      ? "border-[var(--app-accent,#F59E0B)] ring-2 ring-[var(--app-accent-30)] scale-[1.02]"
                      : isSelected
                      ? "border-[var(--app-accent,#F59E0B)] ring-2 ring-[var(--app-accent-30)] bg-[var(--app-accent-15)]"
                      : pg.is_deleted
                      ? "border-rose-900/40 bg-[var(--surface-inset,#11151E)]/60 opacity-50"
                      : "border-[var(--border-subtle,#242C3D)] hover:border-[var(--border-strong,#333E54)] bg-[var(--surface-card,#181D27)]"
                  }`}
                >
                  {/* Thumbnail Card */}
                  <div className="w-full aspect-[1/1.32] rounded-t-lg bg-[var(--surface-canvas,#090C12)] flex items-center justify-center relative overflow-hidden p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbSrc}
                      alt={`Page ${i + 1}`}
                      className="max-h-full max-w-full object-contain rounded-xs transition-transform duration-200 pointer-events-none drop-shadow-sm"
                      style={{ transform: `rotate(${pg.rotation}deg)` }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />

                    {/* Drag Handle Icon on Hover */}
                    {!pg.is_deleted && (
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded px-1 py-0.5 text-white/80 flex items-center pointer-events-none">
                        <GripVertical size={11} />
                      </div>
                    )}

                    {/* Excluded Badge Overlay */}
                    {pg.is_deleted && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-1 text-center">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                          Excluded
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDeletePage(pg.id);
                          }}
                          className="mt-1 text-[9px] text-[var(--app-accent,#F59E0B)] hover:underline cursor-pointer"
                        >
                          Restore
                        </button>
                      </div>
                    )}

                    {/* Hover Toolbar (Top Right) */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-[var(--surface-panel,#141923)]/95 rounded p-0.5 border border-[var(--border-strong,#333E54)] backdrop-blur-sm shadow-md z-10">
                      <button
                        type="button"
                        title="Rotate 90° CW"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(pg.id, "cw");
                        }}
                        className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] rounded transition-colors"
                      >
                        <RotateCw size={11} />
                      </button>
                      <button
                        type="button"
                        title="Rotate 90° CCW"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(pg.id, "ccw");
                        }}
                        className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] rounded transition-colors"
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        type="button"
                        title="Duplicate Page"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePage(pg.id);
                        }}
                        className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] rounded transition-colors"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        type="button"
                        title={pg.is_deleted ? "Include Page" : "Exclude Page"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDeletePage(pg.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          pg.is_deleted
                            ? "text-emerald-400 hover:bg-emerald-500/20"
                            : "text-rose-400 hover:bg-rose-500/20"
                        }`}
                      >
                        {pg.is_deleted ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                    </div>
                  </div>

                  {/* Page Footer Label & Meta */}
                  <div className="w-full px-1.5 py-1 border-t border-[var(--border-subtle,#242C3D)] bg-[var(--surface-inset,#11151E)] flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[var(--text-primary,#F1F5F9)] truncate">
                      Pg {i + 1}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted,#64748B)] font-mono">
                      {pg.rotation !== 0
                        ? `${pg.rotation}°`
                        : `${formatMmInUnit(pg.w, unit as LengthUnit)}×${formatMmInUnit(pg.h, unit as LengthUnit)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View (Dense Tabular Rows) */
          <div className="space-y-1">
            {pages.map((pg, i) => {
              const isOver = dragOverIdx === i;
              const isSelfDragging = draggedIdx === i;
              const isSelected = selectedPageIds.includes(pg.id);
              const thumbSrc = pg.thumb_url.startsWith("http")
                ? pg.thumb_url
                : getApiUrl(pg.thumb_url);

              return (
                <div
                  key={pg.id}
                  draggable={!pg.is_deleted}
                  onClick={(e) => toggleSelectPage?.(pg.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                    isSelfDragging
                      ? "opacity-30 border-dashed border-[var(--app-accent,#F59E0B)]"
                      : isOver
                      ? "border-[var(--app-accent,#F59E0B)] bg-[var(--app-accent-15)]"
                      : isSelected
                      ? "border-[var(--app-accent,#F59E0B)] bg-[var(--app-accent-15)]"
                      : pg.is_deleted
                      ? "border-rose-900/30 bg-[var(--surface-inset,#11151E)] opacity-50"
                      : "border-[var(--border-subtle,#242C3D)] hover:border-[var(--border-strong,#333E54)] bg-[var(--surface-card,#181D27)]"
                  }`}
                >
                  <GripVertical
                    size={12}
                    className="text-[var(--text-muted,#64748B)] group-hover:text-[var(--text-secondary,#94A3B8)] mr-1.5 shrink-0"
                  />

                  {/* Thumbnail snippet */}
                  <div className="w-6 h-8 bg-[var(--surface-canvas,#090C12)] rounded overflow-hidden flex items-center justify-center shrink-0 mr-2 border border-[var(--border-subtle,#242C3D)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbSrc}
                      alt={`P${i + 1}`}
                      className="max-h-full max-w-full object-contain pointer-events-none"
                      style={{ transform: `rotate(${pg.rotation}deg)` }}
                    />
                  </div>

                  {/* Page Info */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-semibold text-[var(--text-primary,#F1F5F9)] truncate">
                        Page {i + 1}
                      </span>
                      {pg.rotation !== 0 && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--surface-inset,#11151E)] text-[var(--app-accent,#F59E0B)] font-mono">
                          {pg.rotation}°
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-[var(--text-muted,#64748B)]">
                      {formatMmInUnit(pg.w, unit as LengthUnit)} × {formatMmInUnit(pg.h, unit as LengthUnit)} {unit}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Rotate CW"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotatePage(pg.id, "cw");
                      }}
                      className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-inset,#11151E)]"
                    >
                      <RotateCw size={11} />
                    </button>
                    <button
                      type="button"
                      title="Duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicatePage(pg.id);
                      }}
                      className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-inset,#11151E)]"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      type="button"
                      title={pg.is_deleted ? "Include" : "Exclude"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDeletePage(pg.id);
                      }}
                      className={`p-1 rounded hover:bg-[var(--surface-inset,#11151E)] ${
                        pg.is_deleted ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {pg.is_deleted ? <Eye size={11} /> : <EyeOff size={11} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Actions Bar */}
      <div className="p-2 border-t border-[var(--border-subtle,#242C3D)] bg-[var(--surface-panel,#141923)] flex items-center justify-between shrink-0">
        <label
          className="cursor-pointer px-2 py-1.5 rounded hover:bg-[var(--surface-card,#181D27)] text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] transition-colors flex items-center space-x-1.5"
          title="Import Additional Files"
        >
          {isUploading ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
          <span className="text-xs font-medium">Add Files</span>
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>

        {pages.length > 0 && (
          <button
            type="button"
            className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded text-[var(--text-muted,#64748B)] transition-colors flex items-center space-x-1 cursor-pointer"
            title="Clear All Pages"
            onClick={clearAllPages}
          >
            <Trash2 size={13} />
            <span className="text-xs font-medium">Clear All</span>
          </button>
        )}
      </div>
    </div>
  );
}
