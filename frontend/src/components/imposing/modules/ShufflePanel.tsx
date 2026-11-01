"use client";

import React, { useState } from "react";
import { Shuffle } from "lucide-react";

export function ShufflePanel() {
  const [shuffleScheme, setShuffleScheme] = useState<"cut_stack" | "booklet" | "dutch" | "sequential">("cut_stack");

  return (
    <div className="space-y-4 select-none">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Collation Scheme
        </label>
        <div className="space-y-1.5">
          {[
            {
              id: "cut_stack",
              title: "Cut & Stack",
              desc: "Stacks sheets so that guillotine cuts yield sequentially numbered piles without manual collating.",
            },
            {
              id: "booklet",
              title: "Saddle Stitch Fold",
              desc: "Arranges outer and inner signature spreads (e.g., 16, 1, 2, 15) for single-fold booklets.",
            },
            {
              id: "dutch",
              title: "Dutch Cut (Mixed Orientation)",
              desc: "Rotates a subset of items 90° to squeeze additional copies onto leftover sheet margin space.",
            },
            {
              id: "sequential",
              title: "Straight Sequential",
              desc: "Straight left-to-right, top-to-bottom page order across all sheets.",
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setShuffleScheme(item.id as typeof shuffleScheme)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                shuffleScheme === item.id
                  ? "bg-[var(--surface-card,#181D27)] border-[var(--app-accent,#F59E0B)] text-[var(--text-primary,#F1F5F9)]"
                  : "bg-[var(--surface-inset,#11151E)] border-[var(--border-subtle,#242C3D)] text-[var(--text-secondary,#94A3B8)] hover:border-[var(--border-strong,#333E54)]"
              }`}
            >
              <div className="text-xs font-semibold">{item.title}</div>
              <div className="text-[10px] text-[var(--text-muted,#64748B)] mt-0.5 leading-relaxed">
                {item.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
