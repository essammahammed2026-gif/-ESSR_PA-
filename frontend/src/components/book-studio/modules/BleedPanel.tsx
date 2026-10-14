"use client";

import React from "react";
import { ChevronDown, Crop } from "lucide-react";
import { BleedModuleConfig } from "@/types/book_studio";
import { PageScopeSelector } from "./PageScopeSelector";

export interface BleedPanelProps {
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  open: boolean;
  onToggle: () => void;
}

export function BleedPanel({ bleedModule, setBleedModule, open, onToggle }: BleedPanelProps) {
  return (
    <div className={`rounded-xl border transition-all ${
      bleedModule.enabled
        ? "bg-[#181D27] border-cyan-500/40 shadow-sm shadow-cyan-950/20"
        : "bg-[#181D27] border-[#242A38]"
    } p-3 shadow-sm space-y-2.5`}>
      {/* Dropdown Header with Caret & Master Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title={open ? "Collapse Bleed options" : "Expand Bleed options"}
        >
          <div className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}>
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
      {open && (
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
  );
}
