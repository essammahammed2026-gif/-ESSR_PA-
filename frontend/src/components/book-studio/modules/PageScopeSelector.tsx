"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import {
  AppliedModuleEntry,
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

export function formatScopeLabel(scope: ModulePageScope): string {
  if (scope.mode === "current") return "Current";
  if (scope.mode === "odds") return "Odds";
  if (scope.mode === "evens") return "Evens";
  if (scope.mode === "range") return scope.customRange?.trim() ? `Pages ${scope.customRange.trim()}` : "Range";
  return "All";
}

export interface PageScopeSelectorProps {
  scope: ModulePageScope;
  onChange: (scope: ModulePageScope) => void;
  label?: string;
  hideBorder?: boolean;
}

const SCOPE_OPTIONS: { id: ModulePageScopeMode; label: string; tip: string }[] = [
  { id: "current", label: "Current", tip: "Current page" },
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
}: PageScopeSelectorProps) {
  return (
    <div className={`space-y-1.5 ${hideBorder ? "" : "pt-2 border-t border-[var(--border-subtle,#242A38)]"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <div className="grid grid-cols-5 gap-1 bg-[var(--surface-inset,#131720)] p-0.5 rounded-lg border border-[var(--border-subtle,#242A38)]">
        {SCOPE_OPTIONS.map((opt) => {
          const active = scope.mode === opt.id;
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
              title={opt.tip}
            >
              {opt.label}
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

export interface AppliedEntriesListProps {
  entries?: AppliedModuleEntry[];
  onDelete: (id: string, entry: AppliedModuleEntry) => void;
}

export function AppliedEntriesList({ entries = [], onDelete }: AppliedEntriesListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border-subtle,#242A38)] bg-[var(--surface-card,#181D27)] p-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>Applied</span>
        <span className="font-mono text-slate-500">{entries.length}</span>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-[11px]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30"
              >
                {entry.scopeLabel}
              </span>
              <span className="font-medium text-[var(--text-primary,#e2e8f0)] truncate">
                {entry.label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(entry.id, entry)}
              className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
              title="Remove & reverse this edit"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
