"use client";

import React, { useMemo } from "react";
import { ChevronDown, Crop, Sparkles, RefreshCw, Scissors, Columns, Undo2 } from "lucide-react";
import { CropModuleConfig, CropBox, BookStudioPage, SplitLine } from "@/types/book_studio";
import { DimensionsBox } from "./DimensionsBox";
import { SplitLinesEditor } from "./SplitLinesEditor";
import { CropTargetSelector } from "./CropTargetSelector";
import { cutPageCount, type AxisSegments } from "@/lib/splitLines";
import { resolveCropTarget } from "@/lib/cropTarget";

export interface CropSplitPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  selectedPage?: BookStudioPage;
  selectedPageId?: string | null;
  isSelectedPageSplit: boolean;
  hasSplitPages: boolean;
  currentCropWidthMm: number;
  currentCropHeightMm: number;
  segments: AxisSegments;
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
  revertSpread,
  applyCrop,
  selectedPage,
  selectedPageId,
  isSelectedPageSplit,
  hasSplitPages,
  currentCropWidthMm,
  currentCropHeightMm,
  segments,
  sessionId,
  open,
  onToggle,
}: CropSplitPanelProps) {
  const splitLines = cropModule.splitLines;
  const hasCutLines = splitLines.length > 0;
  const pageCount = cutPageCount(splitLines);
  const targetLabel = useMemo(
    () => resolveCropTarget([], selectedPageId, cropModule.target).label,
    [selectedPageId, cropModule.target]
  );

  const setLines = (lines: SplitLine[]) => {
    setCropModule((prev) => ({ ...prev, splitLines: lines }));
  };
  return (
    <div className={`rounded-xl border transition-all ${
      cropModule.enabled
        ? "bg-[#181D27] border-amber-500/40 shadow-sm shadow-amber-950/20"
        : "bg-[#181D27] border-[#242A38]"
    } p-3 shadow-sm space-y-2.5`}>
      {/* Dropdown Header with Caret & Master Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title={open ? "Collapse Crop & Split options" : "Expand Crop & Split options"}
        >
          <div className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}>
            <ChevronDown size={14} />
          </div>
          <div className={`w-5 h-5 rounded flex items-center justify-center ${
            cropModule.enabled ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
          }`}>
            <Scissors size={13} />
          </div>
          <span className="text-xs font-bold text-slate-200">Crop & Split</span>
        </button>

        {/* Master Enable Toggle */}
        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-mono uppercase font-semibold ${
            cropModule.enabled ? "text-amber-400" : "text-slate-500"
          }`}>
            {cropModule.enabled ? "Active" : "Off"}
          </span>
          <label className="relative inline-flex items-center cursor-pointer" title="Toggle Crop & Split Module">
            <input
              type="checkbox"
              checked={cropModule.enabled}
              onChange={(e) => setCropModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {/* Dropdown Body */}
      {open && (
        <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${
          !cropModule.enabled ? "opacity-75" : ""
        }`}>
          {/* Cut lines: empty = plain crop; add lines to cut into pages */}
          <SplitLinesEditor lines={splitLines}
            disabled={isSelectedPageSplit} onLinesChange={setLines} />

          {/* Split Page Status & Revert Banner */}
          {isSelectedPageSplit && selectedPage && (
            <div className="p-2 bg-amber-950/30 border border-amber-800/40 rounded-lg flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-amber-300">
                <Scissors size={12} className="text-amber-400" />
                <span className="font-semibold">Split Page ({selectedPage.label || selectedPage.half})</span>
              </div>
              <button
                type="button"
                onClick={() => revertSpread && revertSpread("current", selectedPageId || undefined)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium border border-amber-500/40 transition-colors cursor-pointer"
                title="Recombine into original 2-page spread to reposition crop or seam"
              >
                <Undo2 size={10} />
                <span>Revert to Spread</span>
              </button>
            </div>
          )}

          {/* Live Resulting Dimensions Box (presentational) */}
          <DimensionsBox currentCropWidthMm={currentCropWidthMm} currentCropHeightMm={currentCropHeightMm} segments={segments} hasCutLines={hasCutLines} isSelectedPageSplit={isSelectedPageSplit} splitPageWidthMm={selectedPage?.width_mm} splitPageHeightMm={selectedPage?.height_mm} />
          {/* Auto-Detect Book Bounds & Reset Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => detectCrop && detectCrop(selectedPageId || undefined)}
              disabled={isDetectingCrop || !sessionId}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 rounded text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              title="Scan image contrast to automatically detect the book perimeter and central spine crease"
            >
              {isDetectingCrop ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-amber-400" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={11} className="text-amber-400" />
                  <span>Auto-Detect Bounds</span>
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
              className="px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 bg-[#131720] hover:bg-slate-800 border border-[#2E3648] rounded transition-colors cursor-pointer whitespace-nowrap"
              title="Reset crop box to full sheet boundaries"
            >
              Reset Full Bed
            </button>
          </div>

          {/* Target pages: All (default) / Current / Custom + Odds-Evens refinements */}
          <CropTargetSelector
            target={cropModule.target}
            onChange={(t) => setCropModule((prev) => ({ ...prev, target: t }))}
          />

          {/* Single action across the target: cut when lines exist, otherwise crop */}
          <div className="space-y-1.5 pt-0.5">
            {hasCutLines && !isSelectedPageSplit ? (
              <button
                type="button"
                onClick={() => splitSpread && splitSpread()}
                disabled={!sessionId}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Crops scanner bed space and cuts along the cut lines across the target pages"
              >
                <Columns size={12} />
                <span>Split ({pageCount} Page{pageCount > 1 ? "s" : ""} × {targetLabel})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => applyCrop && applyCrop()}
                disabled={!sessionId}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Commits the crop box across the target pages — repeat crops refine the visible region"
              >
                <Crop size={12} />
                <span>Apply Crop ({targetLabel})</span>
              </button>
            )}

            {/* Revert Options (Revert Current Page, Revert All) */}
            {hasSplitPages && (
              <div className="pt-1.5 border-t border-[#242A38] grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => revertSpread && revertSpread("current", selectedPageId || undefined)}
                  disabled={!isSelectedPageSplit}
                  className="flex items-center justify-center space-x-1 py-1 px-1.5 text-[10px] text-slate-300 hover:text-white bg-[#131720] hover:bg-slate-800 border border-[#2E3648] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Recombines this selected page and its sibling back into the original spread"
                >
                  <Undo2 size={10} />
                  <span>Revert Current</span>
                </button>

                <button
                  type="button"
                  onClick={() => revertSpread && revertSpread("all")}
                  className="flex items-center justify-center space-x-1 py-1 px-1.5 text-[10px] text-amber-400/90 hover:text-amber-300 bg-[#131720] hover:bg-amber-950/30 border border-amber-900/40 rounded transition-colors cursor-pointer"
                  title="Recombines ALL split spreads in the entire document back into uncut sheets"
                >
                  <Undo2 size={10} />
                  <span>Revert All</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
