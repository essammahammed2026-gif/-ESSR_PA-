"use client";

import React, { useState } from "react";
import { RefreshCw, RotateCcw, Sparkles, Ruler, Grid } from "lucide-react";
import { IconToolDeskew } from "@/components/shared/StudioIcons";
import { DeskewModuleConfig, ModuleTaskProgress, BookStudioPage, AppliedModuleEntry } from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, LayerEntryStack, formatScopeLabel } from "./PageScopeSelector";
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
  straightenActive = false,
  onToggleStraighten,
  deskewedPagesCount = 0,
  taskProgress,
  selectedPageId,
  sessionId,
  pages = [],
  activePageNum,
  shortcutLabels = {},
}: DeskewPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
      setDeskewModule((prev) => ({ ...prev, mode: "manual", angle: clamped }));
    }
  };

  const handleEditEntry = (entry: AppliedModuleEntry) => {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    if (entry.params) {
      setDeskewModule((prev) => ({
        ...prev,
        angle: entry.params?.angle ?? prev.angle,
        ignoreBorders: entry.params?.ignoreBorders ?? prev.ignoreBorders,
        maxAngle: entry.params?.maxAngle ?? prev.maxAngle,
        scope: entry.params?.scope ?? prev.scope,
      }));
      if (selectedPageId && onChangePageAngle && entry.params?.angle !== undefined) {
        onChangePageAngle(entry.params.angle);
      }
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

    if (editingId) {
      setDeskewModule((prev) => ({
        ...prev,
        appliedEntries: (prev.appliedEntries || []).map((e) =>
          e.id === editingId
            ? {
                ...e,
                label,
                details,
                scopeLabel: concrete.scopeLabel,
                origScope: isAll ? "all" : undefined,
                excludedPages: [],
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

  const handleDeleteApplied = (entryId: string) => {
    setDeskewModule((prev) => {
      const remaining = (prev.appliedEntries || []).filter((e) => e.id !== entryId);
      return {
        ...prev,
        enabled: remaining.length > 0,
        appliedEntries: remaining,
      };
    });
    if (editingId === entryId) {
      setEditingId(null);
    }
    if ((deskewModule.appliedEntries || []).length <= 1) {
      onClearAllAngles?.();
    }
  };

  const handleDeleteFromCurrentPage = (entryId: string) => {
    if (!selectedPageId) return;
    setDeskewModule((prev) => {
      const remaining = (prev.appliedEntries || [])
        .map((e) => {
          if (e.id !== entryId) return e;
          const nextIds = (e.targetPageIds || []).filter((id) => id !== selectedPageId);
          const nextPages = activePageNum !== undefined
            ? (e.targetPages || []).filter((n) => n !== activePageNum)
            : (e.targetPages || []);
          const isFromAll = e.origScope === "all" || (e.targetPages?.length ?? 0) + (e.excludedPages?.length ?? 0) >= pages.length;
          const nextExcluded = activePageNum !== undefined
            ? Array.from(new Set([...(e.excludedPages || []), activePageNum])).sort((a, b) => a - b)
            : (e.excludedPages || []);

          return {
            ...e,
            origScope: e.origScope || (isFromAll ? "all" : undefined),
            excludedPages: nextExcluded,
            targetPageIds: nextIds,
            targetPages: nextPages,
            scopeLabel: isFromAll && nextExcluded.length > 0
              ? "Custom"
              : nextPages.length === 1
                ? `P.${nextPages[0]}`
                : nextPages.length > 0
                  ? `P.${nextPages.join(",")}`
                  : "None",
          };
        })
        .filter((e) => (e.targetPageIds && e.targetPageIds.length > 0) || (e.targetPages && e.targetPages.length > 0));

      return {
        ...prev,
        enabled: remaining.length > 0,
        appliedEntries: remaining,
      };
    });
    // Reset angle on current page
    if (onChangePageAngle) {
      onChangePageAngle(0);
    }
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    setDeskewModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => (e.id === id ? { ...e, visible } : e)),
    }));
  };

  const handleToggleAllVisibility = (visible: boolean) => {
    setDeskewModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).map((e) => ({ ...e, visible })),
    }));
  };

  const handleDeleteAll = () => {
    setDeskewModule((prev) => ({
      ...prev,
      enabled: false,
      appliedEntries: [],
    }));
    setEditingId(null);
    onClearAllAngles?.();
  };

  return (
    <div className="space-y-3 select-none">
      {/* Module Header Banner */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2.5">
            <div
              className="p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] shrink-0 mt-0.5"
              style={deskewModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            >
              <IconToolDeskew size={16} className={deskewModule.enabled ? "" : "text-slate-400"} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-[var(--text-primary,#f1f5f9)]">Deskew</h3>
                {deskewedPagesCount > 0 && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    title={`${deskewedPagesCount} page(s) have individual tilt corrections`}
                  >
                    {deskewedPagesCount}p
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Straighten tilted pages.
              </p>
            </div>
          </div>

          <label
            className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
            title={`Toggle Deskew Layer (${shortcutLabels.module_deskew || "2"})`}
          >
            <input
              type="checkbox"
              checked={deskewModule.enabled}
              onChange={(e) => setDeskewModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div
              className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
              style={deskewModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            />
          </label>
        </div>

        <ModuleProgressBar task={taskProgress} />
      </div>

      {/* Section 1: Auto Baseline Detection */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Auto Detect
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => detectPageAngle && void detectPageAngle(selectedPageId || undefined)}
            disabled={isDetectingAngle || !sessionId}
            className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
            title={`Detect tilt angle for the current page (${shortcutLabels.detect_page || "A"})`}
          >
            {isDetectingAngle ? (
              <>
                <RefreshCw size={12} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <RotateCcw size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Detect</span>
              </>
            )}
          </button>

          {detectAllPageAngles && (
            <button
              type="button"
              onClick={() => void detectAllPageAngles()}
              disabled={isDetectingAngle || !sessionId}
              className="flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              title={`Auto-detect individual tilt angle for every page in the book (${shortcutLabels.detect_all || "Shift+A"})`}
            >
              {isDetectingAngle ? (
                <>
                  <RefreshCw size={12} className="animate-spin" style={{ color: "var(--app-accent, #f59e0b)" }} />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
                  <span>Detect All</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-slate-400">Range</span>
          <div className="flex items-center bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] rounded-md p-0.5" title="Maximum angle search range">
            {[5, 10, 15].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => setDeskewModule((prev) => ({ ...prev, maxAngle: deg }))}
                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  deskewModule.maxAngle === deg
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                style={deskewModule.maxAngle === deg ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                title={`Limit angle detection to ±${deg}°`}
              >
                ±{deg}°
              </button>
            ))}
          </div>
        </div>

        <label
          className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] cursor-pointer text-[11px] text-[var(--text-secondary,#cbd5e1)]"
          title="Masks outer 6% edges so scanner bed borders and lid shadows do not distort angle measurement"
        >
          <span>Ignore Margins (6%)</span>
          <input
            type="checkbox"
            checked={deskewModule.ignoreBorders}
            onChange={(e) => setDeskewModule((prev) => ({ ...prev, ignoreBorders: e.target.checked }))}
            className="rounded accent-[var(--app-accent,#f59e0b)]"
          />
        </label>
      </div>

      {/* Section 2: Current Page Angle & Precision Fine-Tuning */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Angle
          </span>
          <span
            className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)]"
            style={{ color: effectiveAngle !== 0 ? "var(--app-accent-text, var(--app-accent, #f59e0b))" : undefined }}
          >
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
          className="w-full h-1.5 accent-[var(--app-accent,#f59e0b)] cursor-pointer"
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
              className={`py-1 rounded border transition-colors cursor-pointer ${
                "reset" in btn
                  ? "bg-[var(--surface-inset,#131720)] border-[var(--border-subtle,#242A38)] text-slate-400 hover:text-white font-sans font-medium"
                  : "bg-[var(--surface-inset,#131720)] border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] hover:bg-slate-800"
              }`}
              title={"reset" in btn ? "Reset current page angle to 0.00°" : `Nudge page angle by ${btn.label}`}
            >
              {"reset" in btn ? "Reset" : btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 3: Reference Tools & Scope & Apply */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Tools
        </span>

        {onToggleStraighten && (
          <button
            type="button"
            onClick={onToggleStraighten}
            disabled={!sessionId || !selectedPageId}
            className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
              straightenActive
                ? "shadow-xs font-bold"
                : "bg-[var(--surface-inset,#131720)] hover:bg-slate-800 border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)]"
            }`}
            style={
              straightenActive
                ? {
                    backgroundColor: "var(--app-accent, #f59e0b)",
                    borderColor: "var(--app-accent, #f59e0b)",
                    color: "var(--app-accent-fg, #090d16)",
                  }
                : undefined
            }
            title={`Drag a 2-point line along any horizontal text baseline or vertical table border on the canvas (${shortcutLabels.straighten_tool || "S"})`}
          >
            <Ruler size={14} style={!straightenActive ? { color: "var(--app-accent, #f59e0b)" } : undefined} />
            <span>{straightenActive ? "Drag on Canvas..." : "Straighten"}</span>
          </button>
        )}

        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-[11px]">
          <label
            className="flex items-center space-x-2 cursor-pointer text-[var(--text-secondary,#cbd5e1)]"
            title={`Overlays horizontal and vertical alignment lines across the preview canvas (${shortcutLabels.grid_toggle || "G"})`}
          >
            <input
              type="checkbox"
              checked={deskewModule.showGrid}
              onChange={(e) => setDeskewModule((prev) => ({ ...prev, showGrid: e.target.checked }))}
              className="rounded accent-[var(--app-accent,#f59e0b)]"
            />
            <Grid size={12} className="text-slate-400" />
            <span>Grid</span>
          </label>

          {deskewModule.showGrid && (
            <div className="flex items-center space-x-1.5">
              <input
                type="color"
                value={deskewModule.gridColor || "#06b6d4"}
                onChange={(e) => setDeskewModule((prev) => ({ ...prev, gridColor: e.target.value }))}
                className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0 shrink-0"
                title="Change alignment grid line color"
              />
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                {(deskewModule.gridColor || "#06b6d4").slice(0, 7)}
              </span>
            </div>
          )}
        </div>

        <PageScopeSelector
          scope={deskewModule.scope}
          onChange={(sc) => setDeskewModule((prev) => ({ ...prev, scope: sc }))}
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
            title={`Apply angle to ${formatScopeLabel(deskewModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{editingId ? "Update Entry" : `Apply (${formatScopeLabel(deskewModule.scope, activePageNum)})`}</span>
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
        title="Modifications"
        entries={deskewModule.appliedEntries}
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
