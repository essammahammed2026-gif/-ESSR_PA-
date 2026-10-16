"use client";

import React, { useEffect } from "react";
import { X, Info } from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";
import { type LengthUnit, UNIT_OPTIONS, mmToUnit } from "@/lib/units";

export interface PagePropertiesModalProps {
  page: BookStudioPage | null;
  unit?: LengthUnit;
  isOpen: boolean;
  onClose: () => void;
}

export function PagePropertiesModal({
  page,
  unit = "mm",
  isOpen,
  onClose,
}: PagePropertiesModalProps) {
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
  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short ?? unit;
  const dimString = `${mmToUnit(wMm, unit)} × ${mmToUnit(hMm, unit)} ${unitShort}`;
  const colorMode = page.color_space || "RGB";
  const resolution = `${page.dpi || 300} DPI`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl overflow-hidden p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242A38]">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-sm">
            <Info size={16} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>Page Properties</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Properties Grid: Only Size, Color Mode, and Resolution */}
        <div className="space-y-2 text-xs">
          {/* Page Size */}
          <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Page Size</span>
            <span
              className="font-bold font-mono text-sm block"
              style={{ color: "var(--app-accent, #f59e0b)" }}
            >
              {dimString}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Color Mode */}
            <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Color Mode</span>
              <span className="text-slate-100 font-mono font-bold text-sm">{colorMode}</span>
            </div>

            {/* Resolution */}
            <div className="p-2.5 bg-[#181D27] border border-[#242A38] rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Resolution</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">{resolution}</span>
            </div>
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
