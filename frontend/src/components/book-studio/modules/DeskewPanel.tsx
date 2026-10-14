"use client";

import React from "react";
import { ChevronDown, Compass, RefreshCw, RotateCcw } from "lucide-react";
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
    <div className={`rounded-xl border transition-all ${
      deskewModule.enabled
        ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
        : "bg-[#181D27] border-[#242A38]"
    } p-3 shadow-sm space-y-2.5`}>
      {/* Dropdown Header with Caret & Master Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title={open ? "Collapse Deskew options" : "Expand Deskew options"}
        >
          <div className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}>
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
      {open && (
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
  );
}
