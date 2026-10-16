"use client";

import React from "react";
import { ModulePageScope, ModulePageScopeMode } from "@/types/book_studio";

export interface PageScopeSelectorProps {
  scope: ModulePageScope;
  onChange: (scope: ModulePageScope) => void;
}

export function PageScopeSelector({ scope, onChange }: PageScopeSelectorProps) {
  return (
    <div className="space-y-1 pt-1.5 border-t border-[#242A38]/60">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span title="Select which pages this tool applies to">Scope</span>
        <div className="flex items-center space-x-0.5 bg-[#131720] p-0.5 rounded border border-[#242A38]">
          {(["all", "range", "odds", "evens"] as ModulePageScopeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...scope, mode: m })}
              className={`px-1.5 py-0.5 rounded text-[10px] capitalize transition-colors cursor-pointer ${
                scope.mode === m
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={scope.mode === m ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title={
                m === "all"
                  ? "Apply to all pages in the document"
                  : m === "range"
                  ? "Apply to a custom page range (e.g. 1-5, 8, 11-14)"
                  : m === "odds"
                  ? "Apply only to odd-numbered pages (1, 3, 5...)"
                  : "Apply only to even-numbered pages (2, 4, 6...)"
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {scope.mode === "range" && (
        <div className="pt-0.5">
          <input
            type="text"
            placeholder="e.g. 1-5, 8, 11-14"
            value={scope.customRange}
            onChange={(e) => onChange({ ...scope, customRange: e.target.value })}
            className="w-full bg-[#131720] border border-[#242A38] text-slate-200 text-[10px] font-mono px-2 py-1 rounded outline-none focus:border-slate-500 placeholder:text-slate-600"
            title="Type page numbers or ranges separated by commas, e.g. 1-5, 8, 11-14"
          />
        </div>
      )}
    </div>
  );
}
