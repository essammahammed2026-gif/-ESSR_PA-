"use client";

import React, { useMemo, useState } from "react";
import {
  RefreshCw,
  Plus,
  RotateCcw,
  Trash2,
  Check,
} from "lucide-react";
import {
  IconToolCropSplit,
  IconAutoDetect,
  IconSplitVertical,
  IconSplitHorizontal,
} from "@/components/shared/StudioIcons";
import {
  CropModuleConfig,
  CropBox,
  SplitLine,
  SplitDirection,
  CropTargetBase,
  CropParity,
  ModuleTaskProgress,
  BookStudioPage,
  AppliedModuleEntry,
} from "@/types/book_studio";
import { SplitLinesEditor } from "./SplitLinesEditor";
import { ModuleProgressBar, LayerEntryStack } from "./PageScopeSelector";
import { getNextCutLine, cutPageCount } from "@/lib/splitLines";

export interface CropSplitPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  detectAllCrops?: () => Promise<void>;
  pageCropsCount?: number;
  hasActivePageDraftCrop?: boolean;
  clearPageCrops?: (ids?: string[]) => void;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  removeAppliedCrop?: (id: string, onlyTargetPageId?: string) => Promise<void> | void;
  removeAllAppliedCrops?: () => Promise<void> | void;
  taskProgress?: ModuleTaskProgress;
  selectedPageId?: string | null;
  sessionId: string | null;
  pages?: BookStudioPage[];
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

const TARGET_PRESETS: {
  id: string;
  label: string;
  base: CropTargetBase;
  parity: CropParity;
  tip: string;
}[] = [
  { id: "current", label: "Current", base: "current", parity: "both", tip: "Apply only to the active page" },
  { id: "all", label: "All", base: "all", parity: "both", tip: "Apply across all pages in the book" },
  { id: "odds", label: "Odds", base: "all", parity: "odds", tip: "Apply only to odd-numbered pages (1, 3, 5...)" },
  { id: "evens", label: "Evens", base: "all", parity: "evens", tip: "Apply only to even-numbered pages (2, 4, 6...)" },
  { id: "range", label: "Range", base: "range", parity: "both", tip: "Apply to a custom page range (e.g. 1-5, 8, 12-16)" },
];

export function CropSplitPanel({
  cropModule,
  setCropModule,
  isDetectingCrop,
  detectCrop,
  detectAllCrops,
  pageCropsCount = 0,
  hasActivePageDraftCrop = false,
  clearPageCrops,
  splitSpread,
  applyCrop,
  removeAppliedCrop,
  removeAllAppliedCrops,
  taskProgress,
  selectedPageId,
  sessionId,
  activePageNum,
  shortcutLabels = {},
}: CropSplitPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const splitLines = cropModule.splitLines;
  const hasCutLines = splitLines.length > 0;
  const piecesPerSheet = cutPageCount(splitLines);

  const handleEditEntry = (entry: AppliedModuleEntry) => {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    if (entry.params) {
      setCropModule((prev) => ({
        ...prev,
        enabled: true,
        cropBox: entry.params?.cropBox ?? prev.cropBox,
        splitLines: entry.params?.splitLines ?? prev.splitLines,
        target: entry.params?.target ?? prev.target,
        detectMode: entry.params?.detectMode ?? prev.detectMode,
      }));
    }
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    setCropModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => (e.id === id ? { ...e, visible } : e)),
    }));
  };

  const handleToggleAllVisibility = (visible: boolean) => {
    setCropModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => ({ ...e, visible })),
    }));
  };

  const handleDeleteAll = () => {
    if (removeAllAppliedCrops) {
      void removeAllAppliedCrops();
    } else {
      const entries = [...(cropModule.appliedEntries || [])].reverse();
      entries.forEach((e) => removeAppliedCrop?.(e.id));
    }
    setEditingId(null);
  };

  const setLines = (lines: SplitLine[]) => {
    setCropModule((prev) => ({ ...prev, enabled: true, splitLines: lines }));
  };

  const handleAddCutLine = (dir: SplitDirection = "vertical") => {
    setLines([...splitLines, getNextCutLine(splitLines, dir)]);
  };

  const setTarget = (base: CropTargetBase, parity: CropParity = "both", customRange?: string) => {
    setCropModule((prev) => ({
      ...prev,
      target: {
        base,
        parity,
        customRange: customRange !== undefined ? customRange : prev.target.customRange,
      },
    }));
  };

  const activeTargetId = useMemo(() => {
    const t = cropModule.target;
    if (t.base === "current") return "current";
    if (t.base === "range") return "range";
    if (t.parity === "odds") return "odds";
    if (t.parity === "evens") return "evens";
    return "all";
  }, [cropModule.target]);

  const targetLabel = useMemo(() => {
    const t = cropModule.target;
    if (t.base === "current") return activePageNum !== undefined ? `Page ${activePageNum}` : "Current Page";
    if (t.base === "range") return `Range (${t.customRange || "..."})`;
    if (t.parity === "odds") return "Odd Pages";
    if (t.parity === "evens") return "Even Pages";
    return "All Pages";
  }, [cropModule.target, activePageNum]);

  const handleApplyAction = async () => {
    if (editingId) {
      const idToUpdate = editingId;
      setEditingId(null);
      await removeAppliedCrop?.(idToUpdate);
    }
    if (hasCutLines) {
      if (splitSpread) void splitSpread();
    } else {
      if (applyCrop) void applyCrop();
    }
  };

  const insets = useMemo(() => {
    const b = cropModule.cropBox;
    return {
      left: Math.max(0, Math.round(b.x1 * 1000) / 10),
      top: Math.max(0, Math.round(b.y1 * 1000) / 10),
      right: Math.max(0, Math.round((1 - b.x2) * 1000) / 10),
      bottom: Math.max(0, Math.round((1 - b.y2) * 1000) / 10),
    };
  }, [cropModule.cropBox]);

  return (
    <div className="space-y-3 select-none">
      {/* Module Header Banner */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2.5">
            <div
              className="p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] shrink-0 mt-0.5"
              style={cropModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            >
              <IconToolCropSplit size={16} className={cropModule.enabled ? "" : "text-slate-400"} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-[var(--text-primary,#f1f5f9)]">Crop & Split</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Trim margins or slice spreads.
              </p>
            </div>
          </div>

          <label
            className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
            title={`Toggle Crop & Split Overlay (${shortcutLabels.crop_toggle || "C"})`}
          >
            <input
              type="checkbox"
              checked={cropModule.enabled}
              onChange={(e) => setCropModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div
              className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
              style={cropModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            />
          </label>
        </div>

        <ModuleProgressBar task={taskProgress} />
      </div>

      {/* Section 1: Auto-Detect & Trim Bounds */}
      <div
        className={`rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5 transition-opacity ${
          !cropModule.enabled ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Smart Trim
          </span>
          {pageCropsCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[9px] font-semibold"
              title={`${pageCropsCount} page(s) have individual crop boxes ready to browse & apply`}
            >
              {pageCropsCount} ready
              {hasActivePageDraftCrop ? " • Active" : ""}
            </span>
          )}
        </div>

        {/* Detect Mode Cards: Paper Sheet vs Tight Content */}
        <div className="grid grid-cols-2 gap-1.5">
          {([
            {
              id: "paper" as const,
              title: "Paper",
              desc: "Keep margins & headers",
            },
            {
              id: "content" as const,
              title: "Content",
              desc: "Tight text crop",
            },
          ]).map((mode) => {
            const active = (cropModule.detectMode || "paper") === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setCropModule((prev) => ({ ...prev, detectMode: mode.id }))}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  active
                    ? "bg-[var(--surface-inset,#131720)] border-amber-500/60 shadow-2xs"
                    : "bg-[var(--surface-inset,#131720)]/60 border-[var(--border-subtle,#242A38)] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${active ? "text-[var(--text-primary,#fff)]" : "text-slate-300"}`}
                    style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                  >
                    {mode.title}
                  </span>
                  {active && <Check size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{mode.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Detect Page / Detect All / Reset */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <button
            type="button"
            onClick={() => detectCrop && void detectCrop(selectedPageId || undefined)}
            disabled={isDetectingCrop || !sessionId || !cropModule.enabled}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
            title={`Auto-detect crop box on current page (${shortcutLabels.detect_page || "A"})`}
          >
            {isDetectingCrop ? (
              <>
                <RefreshCw size={12} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <IconAutoDetect size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Detect</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => detectAllCrops && void detectAllCrops()}
            disabled={isDetectingCrop || !sessionId || !cropModule.enabled}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
            title={`Auto-detect individual crop boxes for every page in scope (${shortcutLabels.detect_all || "Shift+A"})`}
          >
            {isDetectingCrop ? (
              <>
                <RefreshCw size={12} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <IconAutoDetect size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Detect All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (clearPageCrops) clearPageCrops();
              setCropModule((prev) => ({
                ...prev,
                cropBox: { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
              }));
            }}
            disabled={!cropModule.enabled}
            className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center"
            title="Reset crop box to full page and clear per-page draft crops"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Live Crop Insets Readout */}
        <div className="grid grid-cols-4 gap-1 p-1.5 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-center">
          {([
            { label: "Left", val: insets.left },
            { label: "Top", val: insets.top },
            { label: "Right", val: insets.right },
            { label: "Bottom", val: insets.bottom },
          ]).map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-[9px] uppercase text-slate-500 font-semibold">{item.label}</span>
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary,#e2e8f0)]">
                {item.val.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Spread & Page Splitting (Cut Lines) */}
      <div
        className={`rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5 transition-opacity ${
          !cropModule.enabled ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Splits
            </span>
            {hasCutLines && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {splitLines.length} cut{splitLines.length > 1 ? "s" : ""} → {piecesPerSheet}p
              </span>
            )}
          </div>
          {hasCutLines && (
            <button
              type="button"
              onClick={() => setLines([])}
              className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Remove all cut lines"
            >
              <Trash2 size={11} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Add Vertical / Horizontal Cut Buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleAddCutLine("vertical")}
            disabled={!cropModule.enabled}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium text-[var(--text-primary,#e2e8f0)] bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] transition-colors cursor-pointer"
            title={`Add vertical cut line for left/right spread splitting (${shortcutLabels.add_cut || "X"})`}
          >
            <Plus size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <IconSplitVertical size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>Vertical</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddCutLine("horizontal")}
            disabled={!cropModule.enabled}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium text-[var(--text-primary,#e2e8f0)] bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] transition-colors cursor-pointer"
            title="Add horizontal cut line for top/bottom slicing"
          >
            <Plus size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <IconSplitHorizontal size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>Horizontal</span>
          </button>
        </div>

        {hasCutLines ? (
          <SplitLinesEditor
            lines={splitLines}
            disabled={!cropModule.enabled}
            onLinesChange={setLines}
          />
        ) : (
          <p className="text-[10px] text-slate-500 text-center py-1">
            No cut lines.
          </p>
        )}
      </div>

      {/* Section 3: Target Scope & Commit Action */}
      <div
        className={`rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5 transition-opacity ${
          !cropModule.enabled ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
          <span className="font-bold uppercase tracking-wider shrink-0">Scope</span>
          <div className="inline-flex items-center gap-0.5 bg-[var(--surface-inset,#131720)] p-0.5 rounded-md border border-[var(--border-subtle,#242A38)]">
            {TARGET_PRESETS.map((opt) => {
              const active = activeTargetId === opt.id;
              const displayLabel = opt.id === "current" && activePageNum !== undefined ? `P.${activePageNum}` : opt.label;
              const displayTip = opt.id === "current" && activePageNum !== undefined ? `Current Page (${activePageNum})` : opt.tip;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTarget(opt.base, opt.parity)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer leading-tight ${
                    active
                      ? "bg-slate-800 text-white font-semibold shadow-2xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                  title={displayTip}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>

        {cropModule.target.base === "range" && (
          <input
            type="text"
            placeholder="e.g. 1-5, 8, 11-14"
            value={cropModule.target.customRange}
            onChange={(e) => setTarget("range", "both", e.target.value)}
            className="w-full bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] text-[11px] font-mono px-2.5 py-1.5 rounded-lg outline-none focus:border-[var(--app-accent,#f59e0b)] placeholder:text-slate-500"
            title="Type page numbers or ranges separated by commas"
          />
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApplyAction}
            disabled={!sessionId || !cropModule.enabled}
            className="flex-1 py-2 px-3 rounded-lg disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-sm hover:opacity-95"
            style={{
              backgroundColor: "var(--app-accent, #f59e0b)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
            title={hasCutLines ? `Commit split & crop to ${targetLabel} (${shortcutLabels.apply_action || "Enter"})` : `Commit crop to ${targetLabel} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{editingId ? "Update Crop" : hasCutLines ? `Split (${targetLabel})` : `Apply (${targetLabel})`}</span>
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
              title="Cancel editing"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Universal Layer Stack — TCK-02 */}
      <LayerEntryStack
        title="Applied Crops"
        entries={cropModule.appliedEntries}
        editingId={editingId}
        activePageNum={activePageNum}
        activePageId={selectedPageId}
        onEdit={handleEditEntry}
        onDelete={(id) => removeAppliedCrop?.(id)}
        onDeleteFromCurrentPage={(id) => {
          if (selectedPageId) removeAppliedCrop?.(id, selectedPageId);
        }}
        onToggleVisibility={handleToggleVisibility}
        onToggleAllVisibility={handleToggleAllVisibility}
        onDeleteAll={handleDeleteAll}
      />
    </div>
  );
}
