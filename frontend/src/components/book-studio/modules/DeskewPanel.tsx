"use client";

import React from "react";
import { ChevronDown, RefreshCw, RotateCcw } from "lucide-react";
import { IconToolDeskew } from "@/components/shared/StudioIcons";
import { DeskewModuleConfig } from "@/types/book_studio";
import { PageScopeSelector } from "./PageScopeSelector";

export interface DeskewPanelProps {
  deskewModule: DeskewModuleConfig;
  setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  isDetectingAngle?: boolean;
  detectedAngle?: number | null;
  detectPageAngle?: (pageId?: string) => Promise<number | null>;
  selectedPageId?: string | null;
  sessionId: string | null;
  open: boolean;
  onToggle: () => void;
}

export function DeskewPanel({
  deskewModule,
  setDeskewModule,
  isDetectingAngle,
  detectedAngle,
  detectPageAngle,
  selectedPageId,
  sessionId,
  open,
  onToggle,
}: DeskewPanelProps) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        deskewModule.enabled ? "bg-[#181D27] border-[#333D52]" : "bg-[#181D27] border-[#242A38]"
      } px-2.5 py-2 space-y-2 select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title="Straighten skewed page scans using automatic baseline detection or manual angle adjustment"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <IconToolDeskew
            size={14}
            className={deskewModule.enabled ? "" : "text-slate-400"}
            style={deskewModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          />
          <span className="text-xs font-semibold text-slate-200">Deskew</span>
        </button>

        <label className="relative inline-flex items-center cursor-pointer" title="Toggle Deskew">
          <input
            type="checkbox"
            checked={deskewModule.enabled}
            onChange={(e) => setDeskewModule((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div
            className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
            style={deskewModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
          />
        </label>
      </div>

      {/* Body */}
      {open && (
        <div className={`pt-2 border-t border-[#242A38] space-y-2 ${!deskewModule.enabled ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Mode Selector: Auto vs Manual */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]">
            <button
              type="button"
              onClick={() => setDeskewModule((prev) => ({ ...prev, mode: "auto" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                deskewModule.mode === "auto"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={deskewModule.mode === "auto" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Automatically detect text baseline tilt using projection profiles"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setDeskewModule((prev) => ({ ...prev, mode: "manual" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                deskewModule.mode === "manual"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={deskewModule.mode === "manual" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Manually adjust page rotation angle with a fine slider"
            >
              Manual
            </button>
          </div>

          {/* Auto Mode Controls */}
          {deskewModule.mode === "auto" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400" title="Measured baseline skew angle on current page">Tilt</span>
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono font-semibold text-slate-200">
                    {detectedAngle !== null && detectedAngle !== undefined
                      ? `${-detectedAngle > 0 ? "+" : ""}${(-detectedAngle).toFixed(1)}°`
                      : "—"}
                  </span>
                  {detectedAngle !== null && detectedAngle !== undefined && (
                    <button
                      type="button"
                      onClick={() => setDeskewModule((prev) => ({ ...prev, mode: "manual", angle: detectedAngle }))}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Open this detected angle in Manual mode for fine adjustment"
                    >
                      edit
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => detectPageAngle && detectPageAngle(selectedPageId || undefined)}
                  disabled={isDetectingAngle || !sessionId}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 bg-[#131720] hover:bg-slate-800 border border-[#283040] text-slate-200 rounded text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Scan current page text lines to measure tilt angle"
                >
                  {isDetectingAngle ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />
                      <span>Detect Tilt</span>
                    </>
                  )}
                </button>

                <div className="flex items-center bg-[#131720] border border-[#242A38] rounded p-0.5" title="Maximum angle search range">
                  {[5, 10, 15].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setDeskewModule((prev) => ({ ...prev, maxAngle: deg }))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        deskewModule.maxAngle === deg
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                      style={deskewModule.maxAngle === deg ? { color: "var(--app-accent, #f59e0b)" } : undefined}
                      title={`Limit angle detection to ±${deg}°`}
                    >
                      ±{deg}°
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Manual Mode Controls */
            <div className="space-y-1" title="Drag slider to micro-rotate page (-10° CW to +10° CCW)">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Angle</span>
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono font-semibold text-slate-200">
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
                onChange={(e) => setDeskewModule((prev) => ({ ...prev, angle: parseFloat(e.target.value) }))}
                className="w-full h-1 accent-amber-500 cursor-pointer"
              />
            </div>
          )}

          {/* Compact Checkboxes with Hover Tooltips */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <label
              className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-300 truncate"
              title="Masks outer 6% edges so scanner bed borders and lid shadows do not distort angle measurement"
            >
              <input
                type="checkbox"
                checked={deskewModule.ignoreBorders}
                onChange={(e) => setDeskewModule((prev) => ({ ...prev, ignoreBorders: e.target.checked }))}
                className="rounded accent-amber-500"
              />
              <span className="truncate">Ignore Margins</span>
            </label>

            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <label
                className="flex items-center space-x-1.5 cursor-pointer truncate"
                title="Overlays horizontal alignment lines across the preview canvas to verify text levelness"
              >
                <input
                  type="checkbox"
                  checked={deskewModule.showGrid}
                  onChange={(e) => setDeskewModule((prev) => ({ ...prev, showGrid: e.target.checked }))}
                  className="rounded accent-amber-500"
                />
                <span className="truncate">Grid</span>
              </label>

              {deskewModule.showGrid && (
                <div className="flex items-center space-x-1 pl-1">
                  <input
                    type="color"
                    value={deskewModule.gridColor || "#06b6d4"}
                    onChange={(e) => setDeskewModule((prev) => ({ ...prev, gridColor: e.target.value }))}
                    className="w-4 h-4 rounded border border-white/20 bg-transparent cursor-pointer p-0 shrink-0"
                    title="Change grid line color"
                  />
                  <span className="text-[9px] font-mono text-slate-400 uppercase">
                    {(deskewModule.gridColor || "#06b6d4").slice(0, 7)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <PageScopeSelector
            scope={deskewModule.scope}
            onChange={(sc) => setDeskewModule((prev) => ({ ...prev, scope: sc }))}
          />
        </div>
      )}
    </div>
  );
}
