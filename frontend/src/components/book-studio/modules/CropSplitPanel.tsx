"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown,
  Sparkles,
  RefreshCw,
  Scissors,
  Plus,
} from "lucide-react";
import { CropModuleConfig, CropBox, BookStudioPage, SplitLine, CropTargetBase, CropParity } from "@/types/book_studio";
import { DimensionsBox } from "./DimensionsBox";
import { SplitLinesEditor } from "./SplitLinesEditor";
import { CropTargetPopover } from "./CropTargetPopover";
import { buildSegments, getNextCutLine } from "@/lib/splitLines";

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
  pageBaseWidthMm?: number;
  pageBaseHeightMm?: number;
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
  selectedPage,
  selectedPageId,
  isSelectedPageSplit,
  currentCropWidthMm,
  currentCropHeightMm,
  sessionId,
  open,
  onToggle,
}: CropSplitPanelProps) {
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const splitLines = cropModule.splitLines;
  const hasCutLines = splitLines.length > 0;

  const segments = useMemo(
    () => buildSegments(splitLines, currentCropWidthMm, currentCropHeightMm),
    [splitLines, currentCropWidthMm, currentCropHeightMm]
  );

  // Close target dropdown on outside click
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
    if (t.base === "current") return "Current Page";
    if (t.base === "range") return `Range (${t.customRange || "..."})`;
    if (t.parity === "odds") return "Odd Pages";
    if (t.parity === "evens") return "Even Pages";
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
    <div className={`rounded-xl border transition-all ${
      cropModule.enabled
        ? "bg-[#181D27] border-amber-500/40 shadow-sm shadow-amber-950/20"
        : "bg-[#181D27] border-[#242A38]"
    } p-3 space-y-3 select-none`}>
      {/* Header: Caret, Scissors Badge, Title, Styled Toggle Switch */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}>
            <ChevronDown size={15} />
          </div>
          <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Scissors size={14} />
          </div>
          <span className="text-sm font-bold text-slate-100">Crop & Split</span>
        </button>

        {/* Master ON/OFF Switch matching concept.png */}
        <button
          type="button"
          onClick={() => setCropModule((prev) => ({ ...prev, enabled: !prev.enabled }))}
          className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all ${
            cropModule.enabled
              ? "bg-cyan-600/90 text-white shadow-sm ring-1 ring-cyan-400/50"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle Crop & Split"
        >
          {cropModule.enabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Accordion Content */}
      {open && (
        <div className={`space-y-3 pt-1 border-t border-[#242A38] ${!cropModule.enabled ? "opacity-75" : ""}`}>
          {/* Live Resulting Dimensions Box (presentational) */}
          <DimensionsBox
            currentCropWidthMm={currentCropWidthMm}
            currentCropHeightMm={currentCropHeightMm}
            segments={segments}
            hasCutLines={hasCutLines}
            isSelectedPageSplit={isSelectedPageSplit}
            splitPageWidthMm={selectedPage?.width_mm}
            splitPageHeightMm={selectedPage?.height_mm}
          />

          {/* Split Sheet (N Cuts) Row with + Add Cut Line */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-300">
              Split Sheet <span className="text-slate-500 font-mono text-[11px]">({splitLines.length} Cuts)</span>
            </span>
            <button
              type="button"
              onClick={handleAddCutLine}
              disabled={!cropModule.enabled}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Plus size={12} />
              <span>Add Cut Line</span>
            </button>
          </div>

          {/* Cut Line sliders when cuts exist */}
          {hasCutLines && (
            <SplitLinesEditor
              lines={splitLines}
              disabled={!cropModule.enabled}
              onLinesChange={setLines}
            />
          )}


          {/* Action Buttons: Auto-Detect Bounds + Reset */}
          <div className="grid grid-cols-[1fr_auto] gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => detectCrop && detectCrop(selectedPageId || undefined)}
              disabled={isDetectingCrop || !sessionId || !cropModule.enabled}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-[#131720] hover:bg-slate-800 border border-[#2E3648] hover:border-amber-500/40 text-slate-200 hover:text-amber-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
            >
              {isDetectingCrop ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-amber-400" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} className="text-amber-400" />
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
              disabled={!cropModule.enabled}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#131720] hover:bg-slate-800 border border-[#2E3648] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Reset crop to full sheet"
            >
              Reset
            </button>
          </div>

          {/* Unified Action Dropdown Button: [ Apply to All Pages ˅ ] */}
          <div className="relative pt-1" ref={menuRef}>
            <div className="flex rounded-xl overflow-hidden shadow-lg shadow-amber-950/30">
              <button
                type="button"
                onClick={handleApplyAction}
                disabled={!sessionId || !cropModule.enabled}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                style={{ backgroundColor: "var(--app-accent, #f59e0b)" }}
              >
                <span>
                  {hasCutLines
                    ? `Split Sheet: Apply to ${targetLabel}`
                    : `Apply to ${targetLabel}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMenuOpen((p) => !p)}
                disabled={!sessionId || !cropModule.enabled}
                className="px-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 border-l border-amber-600/60 transition-colors cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: "var(--app-accent, #d97706)" }}
                title="Change Target Pages"
              >
                <ChevronDown size={14} className={`transition-transform ${targetMenuOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Target Options Popover Menu */}
            {targetMenuOpen && (
              <CropTargetPopover target={cropModule.target} onSelectTarget={setTarget} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
