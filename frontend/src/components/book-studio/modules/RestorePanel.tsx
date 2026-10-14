"use client";

import React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { RestorationModuleConfig } from "@/types/book_studio";
import { PageScopeSelector } from "./PageScopeSelector";

export interface RestorePanelProps {
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  open: boolean;
  onToggle: () => void;
}

export function RestorePanel({ restorationModule, setRestorationModule, open, onToggle }: RestorePanelProps) {
  return (
    <div className={`rounded-xl border transition-all ${
      restorationModule.enabled
        ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
        : "bg-[#181D27] border-[#242A38]"
    } p-3 shadow-sm space-y-2.5`}>
      {/* Dropdown Header with Caret & Master Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title={open ? "Collapse Restoration options" : "Expand Restoration options"}
        >
          <div className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}>
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
      {open && (
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
  );
}
