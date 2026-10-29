"use client";

import React from "react";
import { RefreshCw, RotateCcw, Sparkles, Ruler, Grid } from "lucide-react";
import { DeskewModuleConfig, ModuleTaskProgress, BookStudioPage } from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, formatScopeLabel } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface DeskewPanelProps {
  deskewModule: DeskewModuleConfig;
  setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  isDetectingAngle?: boolean;
  detectedAngle?: number | null;
  detectPageAngle?: (pageId?: string) => Promise<number | null>;
  detectAllPageAngles?: () => Promise<Record<string, number> | null>;
  pageDeskewAngle?: number | null;
  onChangePageAngle?: (angle: number) => void;
  onClearAllAngles?: () => void;
  resetDeskew?: (scopeMode?: "current" | "all") => Promise<void> | void;
  straightenActive?: boolean;
  onToggleStraighten?: () => void;
  deskewedPagesCount?: number;
  taskProgress?: ModuleTaskProgress;
  selectedPageId?: string | null;
  sessionId: string | null;
  pages?: BookStudioPage[];
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

export function DeskewPanel({
  deskewModule,
  setDeskewModule,
  isDetectingAngle,
  detectedAngle,
  detectPageAngle,
  detectAllPageAngles,
  pageDeskewAngle,
  onChangePageAngle,
  onClearAllAngles,
  resetDeskew,
  straightenActive = false,
  onToggleStraighten,
  taskProgress,
  selectedPageId,
  sessionId,
  pages = [],
  activePageNum,
  shortcutLabels = {},
}: DeskewPanelProps) {
  const effectiveAngle =
    pageDeskewAngle !== null && pageDeskewAngle !== undefined
      ? pageDeskewAngle
      : detectedAngle !== null && detectedAngle !== undefined
        ? detectedAngle
        : deskewModule.angle;

  const applyAngle = (nextAngle: number) => {
    const clamped = Math.max(-15, Math.min(15, Math.round(nextAngle * 100) / 100));
    if (selectedPageId && onChangePageAngle) {
      onChangePageAngle(clamped);
    } else {
      setDeskewModule((prev) => ({ ...prev, enabled: true, mode: "manual", angle: clamped }));
    }
  };

  const handleApply = () => {
    const concrete = resolveConcretePageNumbers(pages, deskewModule.scope, selectedPageId);
    const angleText = `${effectiveAngle > 0 ? "+" : ""}${effectiveAngle.toFixed(2)}°`;
    const label = "Deskew";
    const details = Math.abs(effectiveAngle) > 0.01 ? angleText : "Auto";
    const isAll = deskewModule.scope.mode === "all";

    const params = {
      angle: effectiveAngle,
      ignoreBorders: deskewModule.ignoreBorders,
      maxAngle: deskewModule.maxAngle,
      scope: deskewModule.scope,
    };

    setDeskewModule((prev) => ({
      ...prev,
      enabled: true,
      appliedEntries: [
        ...(prev.appliedEntries || []).filter((e) => e.scopeLabel !== concrete.scopeLabel),
        {
          id: `deskew_${Date.now()}`,
          label,
          details,
          scopeLabel: concrete.scopeLabel,
          origScope: isAll ? "all" : undefined,
          excludedPages: [],
          targetPages: concrete.pageNumbers,
          targetPageIds: concrete.pageIds,
          visible: true,
          params,
        },
      ],
    }));
  };

  return (
    <div className="space-y-5 select-none">
      <ModuleProgressBar task={taskProgress} />

      {/* Section 1: Auto Baseline Detection */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Auto Detect
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => detectPageAngle && void detectPageAngle(selectedPageId || undefined)}
            disabled={isDetectingAngle || !sessionId}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[#161A23] hover:bg-[#1C212C] text-slate-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            title={`Detect tilt angle for the current page (${shortcutLabels.detect_page || "A"})`}
          >
            {isDetectingAngle ? (
              <>
                <RefreshCw size={12} className="animate-spin text-slate-400" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <RotateCcw size={12} className="text-slate-400" />
                <span>Detect</span>
              </>
            )}
          </button>

          {detectAllPageAngles && (
            <button
              type="button"
              onClick={() => void detectAllPageAngles()}
              disabled={isDetectingAngle || !sessionId}
              className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[#161A23] hover:bg-[#1C212C] text-slate-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              title={`Auto-detect individual tilt angle for every page in the book (${shortcutLabels.detect_all || "Shift+A"})`}
            >
              {isDetectingAngle ? (
                <>
                  <RefreshCw size={12} className="animate-spin text-slate-400" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-slate-400" />
                  <span>Detect All</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Manual Ruler & Alignment Grid Tools */}
        <div className="grid grid-cols-2 gap-1.5">
          {onToggleStraighten && (
            <button
              type="button"
              onClick={onToggleStraighten}
              className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                straightenActive
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-[#161A23] hover:bg-[#1C212C] text-slate-300"
              }`}
              title={`Draw Straighten Line on Canvas (${shortcutLabels.straighten_tool || "S"})`}
            >
              <Ruler size={12} />
              <span>{straightenActive ? "Drawing..." : "Draw Ruler"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeskewModule((prev) => ({ ...prev, enabled: true, showGrid: !prev.showGrid }))}
            className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              deskewModule.showGrid
                ? "bg-[#252B3B] text-white font-semibold"
                : "bg-[#161A23] hover:bg-[#1C212C] text-slate-300"
            }`}
            title={`Toggle Alignment Grid (${shortcutLabels.grid_toggle || "G"})`}
          >
            <Grid size={12} />
            <span>Grid</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs text-slate-400">Range</span>
          <div className="flex items-center bg-[#161A23] rounded-md p-0.5" title="Maximum angle search range">
            {[5, 10, 15].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => setDeskewModule((prev) => ({ ...prev, maxAngle: deg }))}
                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  deskewModule.maxAngle === deg
                    ? "bg-[#252B3B] text-white font-semibold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                title={`Limit angle detection to ±${deg}°`}
              >
                ±{deg}°
              </button>
            ))}
          </div>
        </div>

        <label
          className="flex items-center justify-between py-1 cursor-pointer text-xs text-slate-300"
          title="Masks outer 6% edges so scanner bed borders and lid shadows do not distort angle measurement"
        >
          <span>Ignore Margins (6%)</span>
          <input
            type="checkbox"
            checked={deskewModule.ignoreBorders}
            onChange={(e) => setDeskewModule((prev) => ({ ...prev, ignoreBorders: e.target.checked }))}
            className="rounded accent-blue-600"
          />
        </label>
      </div>

      {/* Section 2: Current Page Angle & Precision Fine-Tuning */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Angle
          </span>
          <span className="font-mono text-xs font-semibold text-slate-200">
            {effectiveAngle > 0 ? "+" : ""}{effectiveAngle.toFixed(2)}°
          </span>
        </div>

        <input
          type="range"
          min="-10.0"
          max="10.0"
          step="0.05"
          value={effectiveAngle}
          onChange={(e) => applyAngle(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[#161A23] rounded-lg accent-blue-500 cursor-pointer"
          title="Drag slider to micro-rotate current page (-10° to +10°)"
        />

        {/* Quick Micro-Nudge Bar */}
        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
          {([
            { label: "-0.5°", delta: -0.5 },
            { label: "-0.1°", delta: -0.1 },
            { label: "0°", reset: true },
            { label: "+0.1°", delta: 0.1 },
            { label: "+0.5°", delta: 0.5 },
          ] as const).map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => ("reset" in btn ? applyAngle(0) : applyAngle(effectiveAngle + btn.delta))}
              className={`py-1 rounded transition-colors cursor-pointer ${
                "reset" in btn
                  ? "bg-[#161A23] hover:bg-[#1C212C] text-slate-400 hover:text-white font-sans font-medium"
                  : "bg-[#161A23] hover:bg-[#1C212C] text-slate-200"
              }`}
              title={"reset" in btn ? "Reset current page angle to 0.00°" : `Nudge page angle by ${btn.label}`}
            >
              {"reset" in btn ? "Reset" : btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 3: Scope & Apply */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Scope & Apply
        </span>

        <PageScopeSelector
          scope={deskewModule.scope}
          onChange={(sc) => setDeskewModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1"
            title={`Apply angle to ${formatScopeLabel(deskewModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{`Apply (${formatScopeLabel(deskewModule.scope, activePageNum)})`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const scopeMode = deskewModule.scope.mode === "all" ? "all" : "current";
              if (resetDeskew) {
                void resetDeskew(scopeMode);
              } else if (scopeMode === "all" && onClearAllAngles) {
                onClearAllAngles();
              } else if (onChangePageAngle) {
                onChangePageAngle(0.0);
              }
            }}
            className="px-3 py-2 bg-[#161A23] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center space-x-1"
            title="Reset deskew angle to 0.0°"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
