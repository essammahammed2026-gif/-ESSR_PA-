"use client";

import React, { useRef, useEffect } from "react";
import { History, Check, Clock, Flag, Scissors, Crop, RotateCw, Trash2, Copy, FilePlus, ArrowUpDown } from "lucide-react";
import type { HistoryEntry } from "@/hooks/useBookHistory";

export interface HistoryPopoverProps {
  history: HistoryEntry[];
  currentIndex: number;
  onSelectStep: (index: number) => void;
  open: boolean;
  onClose: () => void;
}

function getStepIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("original") || lower.includes("intake")) return <Flag size={13} className="text-cyan-400" />;
  if (lower.includes("split")) return <Scissors size={13} className="text-amber-400" />;
  if (lower.includes("crop")) return <Crop size={13} className="text-emerald-400" />;
  if (lower.includes("rotate")) return <RotateCw size={13} className="text-blue-400" />;
  if (lower.includes("delete")) return <Trash2 size={13} className="text-rose-400" />;
  if (lower.includes("duplicate") || lower.includes("paste")) return <Copy size={13} className="text-indigo-400" />;
  if (lower.includes("blank")) return <FilePlus size={13} className="text-teal-400" />;
  if (lower.includes("reorder")) return <ArrowUpDown size={13} className="text-purple-400" />;
  return <Clock size={13} className="text-slate-400" />;
}

export function HistoryPopover({
  history,
  currentIndex,
  onSelectStep,
  open,
  onClose,
}: HistoryPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1.5 w-80 bg-[#141822] border border-[#2E3648] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-96 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#181D27] border-b border-[#242A38]">
        <div className="flex items-center space-x-2">
          <History size={14} className="text-amber-400" />
          <span className="text-xs font-bold text-slate-200">History Journal</span>
        </div>
        <span className="text-[10px] font-mono font-medium text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
          {currentIndex + 1} / {history.length}
        </span>
      </div>

      {/* History Steps List */}
      <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-[#1D2330]">
        {history.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">No actions recorded yet.</div>
        ) : (
          history.map((entry, idx) => {
            const isActive = idx === currentIndex;
            const isFuture = idx > currentIndex;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  onSelectStep(idx);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm font-semibold"
                    : isFuture
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <div className="shrink-0">{getStepIcon(entry.label)}</div>
                  <div className="truncate">
                    <span className="block truncate">{entry.label}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {entry.pages.length} {entry.pages.length === 1 ? "page" : "pages"}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-1.5">
                  {isActive && <Check size={14} className="text-amber-400" />}
                  {isFuture && (
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider px-1 py-0.5 bg-slate-800/50 rounded">
                      Redo
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-[#10141D] border-t border-[#1F2533] text-[10px] text-slate-500 flex items-center justify-between">
        <span>Click any step to preview & restore</span>
        <span className="font-mono">Ctrl+Z / Y</span>
      </div>
    </div>
  );
}
