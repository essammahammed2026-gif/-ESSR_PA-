"use client";

import React, { useMemo } from "react";
import { Trash2, Eye, EyeOff, Pencil, FileMinus } from "lucide-react";
import {
  ModulePageScope,
  ModulePageScopeMode,
  ModuleTaskProgress,
} from "@/types/book_studio";

export interface ModuleProgressBarProps {
  task?: ModuleTaskProgress;
}

export function ModuleProgressBar({ task }: ModuleProgressBarProps) {
  if (!task || !task.active) return null;
  const pct = Math.max(4, Math.min(100, Math.round(task.progress || 0)));

  return (
    <div className="space-y-1 pt-1 pb-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-300 font-medium truncate pr-2">{task.label || "Working..."}</span>
        <span className="font-mono font-semibold text-amber-400 shrink-0">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#131720] rounded-full overflow-hidden border border-[#242A38]">
        <div
          className="h-full rounded-full transition-all duration-150 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--app-accent, #f59e0b)",
          }}
        />
      </div>
    </div>
  );
}

export function formatScopeLabel(
  scope: ModulePageScope,
  activePageNum?: number,
  pagesCount?: number
): string {
  if (scope.mode === "current") {
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
}: PageScopeSelectorProps) {
  return (
    <div className={`space-y-1.5 ${hideBorder ? "" : "pt-2 border-t border-[var(--border-subtle,#242A38)]"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <div className="grid grid-cols-5 gap-1 bg-[var(--surface-inset,#131720)] p-0.5 rounded-lg border border-[var(--border-subtle,#242A38)]">
        {SCOPE_OPTIONS.map((opt) => {
          const active = scope.mode === opt.id;
          const pNum = activePageNum !== undefined ? activePageNum : 1;
          const displayLabel = opt.id === "current" ? `P.${pNum}` : opt.label;
          const displayTip = opt.id === "current" ? `Page ${pNum}` : opt.tip;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...scope, mode: opt.id })}
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

export interface LayerEntryItem {
  id: string;
  label?: string;
  details?: string;
  scopeLabel?: string;
  targetPages?: number[];
  targetPageIds?: string[];
  origScope?: "all" | "odds" | "evens" | "range" | "current";
  excludedPages?: number[];
  visible?: boolean;
  solidColor?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
}

export interface LayerEntryStackProps<T extends LayerEntryItem> {
  title?: string;
  entries?: T[];
  editingId?: string | null;
  activePageNum?: number;
  activePageId?: string | null;
  onEdit?: (entry: T) => void;
  onDelete: (id: string, entry: T) => void;
  onDeleteFromCurrentPage?: (id: string, entry: T) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onToggleAllVisibility?: (visible: boolean) => void;
  onDeleteAll?: () => void;
  emptyLabel?: string;
}

/**
 * Universal Edit Entry Pattern ("Layer Stack") — TCK-02
 * Standardizes inspection, editing, toggling preview visibility, and deletion across all prepress tools.
 */
export function LayerEntryStack<T extends LayerEntryItem>({
  title = "Modifications",
  entries = [],
  editingId,
  activePageNum,
  activePageId,
  onEdit,
  onDelete,
  onDeleteFromCurrentPage,
  onToggleVisibility,
  onToggleAllVisibility,
  onDeleteAll,
  emptyLabel,
}: LayerEntryStackProps<T>) {
  // Filter entries to only those that apply to the currently viewed page
  const pageEntries = useMemo<T[]>(() => {
    if (!activePageId && activePageNum === undefined) {
      return entries;
    }
    return entries.filter((entry) => {
      // 1. If this entry explicitly excluded the current page, it does NOT apply here
      if (activePageNum !== undefined && entry.excludedPages && entry.excludedPages.includes(activePageNum)) {
        return false;
      }
      // 2. If targetPageIds is present and has items, check if current activePageId is in it
      if (activePageId && entry.targetPageIds && entry.targetPageIds.length > 0) {
        return entry.targetPageIds.includes(activePageId);
      }
      // 3. If targetPages is present and has items, check if current activePageNum is in it
      if (activePageNum !== undefined && entry.targetPages && entry.targetPages.length > 0) {
        return entry.targetPages.includes(activePageNum);
      }
      // 4. Default: entry targets all pages
      return true;
    });
  }, [entries, activePageId, activePageNum]);

  // Universal: newest applied layer always on top - hooks called unconditionally
  const displayEntries = useMemo<T[]>(() => [...pageEntries].reverse(), [pageEntries]);
  const allVisible = useMemo(() => pageEntries.every((e) => e.visible !== false), [pageEntries]);

  if (pageEntries.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-2.5 text-center text-[10px] text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-2.5 space-y-2">
      {/* Header: Title, Count Badge, and Batch Controls */}
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>{title}</span>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {pageEntries.length}
          </span>
        </div>

        {/* Batch Controls: Show/Hide, Clear */}
        <div className="flex items-center gap-1 font-normal lowercase">
          {onToggleAllVisibility && pageEntries.length > 0 && (
            <button
              type="button"
              onClick={() => onToggleAllVisibility(!allVisible)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center gap-1 text-[10px] ${
                allVisible
                  ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              }`}
              title={allVisible ? "Hide from preview (stays active on export)" : "Show in preview"}
            >
              {allVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="text-[9px] capitalize">{allVisible ? "Hide" : "Show"}</span>
            </button>
          )}

          {onDeleteAll && pageEntries.length > 0 && (
            <button
              type="button"
              onClick={onDeleteAll}
              className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
              title="Clear modifications"
            >
              <Trash2 size={12} />
              <span className="text-[9px] capitalize">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Entry Cards List: Ultra-compact, important info prioritized, newest on top */}
      <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
        {displayEntries.map((entry) => {
          const isEditing = editingId === entry.id;
          const isVisible = entry.visible !== false;

          const isCustomAllMinus = Boolean(
            (entry.origScope === "all" || entry.scopeLabel === "Custom") &&
            entry.excludedPages &&
            entry.excludedPages.length > 0
          );

          let scopeDisplay = entry.scopeLabel || "All";
          let tooltipPages = "";

          if (isCustomAllMinus && entry.excludedPages && entry.excludedPages.length > 0) {
            scopeDisplay = "Custom";
            const excludedStr = entry.excludedPages.map((n) => `p.${n}`).join(", ");
            tooltipPages = `All minus (${excludedStr})`;
          } else if (entry.targetPages && entry.targetPages.length > 0) {
            if (entry.targetPages.length === 1) {
              scopeDisplay = `P.${entry.targetPages[0]}`;
              tooltipPages = `Target: Page ${entry.targetPages[0]}`;
            } else if (entry.origScope === "all" || entry.scopeLabel === "All") {
              scopeDisplay = "All";
              tooltipPages = "Target: All Pages";
            } else {
              scopeDisplay =
                entry.scopeLabel &&
                !entry.scopeLabel.toLowerCase().includes("current") &&
                !entry.scopeLabel.toLowerCase().startsWith("page ")
                  ? entry.scopeLabel
                  : `P.${entry.targetPages.join(",")}`;
              tooltipPages = `Target: Page(s) ${entry.targetPages.join(", ")}`;
            }
          } else {
            scopeDisplay = "All";
            tooltipPages = "Target: All Pages";
          }

          if (scopeDisplay.toLowerCase() === "current") {
            scopeDisplay = `P.${activePageNum !== undefined ? activePageNum : 1}`;
          } else if (scopeDisplay.startsWith("Page ")) {
            scopeDisplay = `P.${scopeDisplay.replace("Page ", "")}`;
          }

          // Strip dimension percentages like "L:10% T:5% R:10% B:5%"
          const displayDetails = (() => {
            if (!entry.details) return null;
            if (entry.details.includes("L:") && entry.details.includes("%")) return null;
            return entry.details;
          })();

          const solidBleedColor =
            (entry.params?.mode === "solid" && (entry.params?.solidColor || entry.solidColor)) ||
            (entry.params?.solidColor ?? entry.solidColor);

          const cardTooltip = `${entry.label || "Modification"}${displayDetails ? ` • ${displayDetails}` : ""} (${tooltipPages})`;

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border text-[10.5px] transition-all ${
                isEditing
                  ? "bg-amber-500/10 border-amber-500/50 shadow-xs"
                  : isVisible
                  ? "bg-[var(--surface-inset,#131720)] border-[var(--border-subtle,#242A38)] hover:border-slate-700"
                  : "bg-[var(--surface-inset,#131720)]/60 border-[var(--border-subtle,#242A38)]/60 opacity-60"
              }`}
              title={cardTooltip}
            >
              {/* Left Details: Scope Badge & Primary Info */}
              <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                <span
                  className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-tight shrink-0 bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  title={tooltipPages}
                >
                  {scopeDisplay}
                </span>

                <div className="flex items-center space-x-1.5 min-w-0 flex-1 truncate">
                  <span className="font-semibold text-[var(--text-primary,#e2e8f0)] truncate">
                    {entry.label || "Modification"}
                  </span>
                  {displayDetails && (
                    <span className="text-[9.5px] text-slate-400 truncate flex items-center gap-1">
                      <span>•</span>
                      {solidBleedColor && (
                        <span
                          className="w-2.5 h-2.5 rounded-xs border border-slate-600 shrink-0 inline-block"
                          style={{ backgroundColor: solidBleedColor }}
                          title={solidBleedColor}
                        />
                      )}
                      <span>{displayDetails}</span>
                    </span>
                  )}
                  {isEditing && (
                    <span className="text-[7.5px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500 text-slate-950 uppercase shrink-0">
                      Editing
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Visibility Toggle, Edit, Remove From Current Page, Delete */}
              <div className="flex items-center space-x-0.5 shrink-0">
                {onToggleVisibility && (
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(entry.id, !isVisible)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isVisible
                        ? "hover:bg-slate-800 text-slate-400 hover:text-white"
                        : "hover:bg-amber-500/20 text-amber-400"
                    }`}
                    title={isVisible ? "Hide preview (remains active on export)" : "Show preview"}
                  >
                    {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                )}

                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isEditing
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : "hover:bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                    title={isEditing ? "Currently editing this entry" : "Edit entry parameters"}
                  >
                    <Pencil size={11} />
                  </button>
                )}

                {/* Remove from current page only (when entry covers multiple pages) */}
                {(() => {
                  const targetsCurrent = Boolean(
                    (activePageNum !== undefined && entry.targetPages?.includes(activePageNum)) ||
                    (activePageId && entry.targetPageIds?.includes(activePageId))
                  );
                  const hasMulti = Boolean(
                    (entry.targetPages && entry.targetPages.length > 1) ||
                    (entry.targetPageIds && entry.targetPageIds.length > 1)
                  );
                  if (onDeleteFromCurrentPage && targetsCurrent && hasMulti) {
                    return (
                      <button
                        type="button"
                        onClick={() => onDeleteFromCurrentPage(entry.id, entry)}
                        className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title={activePageNum !== undefined ? `Remove edit only from P.${activePageNum}` : "Remove edit only from current page"}
                      >
                        <FileMinus size={11} />
                      </button>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => onDelete(entry.id, entry)}
                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title={
                    (entry.targetPages && entry.targetPages.length > 1) || (entry.targetPageIds && entry.targetPageIds.length > 1)
                      ? "Remove & reverse this edit from ALL target pages"
                      : "Remove & reverse this edit"
                  }
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Backward compatibility alias for AppliedEntriesList.
 */
export const AppliedEntriesList = LayerEntryStack;
