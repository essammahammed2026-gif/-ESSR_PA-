"use client";

import React, { useEffect, useState } from "react";
import type { SplitDirection, SplitLine } from "@/types/book_studio";
import { clampCut, getNextCutLine } from "@/lib/splitLines";

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
    <div className="flex items-center space-x-1.5">
      <span className="text-[10px] font-mono text-amber-400 w-6 shrink-0">L{index + 1}</span>
      <div className="flex items-center rounded-md overflow-hidden border border-[#242A38] shrink-0" title="Cut axis for this line">
        {(["vertical", "horizontal"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`px-1.5 py-1 text-[11px] leading-none transition-colors ${
              line.direction === d ? "bg-amber-600 text-white" : "bg-[#131720] text-slate-500 hover:text-slate-200"
            }`}
            title={d === "vertical" ? "Vertical cut (left/right pages)" : "Horizontal cut (top/bottom strips)"}
          >
            {d === "vertical" ? "↔" : "↕"}
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
        className="flex-1 h-1 accent-amber-500 cursor-pointer min-w-0"
        title={`Cut line ${index + 1} position`}
      />
      <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-1 py-0.5 shrink-0 focus-within:border-amber-500">
        <input
          type="number"
          min={1}
          max={99}
          step={0.5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-11 text-[10px] bg-transparent text-center text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none font-mono"
          title={`Exact position of cut line ${index + 1} (percent)`}
        />
        <span className="text-[9px] text-slate-500">%</span>
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded border border-transparent hover:border-rose-900/40 transition-colors shrink-0"
          title={`Remove cut line ${index + 1}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Cut-line list: each line has its own axis, slider, and exact % field (up to 3 lines). */
export function SplitLinesEditor({ lines, disabled, onLinesChange }: SplitLinesEditorProps) {
  if (disabled) return null;
  const addLine = () => {
    onLinesChange([...lines, getNextCutLine(lines)]);
  };
  return (
    <div className="space-y-1.5 p-2 rounded-lg bg-[#0F131C] border border-[#242A38]">
      <div className="text-[10px] uppercase font-bold text-slate-400">Cut Lines ({lines.length})</div>
      {lines.length === 0 && (
        <div className="text-[10px] text-slate-500 leading-relaxed">
          Plain crop — no cuts. Add a line to split the sheet into pages.
        </div>
      )}
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
      <button
        type="button"
        onClick={addLine}
        className="w-full py-1 text-[10px] text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/30 rounded border border-dashed border-amber-800/40 transition-colors"
        title="Add another cut line"
      >
        + Add cut line
      </button>
    </div>
  );
}
