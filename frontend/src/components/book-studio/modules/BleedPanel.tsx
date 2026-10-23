"use client";

import React, { useState, useEffect } from "react";
import { Pipette, Plus, Check } from "lucide-react";
import { IconToolBleed } from "@/components/shared/StudioIcons";
import { BleedModuleConfig, BleedEntry, ModuleTaskProgress, BookStudioPage } from "@/types/book_studio";
import { type LengthUnit, mmToUnit, unitToMm, UNIT_OPTIONS } from "@/lib/units";
import { PageScopeSelector, ModuleProgressBar, formatScopeLabel, LayerEntryStack } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface BleedPanelProps {
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

const BLEED_PRESETS_MM = [0, 2, 3, 5];

export function BleedPanel({
  bleedModule,
  setBleedModule,
  unit = "mm",
  onActivateEyedropper,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  shortcutLabels = {},
}: BleedPanelProps) {
  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short || "mm";
  const displayVal = mmToUnit(bleedModule.bleedMm, unit);
  const [textVal, setTextVal] = useState<string>(String(displayVal));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTextVal(String(mmToUnit(bleedModule.bleedMm, unit)));
  }, [bleedModule.bleedMm, unit]);

  const commitBleedInput = () => {
    const parsed = parseFloat(textVal);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setTextVal(String(mmToUnit(bleedModule.bleedMm, unit)));
      return;
    }
    const mmVal = unitToMm(parsed, unit);
    setBleedModule((prev) => ({ ...prev, enabled: true, bleedMm: Math.round(mmVal * 10) / 10 }));
  };

  const handleApplyBleed = () => {
    const concrete = resolveConcretePageNumbers(pages, bleedModule.scope, selectedPageId);
    const isAll = bleedModule.scope.mode === "all";
    const label = "Bleed";
    const bleedOption = bleedModule.mode === "solid"
      ? `${mmToUnit(bleedModule.bleedMm, unit)}${unitShort} • ${bleedModule.solidColor.toUpperCase()}`
      : `${mmToUnit(bleedModule.bleedMm, unit)}${unitShort} • Mirror`;
    const details = bleedOption;

    const currentEntry: BleedEntry = {
      id: editingId || `bleed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bleedMm: bleedModule.bleedMm,
      mode: bleedModule.mode,
      solidColor: bleedModule.solidColor,
      placement: bleedModule.placement || "outside",
      showCropMarks: bleedModule.showCropMarks,
      scopeLabel: concrete.scopeLabel,
      origScope: isAll ? "all" : undefined,
      excludedPages: [],
      targetPages: concrete.pageNumbers,
      targetPageIds: concrete.pageIds,
      visible: true,
      label,
      details,
      params: {
        bleedMm: bleedModule.bleedMm,
        mode: bleedModule.mode,
        solidColor: bleedModule.solidColor,
        placement: bleedModule.placement,
        showCropMarks: bleedModule.showCropMarks,
        scope: bleedModule.scope,
      },
    };

    setBleedModule((prev) => {
      const existing = prev.appliedBleeds || [];
      const updated = editingId
        ? existing.map((b) => (b.id === editingId ? currentEntry : b))
        : [...existing.filter((b) => b.scopeLabel !== concrete.scopeLabel), currentEntry];
      return {
        ...prev,
        enabled: true,
        appliedBleeds: updated,
      };
    });

    setEditingId(null);
  };

  const handleEditEntry = (entry: BleedEntry) => {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    setBleedModule((prev) => ({
      ...prev,
      bleedMm: entry.bleedMm,
      mode: entry.mode,
      solidColor: entry.solidColor || prev.solidColor,
      placement: entry.placement,
      showCropMarks: entry.showCropMarks,
      scope: entry.params?.scope || prev.scope,
    }));
  };

  const handleDeleteEntry = (id: string) => {
    setBleedModule((prev) => {
      const remaining = (prev.appliedBleeds || []).filter((b) => b.id !== id);
      return {
        ...prev,
        enabled: remaining.length > 0,
        appliedBleeds: remaining,
      };
    });
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleDeleteFromCurrentPage = (entryId: string) => {
    if (!selectedPageId) return;
    setBleedModule((prev) => {
      const remaining = (prev.appliedBleeds || [])
        .map((b) => {
          if (b.id !== entryId) return b;
          const nextIds = (b.targetPageIds || []).filter((id) => id !== selectedPageId);
          const nextPages = activePageNum !== undefined
            ? (b.targetPages || []).filter((n) => n !== activePageNum)
            : (b.targetPages || []);
          const isFromAll = b.origScope === "all" || (b.targetPages?.length ?? 0) + (b.excludedPages?.length ?? 0) >= pages.length;
          const nextExcluded = activePageNum !== undefined
            ? Array.from(new Set([...(b.excludedPages || []), activePageNum])).sort((a, b) => a - b)
            : (b.excludedPages || []);

          return {
            ...b,
            origScope: b.origScope || (isFromAll ? "all" : undefined),
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
        .filter((b) => (b.targetPageIds && b.targetPageIds.length > 0) || (b.targetPages && b.targetPages.length > 0));

      return {
        ...prev,
        enabled: remaining.length > 0,
        appliedBleeds: remaining,
      };
    });
    if (editingId === entryId) {
      setEditingId(null);
    }
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    setBleedModule((prev) => ({
      ...prev,
      appliedBleeds: (prev.appliedBleeds || []).map((b) => (b.id === id ? { ...b, visible } : b)),
    }));
  };

  const handleToggleAllVisibility = (visible: boolean) => {
    setBleedModule((prev) => ({
      ...prev,
      appliedBleeds: (prev.appliedBleeds || []).map((b) => ({ ...b, visible })),
    }));
  };

  const handleDeleteAll = () => {
    setBleedModule((prev) => ({
      ...prev,
      enabled: false,
      appliedBleeds: [],
    }));
    setEditingId(null);
  };

  const handleNativeEyedropper = async () => {
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setBleedModule((prev) => ({ ...prev, enabled: true, solidColor: result.sRGBHex, mode: "solid" }));
          return;
        }
      } catch {
        // Fallback to canvas click sampling
      }
    }
    if (onActivateEyedropper) {
      setBleedModule((prev) => ({ ...prev, enabled: true, mode: "solid" }));
      onActivateEyedropper();
    }
  };

  const appliedList = bleedModule.appliedBleeds || [];

  return (
    <div className="space-y-3 select-none">
      {/* Module Header Banner */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2.5">
            <div
              className="p-2 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] shrink-0 mt-0.5"
              style={bleedModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            >
              <IconToolBleed size={16} className={bleedModule.enabled ? "" : "text-slate-400"} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-[var(--text-primary,#f1f5f9)]">Print Bleed & Marks</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Synthesize mirrored or solid bleed margins and vector corner crop marks.
              </p>
            </div>
          </div>

          <label
            className="relative inline-flex items-center cursor-pointer shrink-0 mt-1"
            title={`Toggle Print Bleed (${shortcutLabels.module_bleed || "5"})`}
          >
            <input
              type="checkbox"
              checked={bleedModule.enabled}
              onChange={(e) => setBleedModule((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div
              className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
              style={bleedModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            />
          </label>
        </div>

        <ModuleProgressBar task={taskProgress} />
      </div>

      {/* Section 1: Bleed Placement & Fill Mode */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Placement
        </span>

        {/* Outside vs Inside Bleed */}
        <div className="grid grid-cols-2 gap-1.5">
          {([
            {
              id: "outside" as const,
              title: "Outside",
              desc: "Expands outward",
            },
            {
              id: "inside" as const,
              title: "Inside",
              desc: "Safety margin",
            },
          ]).map((pl) => {
            const active = (bleedModule.placement || "outside") === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => setBleedModule((prev) => ({ ...prev, placement: pl.id }))}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  active
                    ? "bg-[var(--surface-inset,#131720)] border-amber-500/60 shadow-2xs"
                    : "bg-[var(--surface-inset,#131720)]/60 border-[var(--border-subtle,#242A38)] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${active ? "text-[var(--text-primary,#fff)]" : "text-slate-300"}`}
                    style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                  >
                    {pl.title}
                  </span>
                  {active && <Check size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{pl.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Mirror Edge vs Solid Color */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[11px]">
          <button
            type="button"
            onClick={() => setBleedModule((prev) => ({ ...prev, mode: "mirror" }))}
            className={`py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              bleedModule.mode === "mirror"
                ? "bg-slate-800 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={bleedModule.mode === "mirror" ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
            title="Mirror edge pixels of the page into the bleed zone"
          >
            Mirror
          </button>
          <button
            type="button"
            onClick={() => setBleedModule((prev) => ({ ...prev, mode: "solid" }))}
            className={`py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              bleedModule.mode === "solid"
                ? "bg-slate-800 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={bleedModule.mode === "solid" ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
            title="Fill bleed zone with a solid color"
          >
            Solid
          </button>
        </div>

        {/* Solid Color Picker + Eyedropper */}
        {bleedModule.mode === "solid" && (
          <div className="flex items-center justify-between p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[11px]">
            <span className="text-slate-400">Color</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="color"
                value={bleedModule.solidColor || "#ffffff"}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, solidColor: e.target.value }))}
                className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                title="Choose solid bleed color"
              />
              <button
                type="button"
                onClick={handleNativeEyedropper}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-[var(--app-accent,#f59e0b)] transition-colors cursor-pointer"
                title={`Pick color directly from page (${shortcutLabels.eyedropper || "I"})`}
              >
                <Pipette size={13} />
              </button>
              <span className="font-mono text-[10px] text-slate-300 uppercase">
                {(bleedModule.solidColor || "#ffffff").slice(0, 7)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Bleed Width & Quick Presets */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Width
        </span>

        <div
          className="flex items-center justify-between gap-2 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[11px]"
          title="Set bleed width"
        >
          <span className="text-slate-400">Margin</span>
          <div className="flex items-center space-x-1.5">
            <input
              type="number"
              min="0"
              step="0.5"
              value={textVal}
              onChange={(e) => {
                setTextVal(e.target.value);
                const parsed = parseFloat(e.target.value);
                if (Number.isFinite(parsed) && parsed >= 0) {
                  const mmVal = unitToMm(parsed, unit);
                  setBleedModule((prev) => ({ ...prev, bleedMm: Math.round(mmVal * 10) / 10 }));
                }
              }}
              onBlur={commitBleedInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitBleedInput();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-20 bg-[#0A0D14] border border-[#2E3648] text-slate-100 font-mono font-bold text-xs px-2 py-1 rounded text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-slate-400 font-mono text-[11px] min-w-[20px]">{unitShort}</span>
          </div>
        </div>

        {/* 1-Click Standard Prepress Presets */}
        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          {BLEED_PRESETS_MM.map((mm) => {
            const active = Math.abs(bleedModule.bleedMm - mm) < 0.05;
            return (
              <button
                key={mm}
                type="button"
                onClick={() => setBleedModule((prev) => ({ ...prev, bleedMm: mm }))}
                className={`py-1 rounded border transition-colors cursor-pointer ${
                  active
                    ? "bg-slate-800 border-amber-500/60 font-bold text-white"
                    : "bg-[var(--surface-inset,#131720)] border-[var(--border-subtle,#242A38)] text-slate-400 hover:text-slate-200"
                }`}
                style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
                title={`Set bleed width to ${mm} mm`}
              >
                {mmToUnit(mm, unit)} {unitShort}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Trim Marks & Commit */}
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-3 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Marks & Scope
        </span>

        <div className="flex items-center justify-between gap-2 p-2 bg-[var(--surface-inset,#131720)] rounded-lg border border-[var(--border-subtle,#242A38)]">
          <label
            className="flex items-center space-x-2 cursor-pointer text-[11px] text-[var(--text-secondary,#cbd5e1)]"
            title="Draws vector corner cut marks indicating trim boundaries"
          >
            <input
              type="checkbox"
              checked={bleedModule.showCropMarks}
              onChange={(e) => setBleedModule((prev) => ({ ...prev, showCropMarks: e.target.checked }))}
              className="rounded accent-[var(--app-accent,#f59e0b)]"
            />
            <span>Crop Marks</span>
          </label>

          <div className="flex items-center space-x-1.5" title="Output rasterization resolution when exporting PDF">
            <span className="text-[10px] text-slate-400">DPI</span>
            <select
              value={bleedModule.exportDpi}
              onChange={(e) => setBleedModule((prev) => ({ ...prev, exportDpi: parseInt(e.target.value, 10) }))}
              className="bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] text-[11px] font-mono px-1.5 py-0.5 rounded outline-none cursor-pointer"
            >
              <option value="150">150</option>
              <option value="200">200</option>
              <option value="300">300</option>
            </select>
          </div>
        </div>

        <PageScopeSelector
          scope={bleedModule.scope}
          onChange={(sc) => setBleedModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
        />

        {/* Apply / Update Bleed Button */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleApplyBleed}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm hover:opacity-95"
            style={{
              backgroundColor: "var(--app-accent, #f59e0b)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
            title={
              editingId
                ? `Save changes to this bleed entry (${shortcutLabels.apply_action || "Enter"})`
                : `Commit bleed to ${formatScopeLabel(bleedModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`
            }
          >
            {editingId ? <Check size={13} /> : <Plus size={13} />}
            <span>{editingId ? "Update Entry" : `Apply (${formatScopeLabel(bleedModule.scope, activePageNum)})`}</span>
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
        entries={appliedList}
        editingId={editingId}
        activePageNum={activePageNum}
        activePageId={selectedPageId}
        onEdit={handleEditEntry}
        onDelete={handleDeleteEntry}
        onDeleteFromCurrentPage={handleDeleteFromCurrentPage}
        onToggleVisibility={handleToggleVisibility}
        onToggleAllVisibility={handleToggleAllVisibility}
        onDeleteAll={handleDeleteAll}
      />
    </div>
  );
}
