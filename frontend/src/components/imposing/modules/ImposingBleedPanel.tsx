"use client";

import React, { useState } from "react";
import { NumberControl } from "@/components/ui/NumberControl";
import { StudioColorPicker } from "@/components/shared/StudioColorPicker";
import { mmToUnit, unitToMm, LengthUnit } from "@/lib/units";

interface ImposingBleedPanelProps {
  unit?: string;
}

export function ImposingBleedPanel({ unit = "mm" }: ImposingBleedPanelProps) {
  const [bleedMm, setBleedMm] = useState<number>(3.0);
  const [bleedMode, setBleedMode] = useState<"mirror" | "solid" | "none">("mirror");
  const [solidColor, setSolidColor] = useState<string>("#FFFFFF");
  const [symmetric, setSymmetric] = useState<boolean>(true);

  return (
    <div className="space-y-4 select-none">
      {/* Bleed Mode Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Bleed Synthesis Mode
        </label>
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-inset,#11151E)] p-1 rounded-lg border border-[var(--border-subtle,#242C3D)] text-xs">
          {[
            { id: "mirror", label: "Mirror Edge" },
            { id: "solid", label: "Solid Color" },
            { id: "none", label: "None (TrimBox)" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBleedMode(m.id as typeof bleedMode)}
              className={`py-1.5 rounded font-semibold text-center transition-colors cursor-pointer ${
                bleedMode === m.id
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bleed Amount Stepper */}
      <NumberControl
        label="Bleed Margin"
        value={String(Math.round(mmToUnit(bleedMm, unit as LengthUnit)))}
        min="0"
        max="25"
        step="0.5"
        unit={unit}
        onChange={(val) => setBleedMm(unitToMm(parseFloat(val) || 0, unit as LengthUnit))}
      />

      {/* Quick Presets */}
      <div className="flex items-center space-x-1.5">
        <span className="text-[10px] text-[var(--text-muted,#64748B)]">Presets:</span>
        {[0, 2, 3, 5].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setBleedMm(preset)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
              bleedMm === preset
                ? "bg-[var(--app-accent,#F59E0B)] text-[var(--app-accent-fg,#0F172A)] border-transparent font-bold"
                : "bg-[var(--surface-card,#181D27)] text-[var(--text-secondary,#94A3B8)] border-[var(--border-subtle,#242C3D)] hover:text-[var(--text-primary,#F1F5F9)]"
            }`}
          >
            {preset}mm
          </button>
        ))}
      </div>

      {/* Solid Color Picker if solid mode */}
      {bleedMode === "solid" && (
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)]">
            Bleed Margin Color
          </label>
          <StudioColorPicker color={solidColor} onChange={setSolidColor} />
        </div>
      )}

      {/* Explanation Banner */}
      <div className="p-2.5 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[11px] text-[var(--text-secondary,#94A3B8)] leading-relaxed">
        {bleedMode === "mirror"
          ? "Reflects boundary pixels outward past the trim line to prevent white margins during guillotine slicing."
          : bleedMode === "solid"
          ? "Extends the artwork bounding box with a uniform solid color background."
          : "Preserves the document's original TrimBox and BleedBox geometry without synthesis."}
      </div>
    </div>
  );
}
