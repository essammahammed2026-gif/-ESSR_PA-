"use client";

import React from "react";
import { Check } from "lucide-react";
import { CropTarget, CropTargetBase, CropParity } from "@/types/book_studio";

export interface CropTargetPopoverProps {
  target: CropTarget;
  onSelectTarget: (base: CropTargetBase, parity?: CropParity, customRange?: string) => void;
}

const TARGET_ITEMS: { id: string; label: string; base: CropTargetBase; parity: CropParity }[] = [
  { id: "all", label: "Apply to All Pages", base: "all", parity: "both" },
  { id: "current", label: "Apply to Current Page Only", base: "current", parity: "both" },
  { id: "odds", label: "Apply to Odd Pages (1, 3, 5...)", base: "all", parity: "odds" },
  { id: "evens", label: "Apply to Even Pages (2, 4, 6...)", base: "all", parity: "evens" },
];

export function CropTargetPopover({ target, onSelectTarget }: CropTargetPopoverProps) {
  return (
    <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1.5 z-40 space-y-1 text-xs">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
        Select Target Pages
      </div>
      {TARGET_ITEMS.map((item) => {
        const isActive = target.base === item.base && target.parity === item.parity;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTarget(item.base, item.parity)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              isActive
                ? "bg-amber-500/20 text-amber-300 font-semibold"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            {isActive && <Check size={13} className="text-amber-400" />}
          </button>
        );
      })}

      {/* Custom Range Option */}
      <div className="pt-1 border-t border-[#242A38] px-2 py-1 space-y-1">
        <span className="text-[10px] font-semibold text-slate-400">Custom Page Range:</span>
        <div className="flex items-center space-x-1">
          <input
            type="text"
            placeholder="e.g. 1-5, 8"
            value={target.customRange}
            onChange={(e) => onSelectTarget("range", "both", e.target.value)}
            className="flex-1 bg-[#0A0D14] border border-[#2E3648] text-slate-100 text-xs px-2 py-1 rounded outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => onSelectTarget("range", "both", target.customRange)}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px]"
          >
            Set
          </button>
        </div>
      </div>
    </div>
  );
}
