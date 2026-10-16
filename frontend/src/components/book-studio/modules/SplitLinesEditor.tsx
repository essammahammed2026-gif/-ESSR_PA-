"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { IconSplitVertical, IconSplitHorizontal } from "@/components/shared/StudioIcons";
import type { SplitDirection, SplitLine } from "@/types/book_studio";
import { clampCut } from "@/lib/splitLines";

export interface SplitLinesEditorProps {
  lines: SplitLine[];
  disabled?: boolean;
  onLinesChange: (lines: SplitLine[]) => void;
}

function CutLineRow({
  index,
  line,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  line: SplitLine;
  canRemove: boolean;
  onChange: (next: SplitLine) => void;
  onRemove: () => void;
}) {
  const pct = Math.round(line.pos * 1000) / 10;
  const [text, setText] = useState<string>(String(pct));
  useEffect(() => setText(String(pct)), [pct]);

  const commitText = () => {
    const v = Number(text);
    if (!Number.isFinite(v)) {
      setText(String(pct));
      return;
    }
    onChange({ ...line, pos: clampCut(v / 100) });
  };

  const setDirection = (direction: SplitDirection) => onChange({ ...line, direction });

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] font-mono text-slate-400 w-3.5 shrink-0" title={`Cut line ${index + 1}`}>
        L{index + 1}
      </span>
      <div className="flex items-center rounded overflow-hidden border border-[#242A38] shrink-0">
        {(["vertical", "horizontal"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`p-1 transition-colors cursor-pointer ${
              line.direction === d
                ? "bg-slate-800 text-white"
                : "bg-[#131720] text-slate-500 hover:text-slate-300"
            }`}
            style={line.direction === d ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            title={d === "vertical" ? "Vertical cut (left / right pages)" : "Horizontal cut (top / bottom strips)"}
          >
            {d === "vertical" ? <IconSplitVertical size={11} /> : <IconSplitHorizontal size={11} />}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={1}
        max={99}
        step={0.5}
        value={Math.min(99, Math.max(1, pct))}
        onChange={(e) => onChange({ ...line, pos: clampCut(Number(e.target.value) / 100) })}
        className="flex-1 min-w-[36px] h-1 accent-amber-500 cursor-pointer"
        title={`Cut line ${index + 1} position (${pct}%)`}
      />
      <div className="flex items-center bg-[#131720] border border-[#283040] rounded px-1 py-0.5 shrink-0">
        <input
          type="number"
          min={1}
          max={99}
          step={0.5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-7 text-[10px] bg-transparent text-right text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none font-mono"
          title={`Exact position of cut line ${index + 1} (%)`}
        />
        <span className="text-[9px] text-slate-500 ml-0.5">%</span>
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors shrink-0 cursor-pointer"
          title={`Remove cut line ${index + 1}`}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

/** Compact cut-line list without redundant wrapper or duplicate add buttons. */
export function SplitLinesEditor({ lines, disabled, onLinesChange }: SplitLinesEditorProps) {
  if (disabled || lines.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-0.5">
      {lines.map((line, i) => (
        <CutLineRow
          key={i}
          index={i}
          line={line}
          canRemove={lines.length > 0}
          onChange={(next) => onLinesChange(lines.map((l, j) => (j === i ? next : l)))}
          onRemove={() => onLinesChange(lines.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  );
}
