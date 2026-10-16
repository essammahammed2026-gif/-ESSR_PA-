"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { IconToolCleanup } from "@/components/shared/StudioIcons";
import { RestorationModuleConfig, CleanupColorMode } from "@/types/book_studio";
import { PageScopeSelector } from "./PageScopeSelector";

export interface RestorePanelProps {
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  open: boolean;
  onToggle: () => void;
}

const COLOR_MODES: { id: CleanupColorMode; label: string; tooltip: string }[] = [
  { id: "color", label: "Color", tooltip: "Restore rich colors, contrast, and levels" },
  { id: "grayscale", label: "Grayscale", tooltip: "Clean 8-bit neutral grayscale for black & white scans" },
  { id: "bw", label: "B & W", tooltip: "Crisp adaptive binary black & white for text scans and line art" },
];

export function RestorePanel({ restorationModule, setRestorationModule, open, onToggle }: RestorePanelProps) {
  const colorMode = restorationModule.colorMode || "color";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        restorationModule.enabled ? "bg-[#181D27] border-[#333D52]" : "bg-[#181D27] border-[#242A38]"
      } px-2.5 py-2 space-y-2 select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title="Remove dirty scanner borders, whiten paper background, and convert/enhance scan colors"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <IconToolCleanup
            size={14}
            className={restorationModule.enabled ? "" : "text-slate-400"}
            style={restorationModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          />
          <span className="text-xs font-semibold text-slate-200">Cleanup & Colors</span>
        </button>

        <label className="relative inline-flex items-center cursor-pointer" title="Toggle Cleanup">
          <input
            type="checkbox"
            checked={restorationModule.enabled}
            onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div
            className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
            style={restorationModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
          />
        </label>
      </div>

      {/* Body */}
      {open && (
        <div className={`pt-2 border-t border-[#242A38] space-y-2.5 ${!restorationModule.enabled ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Color Mode Tabs */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Color Mode</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]">
              {COLOR_MODES.map((m) => {
                const isActive = colorMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRestorationModule((prev) => ({ ...prev, colorMode: m.id }))}
                    className={`py-1 rounded font-medium transition-colors cursor-pointer text-center ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                    style={isActive ? { color: "var(--app-accent, #f59e0b)" } : undefined}
                    title={m.tooltip}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paper Whitening Toggle */}
          <div className="flex items-center justify-between text-[11px] p-1.5 bg-[#131720] rounded-md border border-[#242A38]">
            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300" title="Eliminates yellow/gray paper background tint & scanner bleed-through">
              <input
                type="checkbox"
                checked={restorationModule.whitenBg}
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, whitenBg: e.target.checked }))}
                className="rounded accent-amber-500"
              />
              <span>Whiten Paper Background</span>
            </label>
          </div>

          {/* Mode-specific Controls */}
          {colorMode === "bw" ? (
            <div className="space-y-1 p-1.5 bg-[#131720] rounded-md border border-[#242A38]" title="Adjust black & white threshold sensitivity">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">B&W Threshold</span>
                <span className="font-mono font-semibold text-slate-200">{restorationModule.bwThreshold ?? 180}</span>
              </div>
              <input
                type="range"
                min="60"
                max="240"
                step="2"
                value={restorationModule.bwThreshold ?? 180}
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, bwThreshold: parseInt(e.target.value, 10) }))}
                className="w-full h-1 accent-amber-500 cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-1.5 pt-0.5">
              {colorMode === "color" && (
                <div className="space-y-0.5" title="Color saturation boost">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Saturation</span>
                    <span className="font-mono font-semibold text-slate-200">
                      +{Math.round((restorationModule.saturation - 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.8"
                    step="0.05"
                    value={restorationModule.saturation}
                    onChange={(e) => setRestorationModule((prev) => ({ ...prev, saturation: parseFloat(e.target.value) }))}
                    className="w-full h-1 accent-amber-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="space-y-0.5" title="Contrast multiplier">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Contrast</span>
                  <span className="font-mono font-semibold text-slate-200">{restorationModule.contrast.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.4"
                  step="0.02"
                  value={restorationModule.contrast}
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, contrast: parseFloat(e.target.value) }))}
                  className="w-full h-1 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Border Clean */}
          <div
            className="space-y-1 pt-1 border-t border-[#242A38]/60"
            title="Removes dirty glass scanner edges and feed roller shadows along outer borders"
          >
            <div className="flex items-center justify-between text-[11px]">
              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={restorationModule.cleanBorders}
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, cleanBorders: e.target.checked }))}
                  className="rounded accent-amber-500"
                />
                <span>Border Clean</span>
              </label>
              {restorationModule.cleanBorders && (
                <span className="font-mono text-slate-200 font-semibold">{restorationModule.borderMarginPx} px</span>
              )}
            </div>

            {restorationModule.cleanBorders && (
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={restorationModule.borderMarginPx}
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, borderMarginPx: parseInt(e.target.value, 10) }))}
                className="w-full h-1 accent-amber-500 cursor-pointer"
              />
            )}
          </div>

          <PageScopeSelector
            scope={restorationModule.scope}
            onChange={(sc) => setRestorationModule((prev) => ({ ...prev, scope: sc }))}
          />
        </div>
      )}
    </div>
  );
}
