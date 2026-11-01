"use client";

import React, { useMemo, useCallback } from "react";
import {
  BookStudioPage,
  ModulePageScope,
  ModulePageScopeMode,
  ModuleTaskProgress,
} from "@/types/book_studio";
import { resolveDualSpreadState, toggleDualModuleScope } from "@/lib/pageScope";

export { StudioColorPicker, type StudioColorPickerProps } from "@/components/shared/StudioColorPicker";
export { ModuleProgressBar, type ModuleProgressBarProps } from "@/components/shared/ModuleProgressBar";

export function formatScopeLabel(
  scope: ModulePageScope,
  activePageNum?: number,
  pagesCount?: number
): string {
  if (scope.mode === "current") {
    if (scope.dualSides && scope.dualSides.length > 0 && activePageNum !== undefined) {
      const pairStartIdx = Math.floor((activePageNum - 1) / 2) * 2;
      const lNum = pairStartIdx + 1;
      const rNum = pairStartIdx + 2;
      if (scope.dualSides.includes("left") && scope.dualSides.includes("right")) {
        return `Dual (P.${lNum}, P.${rNum})`;
      }
      if (scope.dualSides.includes("right")) return `P.${rNum}`;
      return `P.${lNum}`;
    }
    return `P.${activePageNum !== undefined ? activePageNum : 1}`;
  }
  if (scope.mode === "odds") return pagesCount ? `Odds (${Math.ceil(pagesCount / 2)})` : "Odds";
  if (scope.mode === "evens") return pagesCount ? `Evens (${Math.floor(pagesCount / 2)})` : "Evens";
  if (scope.mode === "range") return scope.customRange?.trim() ? `Pages ${scope.customRange.trim()}` : "Range";
  return pagesCount ? `All (${pagesCount})` : "All";
}

export interface PageScopeSelectorProps {
  scope: ModulePageScope;
  onChange: (scope: ModulePageScope) => void;
  label?: string;
  hideBorder?: boolean;
  activePageNum?: number;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  isDualPage?: boolean;
  onSelectPageId?: (id: string) => void;
  isDualActive?: boolean;
  isDualLinked?: boolean;
  onToggleDual?: () => void;
  activeDualSide?: "left" | "right" | null;
  leftPageNum?: number;
  rightPageNum?: number;
}

const SCOPE_OPTIONS: { id: ModulePageScopeMode; label: string; tip: string }[] = [
  { id: "current", label: "P.1", tip: "Current page" },
  { id: "all", label: "All", tip: "All pages" },
  { id: "odds", label: "Odds", tip: "Odd pages" },
  { id: "evens", label: "Evens", tip: "Even pages" },
  { id: "range", label: "Range", tip: "Custom page range" },
];

export function PageScopeSelector({
  scope,
  onChange,
  label = "Scope",
  hideBorder = false,
  activePageNum,
  pages,
  selectedPageId,
  isDualPage = false,
  onSelectPageId,
  isDualActive: propIsDualActive,
  isDualLinked: propIsDualLinked,
  onToggleDual: propOnToggleDual,
  activeDualSide: propActiveDualSide,
  leftPageNum: propLeftPageNum,
  rightPageNum: propRightPageNum,
}: PageScopeSelectorProps) {
  const autoDual = useMemo(
    () => resolveDualSpreadState(pages, selectedPageId, isDualPage, scope.dualSides),
    [pages, selectedPageId, isDualPage, scope.dualSides]
  );

  const isDualActive = propIsDualActive !== undefined ? propIsDualActive : autoDual.isDualActive;
  const isDualLinked = propIsDualLinked !== undefined ? propIsDualLinked : autoDual.isDualLinked;
  const activeDualSide = propActiveDualSide !== undefined ? propActiveDualSide : autoDual.activeDualSide;
  const leftPageNum = propLeftPageNum !== undefined ? propLeftPageNum : autoDual.leftPageNum;
  const rightPageNum = propRightPageNum !== undefined ? propRightPageNum : autoDual.rightPageNum;

  const handleToggleDual = useCallback(() => {
    if (propOnToggleDual) {
      propOnToggleDual();
      return;
    }
    onChange(toggleDualModuleScope(scope, autoDual, onSelectPageId));
  }, [propOnToggleDual, onChange, scope, autoDual, onSelectPageId]);

  const handleModeClick = (mode: ModulePageScopeMode) => {
    onChange({
      ...scope,
      mode,
      dualSides: mode === "current" && isDualActive ? (scope.dualSides ?? ["left", "right"]) : undefined,
    });
  };

  return (
    <div className={`space-y-1.5 ${hideBorder ? "" : "pt-2 border-t border-[var(--border-subtle,#242A38)]"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <div className="grid grid-cols-5 gap-1 bg-[var(--surface-inset,#131720)] p-0.5 rounded-lg border border-[var(--border-subtle,#242A38)]">
        {SCOPE_OPTIONS.map((opt) => {
          if (opt.id === "current" && isDualActive) {
            return (
              <button
                key="dual"
                type="button"
                onClick={handleToggleDual}
                className={`py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate leading-tight ${
                  scope.mode === "current" && isDualLinked
                    ? "bg-[#252B3B] text-white font-semibold ring-1 ring-amber-500/40"
                    : scope.mode === "current" && !isDualLinked
                    ? "bg-[#1E2330] text-amber-300 font-medium ring-1 ring-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={
                  isDualLinked
                    ? "Dual Mode: Linked (edits apply to both pages). Click to edit individually."
                    : "Dual Mode: Unlinked (editing individually). Click to link both pages."
                }
              >
                Dual
              </button>
            );
          }
          const active = scope.mode === opt.id;
          const pNum = leftPageNum !== undefined ? leftPageNum : (activePageNum !== undefined ? activePageNum : 1);
          const displayLabel = opt.id === "current" ? `P.${pNum}` : opt.label;
          const displayTip = opt.id === "current" ? `Page ${pNum}` : opt.tip;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleModeClick(opt.id)}
              className={`py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer text-center truncate ${
                active
                  ? "bg-slate-800 text-white font-semibold shadow-2xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={active ? { color: "var(--app-accent-text, var(--app-accent, #f59e0b))" } : undefined}
              title={displayTip}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Dual Mode Unlinked Individual Page Indicator */}
      {isDualActive && scope.mode === "current" && !isDualLinked && (
        <div className="flex items-center justify-between text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-medium">Editing {activeDualSide === "right" ? `Page ${rightPageNum}` : `Page ${leftPageNum}`}</span>
          </div>
          <span className="text-slate-500 text-[9px]">Click or drag on either page to switch</span>
        </div>
      )}

      {scope.mode === "range" && (
        <input
          type="text"
          placeholder="1-5, 8, 11-14"
          value={scope.customRange}
          onChange={(e) => onChange({ ...scope, customRange: e.target.value })}
          className="w-full bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-[var(--text-primary,#e2e8f0)] text-[10px] font-mono px-2 py-1 rounded-lg outline-none focus:border-amber-500 placeholder:text-slate-500"
        />
      )}
    </div>
  );
}
