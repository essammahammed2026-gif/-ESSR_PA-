"use client";

import React from "react";

export interface StudioTaskProgress {
  active?: boolean;
  progress?: number;
  label?: string;
}

export interface ModuleProgressBarProps {
  task?: StudioTaskProgress | null;
}

/**
 * Shared studio module progress bar with accent color styling.
 */
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
