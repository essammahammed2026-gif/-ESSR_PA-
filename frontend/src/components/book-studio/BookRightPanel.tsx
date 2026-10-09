"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Crop, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Layers, 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Compass, 
  RotateCcw,
  Scissors,
  Columns,
  Undo2
} from "lucide-react";
import { 
  DeskewModuleConfig, 
  BleedModuleConfig, 
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  BookStudioPage,
  ModulePageScope, 
  ModulePageScopeMode 
} from "@/types/book_studio";

interface PageScopeSelectorProps {
  scope: ModulePageScope;
  onChange: (scope: ModulePageScope) => void;
}

function PageScopeSelector({ scope, onChange }: PageScopeSelectorProps) {
  return (
    <div className="space-y-1.5 pt-1.5 border-t border-[#242A38]/70">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span title="Select which pages this module will be applied to">Target Pages:</span>
        <div className="flex items-center space-x-0.5 bg-[#0D1017] p-0.5 rounded border border-[#242A38]">
          {(["all", "range", "odds", "evens"] as ModulePageScopeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...scope, mode: m })}
              className={`px-1.5 py-0.5 rounded text-[10px] capitalize transition-colors ${
                scope.mode === m
                  ? "bg-cyan-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title={
                m === "all"
                  ? "Apply to all pages in the document"
                  : m === "range"
                  ? "Apply to a custom page range (e.g. 1-5, 8, 11-14)"
                  : m === "odds"
                  ? "Apply only to odd-numbered pages (1, 3, 5...)"
                  : "Apply only to even-numbered pages (2, 4, 6...)"
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {scope.mode === "range" && (
        <div className="pt-0.5">
          <input
            type="text"
            placeholder="e.g. 1-5, 8, 11-14"
            value={scope.customRange}
            onChange={(e) => onChange({ ...scope, customRange: e.target.value })}
            className="w-full bg-[#0D1017] border border-[#242A38] text-slate-200 text-[11px] font-mono px-2 py-1 rounded outline-none focus:border-cyan-500 placeholder:text-slate-600"
            title="Type page numbers or ranges separated by commas, e.g. 1-5, 8, 11-14"
          />
        </div>
      )}
    </div>
  );
}

interface BookRightPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  splitSpread?: (target?: "current" | "scope") => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: (target?: "current" | "scope") => Promise<void>;
  pages: BookStudioPage[];
  deskewModule: DeskewModuleConfig;
  setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  isDetectingAngle?: boolean;
  detectedAngle?: number | null;
  detectPageAngle?: (pageId?: string) => Promise<number | null>;
  selectedPageId?: string | null;
  handleExport: () => void;
  isExporting: boolean;
  sessionId: string | null;
  totalPages: number;
  onCollapse?: () => void;
}

export function BookRightPanel({
  cropModule,
  setCropModule,
  isDetectingCrop,
  detectCrop,
  splitSpread,
  revertSpread,
  applyCrop,
  pages,
  deskewModule,
  setDeskewModule,
  bleedModule,
  setBleedModule,
  restorationModule,
  setRestorationModule,
  isDetectingAngle,
  detectedAngle,
  detectPageAngle,
  selectedPageId,
  handleExport,
  isExporting,
  sessionId,
  totalPages,
  onCollapse,
}: BookRightPanelProps) {
  const [isCropOpen, setIsCropOpen] = useState<boolean>(false);
  const [isDeskewOpen, setIsDeskewOpen] = useState<boolean>(false);
  const [isBleedOpen, setIsBleedOpen] = useState<boolean>(false);
  const [isRestorationOpen, setIsRestorationOpen] = useState<boolean>(false);

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const isSelectedPageSplit = Boolean(selectedPage && (selectedPage.half === "left" || selectedPage.half === "right"));
  const isSpreadCut = !isSelectedPageSplit && cropModule.mode === "spread";
  const hasSplitPages = pages.some((p) => p.half === "left" || p.half === "right");

  const scopeLabel = useMemo(() => {
    if (cropModule.scope.mode === "all") return "All Pages";
    if (cropModule.scope.mode === "odds") return "Odd Pages";
    if (cropModule.scope.mode === "evens") return "Even Pages";
    if (cropModule.scope.mode === "range") {
      return cropModule.scope.customRange
        ? `Scope (${cropModule.scope.customRange})`
        : "Scope";
    }
    return "Scope";
  }, [cropModule.scope]);

  // Page Dimension calculations in millimeters
  const pageBaseWidthMm = useMemo(() => {
    if (selectedPage?.width_mm) return selectedPage.width_mm;
    if (selectedPage?.orig_width_mm) return selectedPage.orig_width_mm;
    return 297.0;
  }, [selectedPage]);

  const pageBaseHeightMm = useMemo(() => {
    if (selectedPage?.height_mm) return selectedPage.height_mm;
    if (selectedPage?.orig_height_mm) return selectedPage.orig_height_mm;
    return 210.0;
  }, [selectedPage]);

  const boxW = Math.max(0.01, cropModule.cropBox.x2 - cropModule.cropBox.x1);
  const boxH = Math.max(0.01, cropModule.cropBox.y2 - cropModule.cropBox.y1);

  const currentCropWidthMm = Math.round(pageBaseWidthMm * boxW * 10) / 10;
  const currentCropHeightMm = Math.round(pageBaseHeightMm * boxH * 10) / 10;

  const leftPageWidthMm = Math.round(currentCropWidthMm * cropModule.splitPos * 10) / 10;
  const rightPageWidthMm = Math.round(currentCropWidthMm * (1 - cropModule.splitPos) * 10) / 10;



  return (
    <div className="flex flex-col space-y-3 pb-2 select-none">
      {/* Top Header with Collapse */}
      <div className="flex items-center justify-between pb-0.5 px-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Controls & Export
        </span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Collapse Right Panel"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Module 0: Crop & Split (Dropdown Card) */}
      <div className={`rounded-xl border transition-all ${
        cropModule.enabled
          ? "bg-[#181D27] border-amber-500/40 shadow-sm shadow-amber-950/20"
          : "bg-[#181D27] border-[#242A38]"
      } p-3 shadow-sm space-y-2.5`}>
        {/* Dropdown Header with Caret & Master Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsCropOpen((prev) => !prev)}
            className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
            title={isCropOpen ? "Collapse Crop & Split options" : "Expand Crop & Split options"}
          >
            <div className={`transition-transform duration-150 text-slate-400 ${isCropOpen ? "rotate-0" : "-rotate-90"}`}>
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
        {isCropOpen && (
          <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${
            !cropModule.enabled ? "opacity-75" : ""
          }`}>
            {/* Mode Selector: Spread (Crop & Split) vs Single (Crop Only) */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#131720] rounded-lg border border-[#242A38] text-[11px]">
              <button
                type="button"
                disabled={isSelectedPageSplit}
                onClick={() => setCropModule((prev) => ({ ...prev, mode: "spread" }))}
                className={`py-1 rounded font-medium transition-colors ${
                  cropModule.mode === "spread" && !isSelectedPageSplit
                    ? "bg-amber-600 text-white shadow-sm"
                    : isSelectedPageSplit
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={isSelectedPageSplit ? "This page is already split. Revert to spread to re-cut." : "Crop blank scanner bed space and split spread into Left and Right pages"}
              >
                2-Page Spread
              </button>
              <button
                type="button"
                onClick={() => setCropModule((prev) => ({ ...prev, mode: "single" }))}
                className={`py-1 rounded font-medium transition-colors ${
                  cropModule.mode === "single" || isSelectedPageSplit
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Crop outer dead margins without splitting"
              >
                Single Page
              </button>
            </div>

            {/* Split Page Status & Revert Banner */}
            {isSelectedPageSplit && selectedPage && (
              <div className="p-2 bg-amber-950/30 border border-amber-800/40 rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 text-amber-300">
                  <Scissors size={12} className="text-amber-400" />
                  <span className="font-semibold">Split Page ({selectedPage.half === "left" ? "Left Half" : "Right Half"})</span>
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

            {/* Live Resulting Dimensions Box */}
            <div className="space-y-1.5 p-2 rounded-lg bg-[#0F131C] border border-amber-500/30">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center space-x-1.5 text-amber-400">
                  <span>📐</span>
                  <span>{isSelectedPageSplit ? "Page Dimensions" : "Resulting Dimensions"}</span>
                </span>
              </div>

              {isSpreadCut ? (
                <div className="space-y-1 text-[10px] font-mono">
                  {/* Full Spread Size */}
                  <div className="flex justify-between items-center bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38]">
                    <span className="text-slate-400 font-sans">Full Spread:</span>
                    <span className="text-slate-200 font-bold">
                      {currentCropWidthMm} × {currentCropHeightMm} mm
                    </span>
                  </div>
                  {/* Left & Right Page Halves */}
                  <div className="grid grid-cols-2 gap-1">
                    <div className="bg-[#181D27] p-1.5 rounded border border-[#242A38] flex flex-col">
                      <div className="text-amber-400 text-[9px] font-sans font-bold">
                        <span>PAGE 1 (LEFT)</span>
                      </div>
                      <span className="text-slate-100 font-bold text-[11px] mt-0.5">
                        {leftPageWidthMm} × {currentCropHeightMm} mm
                      </span>
                    </div>
                    <div className="bg-[#181D27] p-1.5 rounded border border-[#242A38] flex flex-col items-end text-right">
                      <div className="text-amber-400 text-[9px] font-sans font-bold">
                        <span>PAGE 2 (RIGHT)</span>
                      </div>
                      <span className="text-slate-100 font-bold text-[11px] mt-0.5">
                        {rightPageWidthMm} × {currentCropHeightMm} mm
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38] flex justify-between items-center text-[11px] font-mono">
                  <span className="text-slate-400 font-sans text-[10px]">Page Size:</span>
                  <span className="text-amber-300 font-bold">
                    {currentCropWidthMm} × {currentCropHeightMm} mm
                  </span>
                </div>
              )}
            </div>

            {/* Auto-Detect Book Bounds & Reset Buttons */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => detectCrop && detectCrop(selectedPageId || undefined)}
                disabled={isDetectingCrop || !sessionId || isSelectedPageSplit}
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
                    splitPos: 0.5,
                  }))
                }
                className="px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 bg-[#131720] hover:bg-slate-800 border border-[#2E3648] rounded transition-colors cursor-pointer whitespace-nowrap"
                title="Reset crop box to full sheet boundaries"
              >
                Reset Full Bed
              </button>
            </div>

            {/* Action Buttons: Split or Apply Crop */}
            <div className="space-y-1.5 pt-0.5">
              {isSpreadCut ? (
                <>
                  <button
                    type="button"
                    onClick={() => splitSpread && splitSpread("current")}
                    disabled={!sessionId || isSelectedPageSplit}
                    className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Crops scanner bed space and splits current spread into Left and Right pages in the deck"
                  >
                    <Columns size={12} />
                    <span>Split Current Spread (2 Pages)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => splitSpread && splitSpread("scope")}
                    disabled={!sessionId}
                    className="w-full py-1 text-[11px] text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/30 rounded border border-amber-800/40 transition-colors text-center cursor-pointer disabled:opacity-50"
                    title="Applies current crop and spine seam to split spreads according to the page scope"
                  >
                    Split Spreads in {scopeLabel}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => applyCrop && applyCrop("current")}
                    disabled={!sessionId}
                    className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Crops outer dead space on the selected page"
                  >
                    <Crop size={12} />
                    <span>Apply Crop to Page</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyCrop && applyCrop("scope")}
                    disabled={!sessionId}
                    className="w-full py-1 text-[11px] text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/30 rounded border border-amber-800/40 transition-colors text-center cursor-pointer disabled:opacity-50"
                    title="Applies current crop box margins to all pages in the selected scope"
                  >
                    Apply Crop to {scopeLabel}
                  </button>
                </>
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

            {/* Page Range Scope Selector */}
            <PageScopeSelector
              scope={cropModule.scope}
              onChange={(sc) => setCropModule((prev) => ({ ...prev, scope: sc }))}
            />
          </div>
        )}
      </div>

      {/* Module 1: Deskew (Dropdown Card) */}
      <div className={`rounded-xl border transition-all ${
        deskewModule.enabled
          ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
          : "bg-[#181D27] border-[#242A38]"
      } p-3 shadow-sm space-y-2.5`}>
        {/* Dropdown Header with Caret & Master Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsDeskewOpen((prev) => !prev)}
            className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
            title={isDeskewOpen ? "Collapse Deskew options" : "Expand Deskew options"}
          >
            <div className={`transition-transform duration-150 text-slate-400 ${isDeskewOpen ? "rotate-0" : "-rotate-90"}`}>
              <ChevronDown size={14} />
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              deskewModule.enabled ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
            }`}>
              <Compass size={13} />
            </div>
            <span className="text-xs font-bold text-slate-200">Deskew</span>
          </button>

          {/* Master Enable Toggle */}
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-mono uppercase font-semibold ${
              deskewModule.enabled ? "text-cyan-400" : "text-slate-500"
            }`}>
              {deskewModule.enabled ? "Active" : "Off"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer" title="Toggle Deskew Module">
              <input
                type="checkbox"
                checked={deskewModule.enabled}
                onChange={(e) => setDeskewModule((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>
        </div>

        {/* Dropdown Body: Options always visible */}
        {isDeskewOpen && (
          <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${
            !deskewModule.enabled ? "opacity-75" : ""
          }`}>
            {/* Mode Selector: Auto vs Manual */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#131720] rounded-lg border border-[#242A38] text-[11px]">
              <button
                type="button"
                onClick={() => setDeskewModule((prev) => ({ ...prev, mode: "auto" }))}
                className={`py-1 rounded font-medium transition-colors ${
                  deskewModule.mode === "auto"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Automatically detect text baseline tilt using projection profiles"
              >
                Auto Detect
              </button>
              <button
                type="button"
                onClick={() => setDeskewModule((prev) => ({ ...prev, mode: "manual" }))}
                className={`py-1 rounded font-medium transition-colors ${
                  deskewModule.mode === "manual"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Manually adjust page rotation angle with a slider"
              >
                Manual Nudge
              </button>
            </div>

            {/* Auto Mode Controls */}
            {deskewModule.mode === "auto" && (
              <div className="space-y-2 p-2 rounded-lg bg-[#131720] border border-[#242A38]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Current Tilt:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono font-bold text-cyan-400">
                      {detectedAngle !== null && detectedAngle !== undefined
                        ? `${-detectedAngle > 0 ? "+" : ""}${(-detectedAngle).toFixed(1)}°` 
                        : "Ready to analyze"}
                    </span>
                    {detectedAngle !== null && detectedAngle !== undefined && detectedAngle !== 0 && (
                      <span className="text-[10px] text-slate-500 font-mono" title="Applied rotation to level page">
                        (adj: {detectedAngle > 0 ? "+" : ""}{detectedAngle.toFixed(1)}°)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => detectPageAngle && detectPageAngle(selectedPageId || undefined)}
                  disabled={isDetectingAngle || !sessionId}
                  className="w-full flex items-center justify-center space-x-1.5 py-1 px-2 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/40 text-cyan-300 rounded text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  title="Scan current page text lines to measure tilt"
                >
                  {isDetectingAngle ? (
                    <>
                      <RefreshCw size={11} className="animate-spin text-cyan-400" />
                      <span>Analyzing Baselines...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={11} />
                      <span>Re-detect Page Angle</span>
                    </>
                  )}
                </button>

                {detectedAngle !== null && detectedAngle !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeskewModule((prev) => ({ ...prev, mode: "manual", angle: detectedAngle }));
                    }}
                    className="w-full py-0.5 text-[10px] text-cyan-400/80 hover:text-cyan-300 hover:underline cursor-pointer transition-colors text-center"
                    title="Switch to Manual Nudge with this detected angle prefilled"
                  >
                    Adjust in Manual Nudge →
                  </button>
                )}

                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span title="Limit maximum detection angle to prevent over-rotation">Search Range:</span>
                  <div className="flex space-x-1">
                    {[5, 10, 15].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setDeskewModule((prev) => ({ ...prev, maxAngle: deg }))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          deskewModule.maxAngle === deg
                            ? "bg-cyan-600 text-white"
                            : "bg-[#181D27] text-slate-400 hover:text-slate-200"
                        }`}
                        title={`Restrict angle detection to ±${deg}°`}
                      >
                        ±{deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Manual Mode Controls */}
            {deskewModule.mode === "manual" && (
              <div className="space-y-1.5 p-2 rounded-lg bg-[#131720] border border-[#242A38]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Rotation Angle:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono font-bold text-cyan-400">
                      {deskewModule.angle > 0 ? "+" : ""}{deskewModule.angle.toFixed(1)}°
                    </span>
                    {deskewModule.angle !== 0 && (
                      <button
                        type="button"
                        onClick={() => setDeskewModule((prev) => ({ ...prev, angle: 0.0 }))}
                        className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                        title="Reset angle to 0.0°"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="-10.0"
                  max="10.0"
                  step="0.1"
                  value={deskewModule.angle}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDeskewModule((prev) => ({ ...prev, angle: val }));
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                  title="Drag to micro-rotate page"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>-10.0° (CW)</span>
                  <span>0.0°</span>
                  <span>+10.0° (CCW)</span>
                </div>
              </div>
            )}

            {/* Module Preprocessing Options */}
            <div className="space-y-1.5 pt-0.5">
              <label 
                className="flex items-center space-x-2 cursor-pointer text-[11px] text-slate-300"
                title="Masks outer 7% edges so scanner bed borders and lid shadows do not distort angle measurement"
              >
                <input
                  type="checkbox"
                  checked={deskewModule.ignoreBorders}
                  onChange={(e) => setDeskewModule((prev) => ({ ...prev, ignoreBorders: e.target.checked }))}
                  className="rounded accent-cyan-500"
                />
                <span>Ignore Scanner Margins & Shadows</span>
              </label>

              <label 
                className="flex items-center space-x-2 cursor-pointer text-[11px] text-slate-300"
                title="Overlays horizontal guideline drafting rules across the viewport canvas to verify text levelness"
              >
                <input
                  type="checkbox"
                  checked={deskewModule.showGrid}
                  onChange={(e) => setDeskewModule((prev) => ({ ...prev, showGrid: e.target.checked }))}
                  className="rounded accent-cyan-500"
                />
                <span>Show Alignment Drafting Grid</span>
              </label>
            </div>

            {/* Page Range Scope Selector */}
            <PageScopeSelector
              scope={deskewModule.scope}
              onChange={(sc) => setDeskewModule((prev) => ({ ...prev, scope: sc }))}
            />
          </div>
        )}
      </div>

      {/* Module 2: Print Bleed & Marks (Dropdown Card) */}
      <div className={`rounded-xl border transition-all ${
        bleedModule.enabled
          ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
          : "bg-[#181D27] border-[#242A38]"
      } p-3 shadow-sm space-y-2.5`}>
        {/* Dropdown Header with Caret & Master Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsBleedOpen((prev) => !prev)}
            className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
            title={isBleedOpen ? "Collapse Bleed options" : "Expand Bleed options"}
          >
            <div className={`transition-transform duration-150 text-slate-400 ${isBleedOpen ? "rotate-0" : "-rotate-90"}`}>
              <ChevronDown size={14} />
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              bleedModule.enabled ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
            }`}>
              <Crop size={13} />
            </div>
            <span className="text-xs font-bold text-slate-200">Print Bleed</span>
          </button>

          {/* Master Enable Toggle */}
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-mono uppercase font-semibold ${
              bleedModule.enabled ? "text-cyan-400" : "text-slate-500"
            }`}>
              {bleedModule.enabled ? "Active" : "Off"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer" title="Toggle Print Bleed Module">
              <input
                type="checkbox"
                checked={bleedModule.enabled}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>
        </div>

        {/* Dropdown Body: Options always visible */}
        {isBleedOpen && (
          <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${
            !bleedModule.enabled ? "opacity-75" : ""
          }`}>
            {/* Bleed Slider with on-hover tooltip */}
            <div 
              className="space-y-1.5"
              title="Mirrors outer edge pixels to synthesize standard print bleed for safe guillotine cutting"
            >
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Bleed Width:</span>
                <span className="font-mono font-bold text-cyan-400">{bleedModule.bleedMm.toFixed(1)} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={bleedModule.bleedMm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setBleedModule((prev) => ({ ...prev, bleedMm: val }));
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Crop Marks Toggle */}
            <label 
              className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300 pt-0.5"
              title="Draws vector corner cut marks indicating trim boundaries"
            >
              <input
                type="checkbox"
                checked={bleedModule.showCropMarks}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, showCropMarks: e.target.checked }))}
                className="rounded accent-cyan-500"
              />
              <span className="text-xs">Draw Vector Crop Marks</span>
            </label>

            {/* Export DPI Quality */}
            <div className="pt-1 border-t border-[#242A38]/70 space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Export Resolution</label>
              <div className="relative">
                <select
                  value={bleedModule.exportDpi}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setBleedModule((prev) => ({ ...prev, exportDpi: val }));
                  }}
                  className="w-full appearance-none bg-[#131720] border border-[#2E3648] text-slate-200 text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                >
                  <option value="150">150 DPI (Fast / Draft)</option>
                  <option value="200">200 DPI (Standard Press)</option>
                  <option value="300">300 DPI (High-End Production)</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Page Range Scope Selector */}
            <PageScopeSelector
              scope={bleedModule.scope}
              onChange={(sc) => setBleedModule((prev) => ({ ...prev, scope: sc }))}
            />
          </div>
        )}
      </div>

      {/* Module 3: Restoration & Cleanup (Dropdown Card) */}
      <div className={`rounded-xl border transition-all ${
        restorationModule.enabled
          ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
          : "bg-[#181D27] border-[#242A38]"
      } p-3 shadow-sm space-y-2.5`}>
        {/* Dropdown Header with Caret & Master Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsRestorationOpen((prev) => !prev)}
            className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
            title={isRestorationOpen ? "Collapse Restoration options" : "Expand Restoration options"}
          >
            <div className={`transition-transform duration-150 text-slate-400 ${isRestorationOpen ? "rotate-0" : "-rotate-90"}`}>
              <ChevronDown size={14} />
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              restorationModule.enabled ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
            }`}>
              <Sparkles size={13} />
            </div>
            <span className="text-xs font-bold text-slate-200">Restoration & Cleanup</span>
          </button>

          {/* Master Enable Toggle */}
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-mono uppercase font-semibold ${
              restorationModule.enabled ? "text-cyan-400" : "text-slate-500"
            }`}>
              {restorationModule.enabled ? "Active" : "Off"}
            </span>
            <label className="relative inline-flex items-center cursor-pointer" title="Toggle Restoration Module">
              <input
                type="checkbox"
                checked={restorationModule.enabled}
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>
        </div>

        {/* Dropdown Body: Options always visible */}
        {isRestorationOpen && (
          <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${
            !restorationModule.enabled ? "opacity-75" : ""
          }`}>
            {/* Border Cleaning Toggle & Slider with on-hover tooltip */}
            <div 
              className="space-y-2 p-2 bg-[#131720] rounded-lg border border-[#242A38]"
              title="Removes dirty glass scanner edges and feed shadows along outer borders"
            >
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={restorationModule.cleanBorders}
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, cleanBorders: e.target.checked }))}
                  className="rounded accent-cyan-500"
                />
                <span className="font-semibold text-xs">Edge & Border Cleanup</span>
              </label>

              {restorationModule.cleanBorders && (
                <div className="pt-1 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Edge Depth:</span>
                    <span className="font-mono font-bold text-cyan-400">{restorationModule.borderMarginPx} px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    step="1"
                    value={restorationModule.borderMarginPx}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setRestorationModule((prev) => ({ ...prev, borderMarginPx: val }));
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Paper Whitening & Contrast with on-hover tooltip */}
            <div 
              className="space-y-2 p-2 bg-[#131720] rounded-lg border border-[#242A38]"
              title="Clears yellow/milky scanner haze, deepens text blacks, and boosts color richness"
            >
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={restorationModule.enhanceColors}
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, enhanceColors: e.target.checked }))}
                  className="rounded accent-cyan-500"
                />
                <span className="font-semibold text-xs">Paper Whitening & Contrast</span>
              </label>

              {restorationModule.enhanceColors && (
                <div className="pt-1 space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Saturation:</span>
                      <span className="font-mono font-bold text-cyan-400">
                        +{Math.round((restorationModule.saturation - 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="1.8"
                      step="0.05"
                      value={restorationModule.saturation}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRestorationModule((prev) => ({ ...prev, saturation: val }));
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Contrast:</span>
                      <span className="font-mono font-bold text-cyan-400">{restorationModule.contrast.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="1.4"
                      step="0.02"
                      value={restorationModule.contrast}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRestorationModule((prev) => ({ ...prev, contrast: val }));
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Page Range Scope Selector */}
            <PageScopeSelector
              scope={restorationModule.scope}
              onChange={(sc) => setRestorationModule((prev) => ({ ...prev, scope: sc }))}
            />
          </div>
        )}
      </div>

      {/* 4. Export & Inter-Studio Handoff */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#242A38] pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
            <Download size={14} className="text-cyan-400" />
            <span>Export & Handoff</span>
          </div>
          {sessionId && (
            <span className="text-[10px] font-mono text-slate-400">
              {totalPages} pages
            </span>
          )}
        </div>

        {/* Main Export Button */}
        <button
          onClick={handleExport}
          disabled={!sessionId || isExporting}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              <span>Rendering PDF...</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Export Cleaned Book PDF</span>
            </>
          )}
        </button>

        {/* Studio Handoffs */}
        <div className="pt-2 border-t border-[#242A38] space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Workflow Handoffs</div>
          <Link
            href="/imposing"
            className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs"
          >
            <div className="flex items-center space-x-2">
              <Layers size={13} className="text-cyan-400" />
              <span>Send to Imposing Studio</span>
            </div>
            <span className="text-[10px] text-slate-500">Booklet / Gang</span>
          </Link>

          <Link
            href="/flipbook"
            className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs"
          >
            <div className="flex items-center space-x-2">
              <BookOpen size={13} className="text-cyan-400" />
              <span>Preview in 3D Flipbook</span>
            </div>
            <span className="text-[10px] text-slate-500">Proofing</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
