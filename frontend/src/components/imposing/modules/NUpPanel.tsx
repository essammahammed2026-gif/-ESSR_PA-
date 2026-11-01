"use client";

import React, { useState } from "react";
import { Layers } from "lucide-react";
import { NumberControl } from "@/components/ui/NumberControl";

interface NUpPanelProps {
  jobMode: string;
  setJobMode: (m: "book" | "gang") => void;
}

export function NUpPanel({ jobMode, setJobMode }: NUpPanelProps) {
  const [nUpScheme, setNUpScheme] = useState<"2-up" | "4-up" | "8-up">("2-up");
  const [bindingStyle, setBindingStyle] = useState<"saddle" | "perfect" | "consecutive">("saddle");
  const [creepMm, setCreepMm] = useState<number>(0);

  return (
    <div className="space-y-4 select-none">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Signature Division (N-Up)
        </label>
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-inset,#11151E)] p-1 rounded-lg border border-[var(--border-subtle,#242C3D)]">
          {(["2-up", "4-up", "8-up"] as const).map((scheme) => (
            <button
              key={scheme}
              type="button"
              onClick={() => {
                setNUpScheme(scheme);
                setJobMode("book");
              }}
              className={`py-1 text-xs font-semibold rounded transition-colors ${
                nUpScheme === scheme
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
              }`}
            >
              {scheme}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Binding Sequence
        </label>
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-inset,#11151E)] p-1 rounded-lg border border-[var(--border-subtle,#242C3D)] text-[10px]">
          {(["saddle", "perfect", "consecutive"] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setBindingStyle(style)}
              className={`py-1 rounded font-medium capitalize transition-colors ${
                bindingStyle === style
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
              }`}
            >
              {style === "saddle" ? "Saddle Stitch" : style === "perfect" ? "Perfect Bound" : "Consecutive"}
            </button>
          ))}
        </div>
      </div>

      <NumberControl
        label="Spine Creep Compensation"
        value={String(creepMm)}
        min="0"
        max="10"
        step="0.1"
        unit="mm"
        onChange={(val) => setCreepMm(parseFloat(val) || 0)}
      />

      <div className="p-2.5 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[11px] text-[var(--text-secondary,#94A3B8)]">
        {nUpScheme === "2-up"
          ? "Places 2 pages side-by-side with opposing heads for front & back sheet duplexing."
          : `Signature imposition grouping ${nUpScheme} per sheet with automatic head-to-head rotation.`}
      </div>
    </div>
  );
}
