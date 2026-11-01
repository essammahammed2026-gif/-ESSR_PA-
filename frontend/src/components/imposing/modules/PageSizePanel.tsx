"use client";

import React from "react";
import { Maximize2 } from "lucide-react";
import { NumberControl } from "@/components/ui/NumberControl";
import { mmToUnit, unitToMm, LengthUnit } from "@/lib/units";

interface PageSizePanelProps {
  sheetW: number;
  setSheetW: (w: number) => void;
  sheetH: number;
  setSheetH: (h: number) => void;
  sheetPreset: string;
  setSheetPreset: (p: string) => void;
  margin: number;
  setMargin: (m: number) => void;
  unit: string;
}

export function PageSizePanel({
  sheetW,
  setSheetW,
  sheetH,
  setSheetH,
  sheetPreset,
  setSheetPreset,
  margin,
  setMargin,
  unit,
}: PageSizePanelProps) {
  return (
    <div className="space-y-4 select-none">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Standard Press Presets
        </label>
        <select
          value={sheetPreset}
          onChange={(e) => {
            const val = e.target.value;
            setSheetPreset(val);
            if (val !== "custom") {
              const parts = val.split(",");
              if (parts.length === 2) {
                setSheetW(parseFloat(parts[0]));
                setSheetH(parseFloat(parts[1]));
              }
            }
          }}
          className="w-full bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[var(--text-primary,#F1F5F9)] text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
        >
          <option value="320,450">SRA3 (320 × 450 mm)</option>
          <option value="297,420">A3 (297 × 420 mm)</option>
          <option value="330,483">SRA3+ (330 × 483 mm)</option>
          <option value="500,707">B2 (500 × 707 mm)</option>
          <option value="700,1000">B1 (700 × 1000 mm)</option>
          <option value="custom">Custom Format...</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberControl
          label="Sheet Width"
          value={String(Math.round(mmToUnit(sheetW, unit as LengthUnit)))}
          min="50"
          max="3000"
          step="1"
          unit={unit}
          onChange={(val) => {
            setSheetPreset("custom");
            setSheetW(unitToMm(parseFloat(val) || 1, unit as LengthUnit));
          }}
        />
        <NumberControl
          label="Sheet Height"
          value={String(Math.round(mmToUnit(sheetH, unit as LengthUnit)))}
          min="50"
          max="3000"
          step="1"
          unit={unit}
          onChange={(val) => {
            setSheetPreset("custom");
            setSheetH(unitToMm(parseFloat(val) || 1, unit as LengthUnit));
          }}
        />
      </div>

      <NumberControl
        label="Gripper / Margin"
        value={String(Math.round(mmToUnit(margin, unit as LengthUnit)))}
        min="0"
        max="100"
        step="1"
        unit={unit}
        onChange={(val) => setMargin(unitToMm(parseFloat(val) || 0, unit as LengthUnit))}
      />

      <div className="pt-2 border-t border-[var(--border-subtle,#242C3D)]">
        <div className="text-[11px] text-[var(--text-muted,#64748B)]">
          Target press sheet size: <span className="font-mono text-[var(--text-primary,#F1F5F9)] font-medium">{Math.round(sheetW)} × {Math.round(sheetH)} {unit}</span>
        </div>
      </div>
    </div>
  );
}
