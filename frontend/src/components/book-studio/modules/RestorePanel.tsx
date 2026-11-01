"use client";

import React from "react";
import { Check, RotateCcw } from "lucide-react";
import {
  RestorationModuleConfig,
  CleanupColorMode,
  ModuleTaskProgress,
  BookStudioPage,
  AppliedModuleEntry,
} from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, formatScopeLabel } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface RestorePanelProps {
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  pageColorMode?: CleanupColorMode | null;
  onSetPageColorMode?: (mode: CleanupColorMode | null, targetIds?: string[], clearAll?: boolean) => void;
  resetRestoration?: () => Promise<void> | void;
  colorOverridePagesCount?: number;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  isDualPage?: boolean;
  onSelectPageId?: (id: string) => void;
  onRecordHistory?: (label: string, nextRestore: RestorationModuleConfig) => void;
  shortcutLabels?: Record<string, string>;
}

const COLOR_MODES: { id: CleanupColorMode; label: string; desc: string }[] = [
  { id: "auto", label: "Auto", desc: "Color + crisp text" },
  { id: "color", label: "Color", desc: "Tone boost" },
  { id: "grayscale", label: "Gray", desc: "8-bit monochrome" },
  { id: "bw", label: "B&W", desc: "Line art" },
];

export function RestorePanel({
  restorationModule,
  setRestorationModule,
  onSetPageColorMode,
  resetRestoration,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  isDualPage = false,
  onSelectPageId,
  onRecordHistory,
  shortcutLabels = {},
}: RestorePanelProps) {
  const colorMode = restorationModule.colorMode || "auto";

  const handleApply = () => {
    const concrete = resolveConcretePageNumbers(pages, restorationModule.scope, selectedPageId);
    const label = `Color & Tone (${concrete.scopeLabel} • ${colorMode.toUpperCase()})`;
    const isAll = restorationModule.scope.mode === "all";

    const currentEntry: AppliedModuleEntry = {
      id: `restore_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: "Color & Tone",
      details: `${colorMode.toUpperCase()} • Sat ${restorationModule.saturation.toFixed(2)}x • Con ${restorationModule.contrast.toFixed(2)}x`,
      scopeLabel: concrete.scopeLabel,
      origScope: isAll ? "all" : undefined,
      targetPages: concrete.pageNumbers,
      targetPageIds: concrete.pageIds,
      visible: true,
      params: {
        colorMode,
        saturation: restorationModule.saturation,
        contrast: restorationModule.contrast,
        whitenBg: restorationModule.whitenBg,
        bwThreshold: restorationModule.bwThreshold,
        cleanBorders: restorationModule.cleanBorders,
        sharpen: restorationModule.sharpen,
      },
    };

    const existing = restorationModule.appliedEntries || [];
    const updated = [...existing.filter((e) => e.scopeLabel !== concrete.scopeLabel), currentEntry];
    const nextRestore: RestorationModuleConfig = {
      ...restorationModule,
      enabled: true,
      appliedEntries: updated,
    };
    setRestorationModule(nextRestore);
    onRecordHistory?.(label, nextRestore);

    if (onSetPageColorMode) {
      onSetPageColorMode(colorMode, concrete.pageIds);
    }
  };

  return (
    <div className="space-y-5 select-none">
      <ModuleProgressBar task={taskProgress} />

      {/* Section 1: Color Mode */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Mode
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          {COLOR_MODES.map((m) => {
            const isActive = colorMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setRestorationModule((prev) => ({ ...prev, enabled: true, colorMode: m.id }))}
                className={`p-2 rounded-md text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#252B3B] text-white font-semibold"
                    : "bg-[#161A23] hover:bg-[#1C212C] text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">{m.label}</span>
                  {isActive && <Check size={11} />}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Paper & Contrast */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Tone
        </span>

        {/* Paper Whitening Toggle */}
        <label
          className="flex items-center justify-between py-1 cursor-pointer text-xs text-slate-300"
          title="Eliminates yellow/gray paper background tint & scanner bleed-through"
        >
          <span>Whiten Background</span>
          <input
            type="checkbox"
            checked={restorationModule.whitenBg}
            onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: true, whitenBg: e.target.checked }))}
            className="rounded accent-blue-600"
          />
        </label>

        {/* Mode-specific Sliders */}
        {colorMode === "bw" ? (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Threshold</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-semibold text-slate-200">
                  {restorationModule.bwThreshold ?? 180}
                </span>
                {(restorationModule.bwThreshold ?? 180) !== 180 && (
                  <button
                    type="button"
                    onClick={() => setRestorationModule((prev) => ({ ...prev, enabled: true, bwThreshold: 180 }))}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    reset
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min="60"
              max="240"
              step="2"
              value={restorationModule.bwThreshold ?? 180}
              onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: true, bwThreshold: parseInt(e.target.value, 10) }))}
              className="w-full h-1.5 bg-[#161A23] rounded-lg accent-blue-500 cursor-pointer"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {(colorMode === "color" || colorMode === "auto") && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Vibrance</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-semibold text-slate-200">
                      +{Math.round((restorationModule.saturation - 1.0) * 100)}%
                    </span>
                    {Math.abs(restorationModule.saturation - 1.2) > 0.01 && (
                      <button
                        type="button"
                        onClick={() => setRestorationModule((prev) => ({ ...prev, enabled: true, saturation: 1.2 }))}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.8"
                  step="0.05"
                  value={restorationModule.saturation}
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: true, saturation: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-[#161A23] rounded-lg accent-blue-500 cursor-pointer"
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Contrast</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-semibold text-slate-200">
                    {restorationModule.contrast.toFixed(2)}x
                  </span>
                  {Math.abs(restorationModule.contrast - 1.15) > 0.01 && (
                    <button
                      type="button"
                      onClick={() => setRestorationModule((prev) => ({ ...prev, enabled: true, contrast: 1.15 }))}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      reset
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="1.0"
                max="1.4"
                step="0.02"
                value={restorationModule.contrast}
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: true, contrast: parseFloat(e.target.value) }))}
                className="w-full h-1.5 bg-[#161A23] rounded-lg accent-blue-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Scope & Apply */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Scope & Apply
        </span>

        <PageScopeSelector
          scope={restorationModule.scope}
          onChange={(sc) => setRestorationModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
          pages={pages}
          selectedPageId={selectedPageId}
          isDualPage={isDualPage}
          onSelectPageId={onSelectPageId}
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1"
            title={`Apply color mode to ${formatScopeLabel(restorationModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{`Apply (${formatScopeLabel(restorationModule.scope, activePageNum)})`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (resetRestoration) {
                void resetRestoration();
              } else {
                onSetPageColorMode?.(null, undefined, true);
                setRestorationModule((prev) => ({
                  ...prev,
                  enabled: false,
                  cleanBorders: false,
                  borderMarginPx: 15,
                  borderThreshold: 210,
                  enhanceColors: true,
                  saturation: 1.30,
                  contrast: 1.10,
                  colorMode: "auto",
                  bwThreshold: 180,
                  whitenBg: false,
                  sharpen: true,
                  appliedEntries: [],
                }));
              }
            }}
            className="px-3 py-2 bg-[#161A23] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center space-x-1"
            title="Reset all color & tone modifications across the entire document"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RestorePanel;
