"use client";

import React, { useState } from "react";
import { Eraser, Trash2, Sun, Square, Pipette, Check } from "lucide-react";
import { IconToolCleanup } from "@/components/shared/StudioIcons";
import {
  CleanupModuleConfig,
  RestorationModuleConfig,
  CleanupColorMode,
  ModuleTaskProgress,
  BookStudioPage,
  AppliedModuleEntry,
} from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, LayerEntryStack, formatScopeLabel } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface CleanupPanelProps {
  cleanupModule: CleanupModuleConfig;
  setCleanupModule: React.Dispatch<React.SetStateAction<CleanupModuleConfig>>;
  maskToolActive: boolean;
  onToggleMaskTool: () => void;
  onActivateMaskEyedropper?: () => void;
  pageMasksCount: number;
  totalMasksCount: number;
  onClearPageMasks: () => void;
  onClearAllMasks: () => void;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

export function CleanupPanel({
  cleanupModule,
  setCleanupModule,
  maskToolActive,
  onToggleMaskTool,
  onActivateMaskEyedropper,
  pageMasksCount,
  totalMasksCount,
  onClearPageMasks,
  onClearAllMasks,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  shortcutLabels = {},
}: CleanupPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleNativeMaskEyedropper = async () => {
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setCleanupModule((prev) => ({ ...prev, maskColor: result.sRGBHex }));
          return;
        }
      } catch {
        // Fallback to canvas click sampling
      }
    }
    if (onActivateMaskEyedropper) {
      onActivateMaskEyedropper();
    }
  };

  const handleEditEntry = (entry: AppliedModuleEntry) => {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    if (entry.params) {
      setCleanupModule((prev) => ({
        ...prev,
        flattenIllumination: entry.params?.flattenIllumination ?? prev.flattenIllumination,
        despeckleLevel: entry.params?.despeckleLevel ?? prev.despeckleLevel,
        maskColor: entry.params?.maskColor ?? prev.maskColor,
        scope: entry.params?.scope ?? prev.scope,
      }));
    }
  };

  const handleApply = () => {
    const concrete = resolveConcretePageNumbers(pages, cleanupModule.scope, selectedPageId);
    const parts: string[] = [];
    if (cleanupModule.flattenIllumination) parts.push("Spine Shadow");
    if (cleanupModule.despeckleLevel > 0) parts.push(`Despeckle L${cleanupModule.despeckleLevel}`);
    const label = parts.length > 0 ? parts.join(" & ") : "Clean BG";
    const details = [
      cleanupModule.flattenIllumination ? "Shadow leveled" : null,
      cleanupModule.despeckleLevel > 0 ? `Despeckle L${cleanupModule.despeckleLevel}` : null,
      (cleanupModule.maskColor || "#ffffff").toLowerCase() !== "#ffffff" ? `Fill ${cleanupModule.maskColor.toUpperCase()}` : null,
    ].filter(Boolean).join(" • ");

    const params = {
      flattenIllumination: cleanupModule.flattenIllumination,
      despeckleLevel: cleanupModule.despeckleLevel,
      maskColor: cleanupModule.maskColor,
      scope: cleanupModule.scope,
    };

    if (editingId) {
      setCleanupModule((prev) => ({
        ...prev,
        appliedEntries: (prev.appliedEntries || []).map((e) =>
          e.id === editingId
            ? {
                ...e,
                label,
                details,
                scopeLabel: concrete.scopeLabel,
                targetPages: concrete.pageNumbers,
                targetPageIds: concrete.pageIds,
                params,
              }
            : e
        ),
      }));
      setEditingId(null);
      return;
    }

    setCleanupModule((prev) => ({
      ...prev,
      enabled: true,
      appliedEntries: [
        ...(prev.appliedEntries || []).filter((e) => e.scopeLabel !== concrete.scopeLabel),
        {
          id: `cleanup_${Date.now()}`,
          label,
          details,
          scopeLabel: concrete.scopeLabel,
          targetPages: concrete.pageNumbers,
          targetPageIds: concrete.pageIds,
          visible: true,
          params,
        },
      ],
    }));
  };

  const handleDeleteApplied = (entryId: string) => {
    setCleanupModule((prev) => {
      const remaining = (prev.appliedEntries || []).filter((e) => e.id !== entryId);
      return {
        ...prev,
        enabled: remaining.length > 0,
        flattenIllumination: remaining.length > 0 ? prev.flattenIllumination : false,
        despeckleLevel: remaining.length > 0 ? prev.despeckleLevel : 0,
        appliedEntries: remaining,
      };
    });
    if (editingId === entryId) {
      setEditingId(null);
    }
  };

  const handleDeleteFromCurrentPage = (entryId: string) => {
    if (!selectedPageId) return;
    setCleanupModule((prev) => {
      const remaining = (prev.appliedEntries || [])
        .map((e) => {
          if (e.id !== entryId) return e;
          const nextIds = (e.targetPageIds || []).filter((id) => id !== selectedPageId);
          const nextPages = activePageNum !== undefined
            ? (e.targetPages || []).filter((n) => n !== activePageNum)
            : (e.targetPages || []);
          return {
            ...e,
            targetPageIds: nextIds,
            targetPages: nextPages,
            scopeLabel: nextPages.length > 0 ? `P.${nextPages.join(",")}` : "None",
          };
        })
        .filter((e) => (e.targetPageIds && e.targetPageIds.length > 0) || (e.targetPages && e.targetPages.length > 0));

      return {
        ...prev,
        enabled: remaining.length > 0,
        flattenIllumination: remaining.length > 0 ? prev.flattenIllumination : false,
        despeckleLevel: remaining.length > 0 ? prev.despeckleLevel : 0,
        appliedEntries: remaining,
      };
    });
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    setCleanupModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => (e.id === id ? { ...e, visible } : e)),
    }));
  };

  const handleToggleAllVisibility = (visible: boolean) => {
    setCleanupModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => ({ ...e, visible })),
    }));
  };

  const handleDeleteAll = () => {
    setCleanupModule((prev) => ({
      ...prev,
      enabled: false,
      flattenIllumination: false,
      despeckleLevel: 0,
      appliedEntries: [],
    }));
    setEditingId(null);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Module Header Banner */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2.5">
            <div
              className="p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] shrink-0 mt-0.5"
              style={cleanupModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            >
              <Eraser size={16} className={cleanupModule.enabled ? "" : "text-slate-400"} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-[var(--text-primary,#f1f5f9)]">Cleanup</h3>
                {totalMasksCount > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {totalMasksCount} box{totalMasksCount > 1 ? "es" : ""}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Erase boxes, shadows & dust.
              </p>
            </div>
          </div>

          <label
            className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
            title={`Toggle Cleanup & Masking (${shortcutLabels.module_cleanup || "3"})`}
          >
            <input
              type="checkbox"
              checked={cleanupModule.enabled}
              onChange={(e) => setCleanupModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div
              className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
              style={cleanupModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            />
          </label>
        </div>

        <ModuleProgressBar task={taskProgress} />
      </div>

      {/* Section 1: Spot Erase / Whiteout Box */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Erase Box
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Page: <strong className="text-[var(--text-primary,#e2e8f0)]">{pageMasksCount}</strong> • All:{" "}
            <strong className="text-[var(--text-primary,#e2e8f0)]">{totalMasksCount}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMaskTool}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
            maskToolActive
              ? "shadow-xs font-bold"
              : "bg-[var(--surface-inset,#131720)] hover:bg-slate-800 text-[var(--text-primary,#e2e8f0)] border-[var(--border-subtle,#242A38)]"
          }`}
          style={
            maskToolActive
              ? {
                  backgroundColor: "var(--app-accent, #f59e0b)",
                  borderColor: "var(--app-accent, #f59e0b)",
                  color: "var(--app-accent-fg, #090d16)",
                }
              : undefined
          }
          title={`Drag a rectangle on the canvas to mask out scanner fingers, staples, or punch holes (${shortcutLabels.mask_tool || "M"})`}
        >
          <Square size={13} className="stroke-[2.2]" style={!maskToolActive ? { color: "var(--app-accent, #f59e0b)" } : undefined} />
          <span>{maskToolActive ? "Drag on Canvas..." : "Draw Box"}</span>
        </button>

        {/* Fill Color Picker */}
        <div className="flex items-center justify-between p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[11px]">
          <span className="text-slate-400">Fill Color</span>
          <div className="flex items-center space-x-1.5">
            <input
              type="color"
              value={cleanupModule.maskColor || "#ffffff"}
              onChange={(e) => setCleanupModule((prev) => ({ ...prev, maskColor: e.target.value }))}
              className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
              title="Choose erase box fill color (Default: #FFFFFF)"
            />
            {onActivateMaskEyedropper && (
              <button
                type="button"
                onClick={handleNativeMaskEyedropper}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-[var(--app-accent,#f59e0b)] transition-colors cursor-pointer"
                title={`Sample paper color directly from page (${shortcutLabels.eyedropper || "I"})`}
              >
                <Pipette size={13} />
              </button>
            )}
            <span className="font-mono text-[10px] text-slate-300 uppercase">
              {(cleanupModule.maskColor || "#ffffff").slice(0, 7)}
            </span>
            {(cleanupModule.maskColor || "#ffffff").toLowerCase() !== "#ffffff" && (
              <button
                type="button"
                onClick={() => setCleanupModule((prev) => ({ ...prev, maskColor: "#ffffff" }))}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer ml-1"
                title="Reset fill color to pure white (#FFFFFF)"
              >
                White
              </button>
            )}
          </div>
        </div>

        {/* Clear Page / Clear All Masks */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={onClearPageMasks}
            disabled={pageMasksCount === 0}
            className="py-1.5 px-2 rounded-lg text-[11px] font-medium bg-[var(--surface-inset,#131720)] hover:bg-slate-800 disabled:opacity-35 text-slate-300 border border-[var(--border-subtle,#242A38)] transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Remove all erase boxes on the current page"
          >
            Clear Page ({pageMasksCount})
          </button>

          <button
            type="button"
            onClick={onClearAllMasks}
            disabled={totalMasksCount === 0}
            className="flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg text-[11px] font-medium bg-[var(--surface-inset,#131720)] hover:bg-red-950/50 disabled:opacity-35 text-red-400 border border-[var(--border-subtle,#242A38)] transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Clear all erase boxes across the entire book"
          >
            <Trash2 size={12} />
            <span>Clear All ({totalMasksCount})</span>
          </button>
        </div>
      </div>

      {/* Section 2: Background Cleanup (Spine Shadows & Despeckle) */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Filters
        </span>

        <label
          className="flex items-center justify-between gap-2 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] cursor-pointer text-[11px]"
          title="Morphological background cleanup: flattens dark book-spine gutter shadows and uneven scan lighting"
        >
          <div className="flex items-center space-x-2">
            <Sun size={14} className="text-amber-400 shrink-0" />
            <span className="font-semibold text-[var(--text-primary,#e2e8f0)]">
              Spine Shadow
            </span>
          </div>
          <input
            type="checkbox"
            checked={cleanupModule.flattenIllumination}
            onChange={(e) =>
              setCleanupModule((prev) => ({ ...prev, flattenIllumination: e.target.checked }))
            }
            className="rounded shrink-0 accent-[var(--app-accent,#f59e0b)]"
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Despeckle</span>
            <span className="font-mono text-[10px] text-slate-300">
              {cleanupModule.despeckleLevel === 0
                ? "Off"
                : cleanupModule.despeckleLevel === 1
                  ? "Light"
                  : cleanupModule.despeckleLevel === 2
                    ? "Medium"
                    : "Strong"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[11px]">
            {([
              { lvl: 0, label: "Off" },
              { lvl: 1, label: "Light" },
              { lvl: 2, label: "Med" },
              { lvl: 3, label: "Strong" },
            ] as const).map((item) => {
              const active = cleanupModule.despeckleLevel === item.lvl;
              return (
                <button
                  key={item.lvl}
                  type="button"
                  onClick={() => setCleanupModule((prev) => ({ ...prev, despeckleLevel: item.lvl }))}
                  className={`py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    active ? "bg-slate-800 text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                  style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                  title="Connected-component dust filter"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <PageScopeSelector
          scope={cleanupModule.scope}
          onChange={(sc) => setCleanupModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-sm hover:opacity-95"
            style={{
              backgroundColor: "var(--app-accent, #f59e0b)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
            title={`Apply erase boxes & filters to ${formatScopeLabel(cleanupModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{editingId ? "Update Entry" : `Apply (${formatScopeLabel(cleanupModule.scope, activePageNum)})`}</span>
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
              title="Cancel editing"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Universal Layer Stack — TCK-02 */}
      <LayerEntryStack
        title="Applied Cleanups"
        entries={cleanupModule.appliedEntries}
        editingId={editingId}
        activePageNum={activePageNum}
        activePageId={selectedPageId}
        onEdit={handleEditEntry}
        onDelete={handleDeleteApplied}
        onDeleteFromCurrentPage={handleDeleteFromCurrentPage}
        onToggleVisibility={handleToggleVisibility}
        onToggleAllVisibility={handleToggleAllVisibility}
        onDeleteAll={handleDeleteAll}
      />
    </div>
  );
}

export interface RestorePanelProps {
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  pageColorMode?: CleanupColorMode | null;
  onSetPageColorMode?: (mode: CleanupColorMode | null, clearAll?: boolean) => void;
  colorOverridePagesCount?: number;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
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
  colorOverridePagesCount = 0,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  shortcutLabels = {},
}: RestorePanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const colorMode = restorationModule.colorMode || "auto";

  const handleEditEntry = (entry: AppliedModuleEntry) => {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    if (entry.params) {
      setRestorationModule((prev) => ({
        ...prev,
        colorMode: entry.params?.colorMode ?? prev.colorMode,
        contrast: entry.params?.contrast ?? prev.contrast,
        saturation: entry.params?.saturation ?? prev.saturation,
        whitenBg: entry.params?.whitenBg ?? prev.whitenBg,
        bwThreshold: entry.params?.bwThreshold ?? prev.bwThreshold,
        enhanceColors: entry.params?.enhanceColors ?? prev.enhanceColors,
        scope: entry.params?.scope ?? prev.scope,
      }));
    }
  };

  const handleApply = () => {
    const concrete = resolveConcretePageNumbers(pages, restorationModule.scope, selectedPageId);
    const modeName = colorMode === "bw" ? "B&W" : colorMode === "grayscale" ? "Gray" : colorMode === "color" ? "Color" : "Auto";
    const label = `${modeName} Mode`;
    const details = [
      `${restorationModule.contrast.toFixed(2)}x Contrast`,
      restorationModule.whitenBg ? "Whiten BG" : null,
      restorationModule.enhanceColors ? "Enhance" : null,
    ].filter(Boolean).join(" • ");

    const params = {
      colorMode,
      contrast: restorationModule.contrast,
      saturation: restorationModule.saturation,
      whitenBg: restorationModule.whitenBg,
      bwThreshold: restorationModule.bwThreshold,
      enhanceColors: restorationModule.enhanceColors,
      scope: restorationModule.scope,
    };

    if (editingId) {
      setRestorationModule((prev) => ({
        ...prev,
        appliedEntries: (prev.appliedEntries || []).map((e) =>
          e.id === editingId
            ? {
                ...e,
                label,
                details,
                scopeLabel: concrete.scopeLabel,
                targetPages: concrete.pageNumbers,
                targetPageIds: concrete.pageIds,
                params,
              }
            : e
        ),
      }));
      setEditingId(null);
      return;
    }

    setRestorationModule((prev) => ({
      ...prev,
      enabled: true,
      appliedEntries: [
        ...(prev.appliedEntries || []).filter((e) => e.scopeLabel !== concrete.scopeLabel),
        {
          id: `color_${Date.now()}`,
          label,
          details,
          scopeLabel: concrete.scopeLabel,
          targetPages: concrete.pageNumbers,
          targetPageIds: concrete.pageIds,
          visible: true,
          params,
        },
      ],
    }));

    if (restorationModule.scope.mode === "current" && onSetPageColorMode) {
      onSetPageColorMode(colorMode);
    }
  };

  const handleDeleteApplied = (entryId: string) => {
    setRestorationModule((prev) => {
      const remaining = (prev.appliedEntries || []).filter((e) => e.id !== entryId);
      return {
        ...prev,
        enabled: remaining.length > 0,
        whitenBg: remaining.length > 0 ? prev.whitenBg : false,
        appliedEntries: remaining,
      };
    });
    if (editingId === entryId) {
      setEditingId(null);
    }
    if ((restorationModule.appliedEntries || []).length <= 1 && onSetPageColorMode) {
      onSetPageColorMode(null, true);
    }
  };

  const handleDeleteFromCurrentPage = (entryId: string) => {
    if (!selectedPageId) return;
    setRestorationModule((prev) => {
      const remaining = (prev.appliedEntries || [])
        .map((e) => {
          if (e.id !== entryId) return e;
          const nextIds = (e.targetPageIds || []).filter((id) => id !== selectedPageId);
          const nextPages = activePageNum !== undefined
            ? (e.targetPages || []).filter((n) => n !== activePageNum)
            : (e.targetPages || []);
          return {
            ...e,
            targetPageIds: nextIds,
            targetPages: nextPages,
            scopeLabel: nextPages.length > 0 ? `P.${nextPages.join(",")}` : "None",
          };
        })
        .filter((e) => (e.targetPageIds && e.targetPageIds.length > 0) || (e.targetPages && e.targetPages.length > 0));

      return {
        ...prev,
        enabled: remaining.length > 0,
        whitenBg: remaining.length > 0 ? prev.whitenBg : false,
        appliedEntries: remaining,
      };
    });
    if (onSetPageColorMode) {
      onSetPageColorMode(null);
    }
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    setRestorationModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => (e.id === id ? { ...e, visible } : e)),
    }));
  };

  const handleToggleAllVisibility = (visible: boolean) => {
    setRestorationModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => ({ ...e, visible })),
    }));
  };

  const handleDeleteAll = () => {
    setRestorationModule((prev) => ({
      ...prev,
      enabled: false,
      whitenBg: false,
      appliedEntries: [],
    }));
    setEditingId(null);
    if (onSetPageColorMode) {
      onSetPageColorMode(null, true);
    }
  };

  return (
    <div className="space-y-3 select-none">
      {/* Module Header Banner */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2.5">
            <div
              className="p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] shrink-0 mt-0.5"
              style={restorationModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            >
              <IconToolCleanup size={16} className={restorationModule.enabled ? "" : "text-slate-400"} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-[var(--text-primary,#f1f5f9)]">Colors</h3>
                {colorOverridePagesCount > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {colorOverridePagesCount}p
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Color mode, paper & contrast.
              </p>
            </div>
          </div>

          <label
            className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
            title={`Toggle Colors (${shortcutLabels.module_restore || "4"})`}
          >
            <input
              type="checkbox"
              checked={restorationModule.enabled}
              onChange={(e) => setRestorationModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div
              className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
              style={restorationModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            />
          </label>
        </div>

        <ModuleProgressBar task={taskProgress} />
      </div>

      {/* Section 1: Color Mode */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Mode
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          {COLOR_MODES.map((m) => {
            const isActive = colorMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setRestorationModule((prev) => ({ ...prev, colorMode: m.id }))}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--surface-inset,#131720)] border-amber-500/60 shadow-2xs"
                    : "bg-[var(--surface-inset,#131720)]/60 border-[var(--border-subtle,#242A38)] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${isActive ? "text-[var(--text-primary,#fff)]" : "text-slate-300"}`}
                    style={isActive ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                  >
                    {m.label}
                  </span>
                  {isActive && <Check size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Paper & Contrast */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Tone
        </span>

        {/* Paper Whitening Toggle */}
        <label
          className="flex items-center justify-between p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] cursor-pointer text-[11px] text-[var(--text-secondary,#cbd5e1)]"
          title="Eliminates yellow/gray paper background tint & scanner bleed-through"
        >
          <span>Whiten BG</span>
          <input
            type="checkbox"
            checked={restorationModule.whitenBg}
            onChange={(e) => setRestorationModule((prev) => ({ ...prev, whitenBg: e.target.checked }))}
            className="rounded accent-[var(--app-accent,#f59e0b)]"
          />
        </label>

        {/* Mode-specific Sliders */}
        {colorMode === "bw" ? (
          <div className="space-y-1.5 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)]">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Threshold</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-semibold text-[var(--text-primary,#e2e8f0)]">
                  {restorationModule.bwThreshold ?? 180}
                </span>
                {(restorationModule.bwThreshold ?? 180) !== 180 && (
                  <button
                    type="button"
                    onClick={() => setRestorationModule((prev) => ({ ...prev, bwThreshold: 180 }))}
                    className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
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
              onChange={(e) => setRestorationModule((prev) => ({ ...prev, bwThreshold: parseInt(e.target.value, 10) }))}
              className="w-full h-1.5 accent-[var(--app-accent,#f59e0b)] cursor-pointer"
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {(colorMode === "color" || colorMode === "auto") && (
              <div className="space-y-1 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Vibrance</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-semibold text-[var(--text-primary,#e2e8f0)]">
                      +{Math.round((restorationModule.saturation - 1.0) * 100)}%
                    </span>
                    {Math.abs(restorationModule.saturation - 1.2) > 0.01 && (
                      <button
                        type="button"
                        onClick={() => setRestorationModule((prev) => ({ ...prev, saturation: 1.2 }))}
                        className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
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
                  onChange={(e) => setRestorationModule((prev) => ({ ...prev, saturation: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 accent-[var(--app-accent,#f59e0b)] cursor-pointer"
                />
              </div>
            )}

            <div className="space-y-1 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)]">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Contrast</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-semibold text-[var(--text-primary,#e2e8f0)]">
                    {restorationModule.contrast.toFixed(2)}x
                  </span>
                  {Math.abs(restorationModule.contrast - 1.15) > 0.01 && (
                    <button
                      type="button"
                      onClick={() => setRestorationModule((prev) => ({ ...prev, contrast: 1.15 }))}
                      className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
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
                onChange={(e) => setRestorationModule((prev) => ({ ...prev, contrast: parseFloat(e.target.value) }))}
                className="w-full h-1.5 accent-[var(--app-accent,#f59e0b)] cursor-pointer"
              />
            </div>
          </div>
        )}

        <PageScopeSelector
          scope={restorationModule.scope}
          onChange={(sc) => setRestorationModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-sm hover:opacity-95"
            style={{
              backgroundColor: "var(--app-accent, #f59e0b)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
            title={`Apply color mode to ${formatScopeLabel(restorationModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{editingId ? "Update Entry" : `Apply (${formatScopeLabel(restorationModule.scope, activePageNum)})`}</span>
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
              title="Cancel editing"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Universal Layer Stack — TCK-02 */}
      <LayerEntryStack
        title="Applied Colors"
        entries={restorationModule.appliedEntries}
        editingId={editingId}
        activePageNum={activePageNum}
        activePageId={selectedPageId}
        onEdit={handleEditEntry}
        onDelete={handleDeleteApplied}
        onDeleteFromCurrentPage={handleDeleteFromCurrentPage}
        onToggleVisibility={handleToggleVisibility}
        onToggleAllVisibility={handleToggleAllVisibility}
        onDeleteAll={handleDeleteAll}
      />
    </div>
  );
}
