"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown,
  RefreshCw,
  Plus,
  RotateCcw,
} from "lucide-react";
import { IconToolCropSplit, IconAutoDetect } from "@/components/shared/StudioIcons";
import { CropModuleConfig, CropBox, SplitLine, CropTargetBase, CropParity } from "@/types/book_studio";
import { SplitLinesEditor } from "./SplitLinesEditor";
import { CropTargetPopover } from "./CropTargetPopover";
import { getNextCutLine } from "@/lib/splitLines";

export interface CropSplitPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  selectedPageId?: string | null;
  sessionId: string | null;
  open: boolean;
  onToggle: () => void;
}

export function CropSplitPanel({
  cropModule,
  setCropModule,
  isDetectingCrop,
  detectCrop,
  splitSpread,
  applyCrop,
  selectedPageId,
  sessionId,
  open,
  onToggle,
}: CropSplitPanelProps) {
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const splitLines = cropModule.splitLines;
  const hasCutLines = splitLines.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTargetMenuOpen(false);
      }
    };
    if (targetMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [targetMenuOpen]);

  const setLines = (lines: SplitLine[]) => {
    setCropModule((prev) => ({ ...prev, splitLines: lines }));
  };

  const handleAddCutLine = () => {
    setLines([...splitLines, getNextCutLine(splitLines)]);
  };

  const setTarget = (base: CropTargetBase, parity: CropParity = "both", customRange = "") => {
    setCropModule((prev) => ({
      ...prev,
      target: { base, parity, customRange: customRange || prev.target.customRange },
    }));
    if (base !== "range") setTargetMenuOpen(false);
  };

  const targetLabel = useMemo(() => {
    const t = cropModule.target;
    if (t.base === "current") return "Current";
    if (t.base === "range") return `Range (${t.customRange || "..."})`;
    if (t.parity === "odds") return "Odds";
    if (t.parity === "evens") return "Evens";
    return "All Pages";
  }, [cropModule.target]);

  const handleApplyAction = () => {
    if (hasCutLines) {
      if (splitSpread) splitSpread();
    } else {
      if (applyCrop) applyCrop();
    }
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        cropModule.enabled ? "bg-[#181D27] border-[#333D52]" : "bg-[#181D27] border-[#242A38]"
      } px-2.5 py-2 space-y-2 select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title="Trim page margins or split spreads along vertical/horizontal cut lines"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <IconToolCropSplit
            size={14}
            className={cropModule.enabled ? "" : "text-slate-400"}
            style={cropModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          />
          <span className="text-xs font-semibold text-slate-200">Crop & Split</span>
        </button>

        <label className="relative inline-flex items-center cursor-pointer" title="Toggle Crop & Split">
          <input
            type="checkbox"
            checked={cropModule.enabled}
            onChange={(e) => setCropModule((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500" style={cropModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined} />
        </label>
      </div>

      {/* Body */}
      {open && (
        <div className={`space-y-2 pt-2 border-t border-[#242A38] ${!cropModule.enabled ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Splits Header + Add Cut */}
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-medium text-slate-400"
              title="Add vertical or horizontal cut lines to slice sheets into separate pages"
            >
              Splits <span className="font-mono text-slate-500">({splitLines.length})</span>
            </span>
            <button
              type="button"
              onClick={handleAddCutLine}
              disabled={!cropModule.enabled}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 hover:text-white bg-[#131720] hover:bg-slate-800 border border-[#283040] transition-colors cursor-pointer"
              title="Add a cut line to split the page"
            >
              <Plus size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />
              <span>Add Cut</span>
            </button>
          </div>

          {/* Cut Line rows */}
          {hasCutLines && (
            <SplitLinesEditor
              lines={splitLines}
              disabled={!cropModule.enabled}
              onLinesChange={setLines}
            />
          )}

          {/* Auto-Detect + Reset */}
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <button
              type="button"
              onClick={() => detectCrop && detectCrop(selectedPageId || undefined)}
              disabled={isDetectingCrop || !sessionId || !cropModule.enabled}
              className="flex items-center justify-center space-x-1 py-1 px-2 bg-[#131720] hover:bg-slate-800 border border-[#283040] text-slate-200 rounded text-[10px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Automatically detect content bounding box and spine fold"
            >
              {isDetectingCrop ? (
                <>
                  <RefreshCw size={11} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <IconAutoDetect size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
                  <span>Auto-Detect</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setCropModule((prev) => ({
                  ...prev,
                  cropBox: { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
                }))
              }
              disabled={!cropModule.enabled}
              className="px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-white bg-[#131720] hover:bg-slate-800 border border-[#283040] rounded transition-colors cursor-pointer disabled:opacity-40 flex items-center"
              title="Reset crop box to full sheet bounds"
            >
              <RotateCcw size={11} />
            </button>
          </div>

          {/* Apply / Split Action Button with Target Popover */}
          <div className="relative z-30" ref={menuRef}>
            <div className="flex rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handleApplyAction}
                disabled={!sessionId || !cropModule.enabled}
                className="flex-1 py-1.5 px-2.5 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: "var(--app-accent, #f59e0b)" }}
                title={hasCutLines ? `Commit split & crop to ${targetLabel}` : `Commit crop to ${targetLabel}`}
              >
                <span>
                  {hasCutLines ? `Split (${targetLabel})` : `Apply (${targetLabel})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMenuOpen((p) => !p)}
                disabled={!sessionId || !cropModule.enabled}
                className="px-2 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 border-l border-black/20 transition-colors cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: "var(--app-accent, #d97706)" }}
                title="Select target pages (All, Current, Odds, Evens, or Custom Range)"
              >
                <ChevronDown size={13} className={`transition-transform ${targetMenuOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {targetMenuOpen && (
              <CropTargetPopover target={cropModule.target} onSelectTarget={setTarget} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
