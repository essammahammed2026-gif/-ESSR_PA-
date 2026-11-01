"use client";

import React from "react";
import { Grid } from "lucide-react";
import { NumberControl } from "@/components/ui/NumberControl";
import { mmToUnit, unitToMm, LengthUnit } from "@/lib/units";

interface StepRepeatPanelProps {
  rows: number | null;
  setRows: (r: number | null) => void;
  cols: number | null;
  setCols: (c: number | null) => void;
  gap: number;
  setGap: (g: number) => void;
  unit: string;
}

export function StepRepeatPanel({
  rows,
  setRows,
  cols,
  setCols,
  gap,
  setGap,
  unit,
}: StepRepeatPanelProps) {
  const isAuto = !rows && !cols;

  return (
    <div className="space-y-4 select-none">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)]">
          Grid Placement Mode
        </label>
        <button
          type="button"
          onClick={() => {
            if (isAuto) {
              setRows(2);
              setCols(2);
            } else {
              setRows(null);
              setCols(null);
            }
          }}
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-inset,#11151E)] hover:bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] border border-[var(--border-subtle,#242C3D)] cursor-pointer"
        >
          {isAuto ? "Auto 2D Packing" : "Manual Matrix"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberControl
          label="Rows"
          value={String(rows ?? 0)}
          min="0"
          max="50"
          step="1"
          onChange={(val) => {
            const num = parseInt(val, 10);
            setRows(num > 0 ? num : null);
          }}
        />
        <NumberControl
          label="Columns"
          value={String(cols ?? 0)}
          min="0"
          max="50"
          step="1"
          onChange={(val) => {
            const num = parseInt(val, 10);
            setCols(num > 0 ? num : null);
          }}
        />
      </div>

      <NumberControl
        label="Item Gutter / Spacing"
        value={String(Math.round(mmToUnit(gap, unit as LengthUnit)))}
        min="0"
        max="100"
        step="0.5"
        unit={unit}
        onChange={(val) => setGap(unitToMm(parseFloat(val) || 0, unit as LengthUnit))}
      />

      <div className="p-2.5 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[11px] text-[var(--text-secondary,#94A3B8)]">
        {isAuto
          ? "Artworks are automatically nested to maximize sheet yield using 2D bin packing."
          : `Fixed grid repeating ${rows || 1} rows × ${cols || 1} columns across the sheet.`}
      </div>
    </div>
  );
}
