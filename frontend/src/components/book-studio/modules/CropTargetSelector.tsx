"use client";

import React from "react";
import type { CropParity, CropTarget, CropTargetBase } from "@/types/book_studio";

export interface CropTargetSelectorProps {
  target: CropTarget;
  onChange: (target: CropTarget) => void;
}

/**
 * Crop/split target picker: All (default) / Current page / Custom range.
 * All and Custom reveal Both / Odds / Evens parity refinements.
 */
export function CropTargetSelector({ target, onChange }: CropTargetSelectorProps) {
  const setBase = (base: CropTargetBase) => onChange({ ...target, base });
  const setParity = (parity: CropParity) => onChange({ ...target, parity });
  const showParity = target.base === "all" || target.base === "range";

  const baseBtn = (base: CropTargetBase, label: string, title: string) => (
    <button
      key={base}
      type="button"
      onClick={() => setBase(base)}
      className={`py-1 px-1 rounded font-medium transition-colors ${
        target.base === base ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
      }`}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-1.5 pt-1.5 border-t border-[#242A38]/70">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span title="Select which pages this action will apply to">Target:</span>
      </div>
      <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#131720] rounded-lg border border-[#242A38] text-[11px]">
        {baseBtn("all", "All", "Apply to every page in the document")}
        {baseBtn("current", "Current", "Apply only to the selected page")}
        {baseBtn("range", "Custom", "Apply to a custom page range, e.g. 1-5, 8")}
      </div>

      {target.base === "range" && (
        <input
          type="text"
          placeholder="e.g. 1-5, 8, 11-14"
          value={target.customRange}
          onChange={(e) => onChange({ ...target, customRange: e.target.value })}
          className="w-full bg-[#0D1017] border border-[#242A38] text-slate-200 text-[11px] font-mono px-2 py-1 rounded outline-none focus:border-amber-500 placeholder:text-slate-600"
          title="Type page numbers or ranges separated by commas, e.g. 1-5, 8, 11-14"
        />
      )}

      {showParity && (
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#131720] rounded-lg border border-[#242A38] text-[11px]">
          {(["both", "odds", "evens"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setParity(p)}
              className={`py-1 rounded font-medium capitalize transition-colors ${
                target.parity === p ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
              title={p === "both" ? "Both odd and even pages" : p === "odds" ? "Only odd-numbered pages (1, 3, 5...)" : "Only even-numbered pages (2, 4, 6...)"}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
