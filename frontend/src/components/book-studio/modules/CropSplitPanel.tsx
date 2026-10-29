"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
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
} from "@/types/book_studio";
import { SplitLinesEditor } from "./SplitLinesEditor";
import { ModuleProgressBar } from "./PageScopeSelector";
import { getNextCutLine, cutPageCount } from "@/lib/splitLines";
import {
  LengthUnit,
  getStoredUnit,
  mmToUnit,
  unitToMm,
  formatMmInUnit,
} from "@/lib/units";

export interface CropSplitPanelProps {
  mode?: "crop" | "split";
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
  revertSplitLevel?: (pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  revertCropLevel?: (scopeMode?: "current" | "all") => Promise<void> | void;
  resetCrop?: (scopeMode?: "current" | "all") => Promise<void> | void;
  removeAppliedCrop?: (id: string) => Promise<void> | void;
  removeAllAppliedCrops?: () => Promise<void> | void;
  taskProgress?: ModuleTaskProgress;
  selectedPageId?: string | null;
  sessionId: string | null;
  pages?: BookStudioPage[];
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
  isDualPage?: boolean;
  focusCropPage?: (pageId: string, visibleIds: string[]) => void;
}

const TARGET_PRESETS: {
  id: string;
  label: string;
  base: CropTargetBase;
  parity: CropParity;
  tip: string;
}[] = [
  { id: "current", label: "Page", base: "current", parity: "both", tip: "Apply only to current page" },
  { id: "all", label: "All", base: "all", parity: "both", tip: "Apply across all pages" },
  { id: "odds", label: "Odds", base: "all", parity: "odds", tip: "Apply only to odd pages" },
  { id: "evens", label: "Evens", base: "all", parity: "evens", tip: "Apply only to even pages" },
  { id: "range", label: "Range", base: "range", parity: "both", tip: "Apply to custom page range" },
];

export function CropSplitPanel({
  mode = "crop",
  cropModule,
  setCropModule,
  isDualPage = false,
  focusCropPage,
  splitSpread,
  applyCrop,
  taskProgress,
  selectedPageId,
  sessionId,
  pages = [],
  shortcutLabels = {},
}: CropSplitPanelProps) {
  const splitLines = cropModule.splitLines;
  const hasCutLines = splitLines.length > 0;
  const piecesPerSheet = cutPageCount(splitLines);
  const isSplitMode = mode === "split";

  const rawIdx = pages && selectedPageId ? pages.findIndex((p) => p.id === selectedPageId) : -1;
  const pairStartIdx = isDualPage && rawIdx >= 0 ? Math.floor(rawIdx / 2) * 2 : rawIdx;
  const leftPageId = (pairStartIdx >= 0 && pages[pairStartIdx]) ? pages[pairStartIdx].id : (selectedPageId ?? pages[0]?.id ?? "");
  const leftPageNum = pairStartIdx >= 0 ? pairStartIdx + 1 : 1;
  const hasRightPage = Boolean(isDualPage && pages && pairStartIdx >= 0 && pairStartIdx + 1 < pages.length);
  const rightPageId = hasRightPage && pages ? pages[pairStartIdx + 1].id : "";
  const rightPageNum = hasRightPage ? leftPageNum + 1 : undefined;

  const isDualActive = Boolean(isDualPage && hasRightPage);
  const isDualLinked = isDualActive && (cropModule.target.dualSides?.length ?? 2) >= 2;
  const activeDualSide = isDualActive && cropModule.target.dualSides?.length === 1
    ? cropModule.target.dualSides[0]
    : null;

  const handleToggleDual = () => {
    if (cropModule.target.base !== "current") {
      setCropModule((prev) => ({
        ...prev,
        target: { ...prev.target, base: "current", parity: "both", dualSides: ["left", "right"] },
      }));
      return;
    }
    if (isDualLinked) {
      focusCropPage?.(leftPageId, [leftPageId, rightPageId]);
      setCropModule((prev) => ({
        ...prev,
        target: { ...prev.target, dualSides: ["left"] },
      }));
    } else {
      setCropModule((prev) => ({
        ...prev,
        target: { ...prev.target, dualSides: ["left", "right"] },
      }));
    }
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
        dualSides: base === "current" && isDualActive ? (prev.target.dualSides ?? ["left", "right"]) : undefined,
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

  const activePage = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    if (isDualActive && activeDualSide === "right" && rightPageId) {
      return pages.find((p) => p.id === rightPageId) || pages[0];
    }
    if (isDualActive && leftPageId) {
      return pages.find((p) => p.id === leftPageId) || pages[0];
    }
    if (selectedPageId) return pages.find((p) => p.id === selectedPageId) || pages[0];
    return pages[0];
  }, [pages, selectedPageId, isDualActive, activeDualSide, rightPageId, leftPageId]);

  const handleApplyAction = async () => {
    if (isSplitMode) {
      if (splitSpread) void splitSpread();
    } else {
      if (applyCrop) void applyCrop();
    }
  };

  const pageWidthMm = activePage?.width_mm || activePage?.orig_width_mm || 210;
  const pageHeightMm = activePage?.height_mm || activePage?.orig_height_mm || 297;

  const [isMarginsOpen, setIsMarginsOpen] = useState(false);

  const [selectedUnit] = useState<LengthUnit>(() => getStoredUnit("mm"));

  const unitMode = cropModule.unitMode || "unit";
  const isLocked = (cropModule.aspectLock || "free") === "lock" || cropModule.aspectLock === "all";

  const insets = useMemo(() => {
    const b = cropModule.cropBox;
    if (unitMode === "unit") {
      const leftMm = b.x1 * pageWidthMm;
      const topMm = b.y1 * pageHeightMm;
      const rightMm = (1.0 - b.x2) * pageWidthMm;
      const bottomMm = (1.0 - b.y2) * pageHeightMm;
      return {
        left: Math.round(mmToUnit(leftMm, selectedUnit) * 10) / 10,
        top: Math.round(mmToUnit(topMm, selectedUnit) * 10) / 10,
        right: Math.round(mmToUnit(rightMm, selectedUnit) * 10) / 10,
        bottom: Math.round(mmToUnit(bottomMm, selectedUnit) * 10) / 10,
        unitLabel: selectedUnit,
      };
    }
    return {
      left: Math.round(b.x1 * 1000) / 10,
      top: Math.round(b.y1 * 1000) / 10,
      right: Math.round((1.0 - b.x2) * 1000) / 10,
      bottom: Math.round((1.0 - b.y2) * 1000) / 10,
      unitLabel: "%",
    };
  }, [cropModule.cropBox, unitMode, selectedUnit, pageWidthMm, pageHeightMm]);

  const croppedBadge = useMemo(() => {
    const b = cropModule.cropBox;
    const wMm = Math.max(0, (b.x2 - b.x1) * pageWidthMm);
    const hMm = Math.max(0, (b.y2 - b.y1) * pageHeightMm);
    const areaPct = Math.round((b.x2 - b.x1) * (b.y2 - b.y1) * 1000) / 10;
    const formattedW = formatMmInUnit(wMm, selectedUnit);
    const formattedH = formatMmInUnit(hMm, selectedUnit);
    return {
      dimsText: `${formattedW} × ${formattedH}`,
      areaPct: `${areaPct.toFixed(1)}%`,
    };
  }, [cropModule.cropBox, pageWidthMm, pageHeightMm, selectedUnit]);

  const handleInsetChange = (side: "left" | "top" | "right" | "bottom", nextVal: number) => {
    const cleanVal = Math.max(0, nextVal);

    setCropModule((prev) => {
      const b = { ...prev.cropBox };
      const lockMode = (prev.aspectLock || "free") === "lock" || prev.aspectLock === "all";

      let x1 = b.x1;
      let y1 = b.y1;
      let x2 = b.x2;
      let y2 = b.y2;

      if (unitMode === "unit") {
        const curLeftMm = b.x1 * pageWidthMm;
        const curRightMm = (1.0 - b.x2) * pageWidthMm;
        const curTopMm = b.y1 * pageHeightMm;
        const curBottomMm = (1.0 - b.y2) * pageHeightMm;

        const curSideMm =
          side === "left" ? curLeftMm :
          side === "right" ? curRightMm :
          side === "top" ? curTopMm : curBottomMm;

        const targetSideMm = unitToMm(cleanVal, selectedUnit);
        const deltaMm = targetSideMm - curSideMm;

        if (lockMode) {
          const minMarginMm = Math.min(curLeftMm, curRightMm, curTopMm, curBottomMm);
          const maxShrinkW = Math.max(0, (pageWidthMm - curLeftMm - curRightMm - 2) / 2);
          const maxShrinkH = Math.max(0, (pageHeightMm - curTopMm - curBottomMm - 2) / 2);
          const maxDeltaMm = Math.min(maxShrinkW, maxShrinkH);
          const minDeltaMm = -minMarginMm;
          const clampedDeltaMm = Math.max(minDeltaMm, Math.min(maxDeltaMm, deltaMm));

          const nextLeftMm = curLeftMm + clampedDeltaMm;
          const nextRightMm = curRightMm + clampedDeltaMm;
          const nextTopMm = curTopMm + clampedDeltaMm;
          const nextBottomMm = curBottomMm + clampedDeltaMm;

          x1 = Math.max(0, nextLeftMm / Math.max(1, pageWidthMm));
          x2 = Math.min(1.0, 1.0 - nextRightMm / Math.max(1, pageWidthMm));
          y1 = Math.max(0, nextTopMm / Math.max(1, pageHeightMm));
          y2 = Math.min(1.0, 1.0 - nextBottomMm / Math.max(1, pageHeightMm));
        } else {
          let nextLeftMm = curLeftMm;
          let nextRightMm = curRightMm;
          let nextTopMm = curTopMm;
          let nextBottomMm = curBottomMm;

          if (side === "left") {
            const maxAllowed = Math.max(0, pageWidthMm - curRightMm - 2);
            nextLeftMm = Math.max(0, Math.min(targetSideMm, maxAllowed));
          } else if (side === "right") {
            const maxAllowed = Math.max(0, pageWidthMm - curLeftMm - 2);
            nextRightMm = Math.max(0, Math.min(targetSideMm, maxAllowed));
          } else if (side === "top") {
            const maxAllowed = Math.max(0, pageHeightMm - curBottomMm - 2);
            nextTopMm = Math.max(0, Math.min(targetSideMm, maxAllowed));
          } else if (side === "bottom") {
            const maxAllowed = Math.max(0, pageHeightMm - curTopMm - 2);
            nextBottomMm = Math.max(0, Math.min(targetSideMm, maxAllowed));
          }

          x1 = Math.max(0, nextLeftMm / Math.max(1, pageWidthMm));
          x2 = Math.min(1.0, 1.0 - nextRightMm / Math.max(1, pageWidthMm));
          y1 = Math.max(0, nextTopMm / Math.max(1, pageHeightMm));
          y2 = Math.min(1.0, 1.0 - nextBottomMm / Math.max(1, pageHeightMm));
        }
      } else {
        const curLeftRatio = b.x1;
        const curRightRatio = 1.0 - b.x2;
        const curTopRatio = b.y1;
        const curBottomRatio = 1.0 - b.y2;

        const curSideRatio =
          side === "left" ? curLeftRatio :
          side === "right" ? curRightRatio :
          side === "top" ? curTopRatio : curBottomRatio;

        const targetSideRatio = cleanVal / 100;
        const deltaRatio = targetSideRatio - curSideRatio;

        if (lockMode) {
          const minMarginRatio = Math.min(curLeftRatio, curRightRatio, curTopRatio, curBottomRatio);
          const maxShrinkW = Math.max(0, (1.0 - curLeftRatio - curRightRatio - 0.02) / 2);
          const maxShrinkH = Math.max(0, (1.0 - curTopRatio - curBottomRatio - 0.02) / 2);
          const maxDeltaRatio = Math.min(maxShrinkW, maxShrinkH);
          const minDeltaRatio = -minMarginRatio;
          const clampedDeltaRatio = Math.max(minDeltaRatio, Math.min(maxDeltaRatio, deltaRatio));

          const nextLeftRatio = curLeftRatio + clampedDeltaRatio;
          const nextRightRatio = curRightRatio + clampedDeltaRatio;
          const nextTopRatio = curTopRatio + clampedDeltaRatio;
          const nextBottomRatio = curBottomRatio + clampedDeltaRatio;

          x1 = Math.max(0, nextLeftRatio);
          x2 = Math.min(1.0, 1.0 - nextRightRatio);
          y1 = Math.max(0, nextTopRatio);
          y2 = Math.min(1.0, 1.0 - nextBottomRatio);
        } else {
          let nextLeftRatio = curLeftRatio;
          let nextRightRatio = curRightRatio;
          let nextTopRatio = curTopRatio;
          let nextBottomRatio = curBottomRatio;

          if (side === "left") {
            const maxAllowed = Math.max(0, 1.0 - curRightRatio - 0.02);
            nextLeftRatio = Math.max(0, Math.min(targetSideRatio, maxAllowed));
          } else if (side === "right") {
            const maxAllowed = Math.max(0, 1.0 - curLeftRatio - 0.02);
            nextRightRatio = Math.max(0, Math.min(targetSideRatio, maxAllowed));
          } else if (side === "top") {
            const maxAllowed = Math.max(0, 1.0 - curBottomRatio - 0.02);
            nextTopRatio = Math.max(0, Math.min(targetSideRatio, maxAllowed));
          } else if (side === "bottom") {
            const maxAllowed = Math.max(0, 1.0 - curTopRatio - 0.02);
            nextBottomRatio = Math.max(0, Math.min(targetSideRatio, maxAllowed));
          }

          x1 = Math.max(0, nextLeftRatio);
          x2 = Math.min(1.0, 1.0 - nextRightRatio);
          y1 = Math.max(0, nextTopRatio);
          y2 = Math.min(1.0, 1.0 - nextBottomRatio);
        }
      }

      const nextBox = {
        x1: Math.round(x1 * 1000) / 1000,
        y1: Math.round(y1 * 1000) / 1000,
        x2: Math.round(x2 * 1000) / 1000,
        y2: Math.round(y2 * 1000) / 1000,
      };

      const prevBox = prev.cropBox;
      const pbW = Math.max(0.02, prevBox.x2 - prevBox.x1);
      const pbH = Math.max(0.02, prevBox.y2 - prevBox.y1);
      const nbW = Math.max(0.02, nextBox.x2 - nextBox.x1);
      const nbH = Math.max(0.02, nextBox.y2 - nextBox.y1);
      const lines = prev.splitLines.map((ln) => {
        const absPos = ln.direction === "horizontal" ? prevBox.y1 + ln.pos * pbH : prevBox.x1 + ln.pos * pbW;
        const relInNew = ln.direction === "horizontal" ? (absPos - nextBox.y1) / nbH : (absPos - nextBox.x1) / nbW;
        return {
          ...ln,
          pos: Math.round(Math.max(0.01, Math.min(0.99, relInNew)) * 1000) / 1000,
        };
      });
      const sPos = lines[0]?.pos ?? prev.splitPos;

      return {
        ...prev,
        cropBox: nextBox,
        splitLines: lines,
        splitPos: Math.round(sPos * 1000) / 1000,
      };
    });
  };

  const handleStepInset = (side: "left" | "top" | "right" | "bottom", direction: 1 | -1) => {
    const curVal = insets[side];
    const step = unitMode === "unit" ? (selectedUnit === "cm" ? 0.2 : selectedUnit === "inches" ? 0.1 : 1.0) : 0.5;
    const nextVal = Math.max(0, Math.round((curVal + direction * step) * 10) / 10);
    handleInsetChange(side, nextVal);
  };

  return (
    <div className="space-y-5 select-none">
      <ModuleProgressBar task={taskProgress} />

      {/* Section 1: Dimensions & Margins (Crop Tool Only) */}
      {!isSplitMode && (
      <div className="space-y-3">
        {/* Live Cropped Dimension Badge */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-slate-400">Dimensions</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold text-slate-200">
              {croppedBadge.dimsText}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161A23] text-slate-300">
              {croppedBadge.areaPct}
            </span>
          </div>
        </div>

        {/* Collapsible Margins Section (collapsed by default) */}
        <div className="pt-2 border-t border-[#1E232E]">
          <button
            type="button"
            onClick={() => setIsMarginsOpen((p) => !p)}
            className="w-full flex items-center justify-between py-1.5 px-2 rounded-md bg-[#161A23] hover:bg-[#1C212C] transition-all cursor-pointer group text-left"
            title={isMarginsOpen ? "Collapse margins panel" : "Expand margins panel"}
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              <ChevronDown
                size={13}
                className={`text-slate-400 group-hover:text-white transition-transform duration-200 shrink-0 ${
                  isMarginsOpen ? "rotate-180 text-white" : ""
                }`}
              />
              <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                Margins
              </span>
            </div>

            {!isMarginsOpen ? (
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                L:{insets.left} T:{insets.top} R:{insets.right} B:{insets.bottom} {insets.unitLabel}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-400">
                {isLocked ? "Locked" : "Free"}
              </span>
            )}
          </button>

          {isMarginsOpen && (
            <div className="space-y-2.5 pt-2.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Controls</span>

                <div className="flex items-center gap-1.5">
                  {/* Unit Toggle (% vs Default Unit) */}
                  <div className="inline-flex rounded-md bg-[#161A23] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCropModule((prev) => ({ ...prev, unitMode: "percent" }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        unitMode === "percent"
                          ? "bg-[#252B3B] text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Percentage insets (%)"
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setCropModule((prev) => ({ ...prev, unitMode: "unit" }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        unitMode === "unit"
                          ? "bg-[#252B3B] text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title={`Physical unit insets (${selectedUnit})`}
                    >
                      {selectedUnit}
                    </button>
                  </div>

                  {/* Aspect Ratio Lock Toggle: Lock vs Free */}
                  <div className="inline-flex rounded-md bg-[#161A23] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCropModule((prev) => ({ ...prev, aspectLock: "lock" }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        isLocked
                          ? "bg-[#252B3B] text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Lock: All sides move together"
                    >
                      Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => setCropModule((prev) => ({ ...prev, aspectLock: "free" }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        !isLocked
                          ? "bg-[#252B3B] text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Free: Each side moves freely"
                    >
                      Free
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Directional Step Inputs (Left, Right, Top, Bottom) */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "left" as const, label: "Left" },
                  { key: "right" as const, label: "Right" },
                  { key: "top" as const, label: "Top" },
                  { key: "bottom" as const, label: "Bottom" },
                ]).map(({ key, label }) => {
                  const val = insets[key];
                  const stepAmt = unitMode === "unit" ? (selectedUnit === "cm" ? 0.2 : selectedUnit === "inches" ? 0.1 : 1.0) : 0.5;
                  return (
                    <div
                      key={key}
                      className="flex flex-col p-2 bg-[#161A23] rounded-md gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-300">
                          {label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {insets.unitLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStepInset(key, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[#222836] hover:bg-[#2C3345] text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-30"
                          disabled={val <= 0}
                          title={`Decrease ${label}`}
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          step={stepAmt}
                          min={0}
                          value={val}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            handleInsetChange(key, isNaN(parsed) ? 0 : parsed);
                          }}
                          className="w-full text-center text-xs font-mono font-semibold bg-[#11141B] rounded py-1 px-1 text-slate-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepInset(key, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[#222836] hover:bg-[#2C3345] text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                          title={`Increase ${label}`}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Section 2: Splits (Split Tool Only) */}
      {isSplitMode && (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Cut Lines
            </span>
            {hasCutLines && (
              <span className="text-[10px] font-mono text-slate-300">
                ({splitLines.length} cut{splitLines.length > 1 ? "s" : ""} → {piecesPerSheet}p)
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
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md text-xs font-medium text-slate-200 bg-[#161A23] hover:bg-[#1C212C] transition-colors cursor-pointer"
            title={`Add vertical cut line (${shortcutLabels.add_cut || "X"})`}
          >
            <Plus size={11} className="text-slate-400" />
            <IconSplitVertical size={12} className="text-slate-400" />
            <span>Vertical</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddCutLine("horizontal")}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md text-xs font-medium text-slate-200 bg-[#161A23] hover:bg-[#1C212C] transition-colors cursor-pointer"
            title="Add horizontal cut line"
          >
            <Plus size={11} className="text-slate-400" />
            <IconSplitHorizontal size={12} className="text-slate-400" />
            <span>Horizontal</span>
          </button>
        </div>

        {hasCutLines ? (
          <SplitLinesEditor
            lines={splitLines}
            disabled={false}
            onLinesChange={setLines}
          />
        ) : (
          <p className="text-[10px] text-slate-500 text-center py-1">
            Click + Vertical or + Horizontal to add a cut line
          </p>
        )}
      </div>
      )}

      {/* Section 3: Scope & Commit Action */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
          <span className="font-bold uppercase tracking-wider shrink-0 text-slate-500">Scope</span>
          <div className="inline-flex items-center gap-0.5 bg-[#161A23] p-0.5 rounded-md">
            {isDualActive ? (
              <button
                type="button"
                onClick={handleToggleDual}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer leading-tight ${
                  activeTargetId === "current" && isDualLinked
                    ? "bg-[#252B3B] text-white font-semibold ring-1 ring-amber-500/40"
                    : activeTargetId === "current" && !isDualLinked
                    ? "bg-[#1E2330] text-amber-300 font-medium ring-1 ring-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={
                  isDualLinked
                    ? "Dual Mode: Linked (edits apply to both pages). Click to edit individually."
                    : "Dual Mode: Unlinked (editing individually). Click to link both pages."
                }
              >
                Dual
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTarget("current", "both")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer leading-tight ${
                  activeTargetId === "current"
                    ? "bg-[#252B3B] text-white font-semibold ring-1 ring-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={`Current Page (${leftPageNum})`}
              >
                P.{leftPageNum}
              </button>
            )}

            {TARGET_PRESETS.filter((p) => p.id !== "current").map((opt) => {
              const active = activeTargetId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTarget(opt.base, opt.parity)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer leading-tight ${
                    active
                      ? "bg-[#252B3B] text-white font-semibold ring-1 ring-amber-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={opt.tip}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dual Mode Unlinked Individual Page Indicator */}
        {isDualActive && activeTargetId === "current" && !isDualLinked && (
          <div className="flex items-center justify-between text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium">Editing {activeDualSide === "right" ? `Page ${rightPageNum}` : `Page ${leftPageNum}`}</span>
            </div>
            <span className="text-slate-500 text-[9px]">Click or drag on either page to switch</span>
          </div>
        )}

        {cropModule.target.base === "range" && (
          <input
            type="text"
            placeholder="e.g. 1-5, 8, 11-14"
            value={cropModule.target.customRange}
            onChange={(e) => setTarget("range", "both", e.target.value)}
            className="w-full bg-[#161A23] text-slate-200 text-xs font-mono px-2.5 py-1.5 rounded-md outline-none placeholder:text-slate-500"
            title="Type page numbers or ranges separated by commas"
          />
        )}

        {/* Action Controls: Apply */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleApplyAction}
            disabled={!sessionId || (isSplitMode && !hasCutLines)}
            className="w-full py-2 px-3 rounded-md bg-slate-100 hover:bg-white disabled:bg-[#161A23] text-slate-950 disabled:text-slate-500 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            title={isSplitMode ? `Commit split (${shortcutLabels.apply_action || "Enter"})` : `Commit crop (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{isSplitMode ? "Split" : "Apply"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
