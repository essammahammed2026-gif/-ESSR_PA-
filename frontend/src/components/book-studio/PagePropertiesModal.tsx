"use client";

import React, { useState, useEffect } from "react";
import { X, Info } from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";
import { LengthUnit, UNIT_OPTIONS, mmToUnit, getStoredUnit, setStoredUnit } from "@/lib/units";

export interface PagePropertiesModalProps {
  page: BookStudioPage | null;
  pageIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PagePropertiesModal({
  page,
  pageIndex = 0,
  isOpen,
  onClose,
}: PagePropertiesModalProps) {
  const [unit, setUnit] = useState<LengthUnit>("mm");

  useEffect(() => {
    if (isOpen) {
      setUnit(getStoredUnit());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !page) return null;

  const wMm = page.width_mm || 210.0;
  const hMm = page.height_mm || 297.0;
  const ratio = (wMm / hMm).toFixed(2);

  const handleUnitChange = (u: LengthUnit) => {
    setUnit(u);
    setStoredUnit(u);
  };

  const activeSuffix = UNIT_OPTIONS.find((o) => o.value === unit)?.suffix ?? unit;
  const dimString = `${mmToUnit(wMm, unit)} × ${mmToUnit(hMm, unit)} ${activeSuffix}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl overflow-hidden p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242A38]">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-sm">
            <Info size={16} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>Page Properties: {page.label || `Page ${pageIndex + 1}`}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* Consolidated Page Dimension Field with Unit Selector */}
          <div className="col-span-2 p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Page Dimension</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Unit:</span>
                <select
                  value={unit}
                  onChange={(e) => handleUnitChange(e.target.value as LengthUnit)}
                  className="bg-[#131720] border border-[#2E3648] font-semibold text-[11px] rounded px-1.5 py-0.5 outline-none focus:border-amber-500 cursor-pointer"
                  style={{ color: "var(--app-accent, #f59e0b)" }}
                  title="Select dimension unit"
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#131720] text-slate-200">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded-lg px-2.5 py-1.5">
              <input
                type="text"
                readOnly
                value={dimString}
                className="w-full bg-transparent font-bold font-mono text-sm outline-none select-all cursor-default"
                style={{ color: "var(--app-accent, #f59e0b)" }}
                title="Page dimensions"
              />
            </div>
          </div>

          <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Aspect Ratio</span>
            <span className="text-slate-100 font-mono font-bold">{ratio} : 1</span>
          </div>

          <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Rotation</span>
            <span className="text-cyan-400 font-mono font-bold">{page.rotation}°</span>
          </div>

          <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Spread / Split</span>
            <span className="text-amber-300 font-medium" style={{ color: "var(--app-accent, #f59e0b)" }}>
              {page.half ? `Split (${page.half})` : page.is_spread ? "2-Page Spread" : "Single Sheet"}
            </span>
          </div>

          <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Source Doc</span>
            <span className="text-slate-300 font-mono text-[11px] truncate block">
              {page.source || "single"} #{page.doc_idx + 1}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-[#2E3648] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
