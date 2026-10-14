"use client";

import React from "react";
import type { AxisSegments } from "@/lib/splitLines";

export interface DimensionsBoxProps {
  currentCropWidthMm: number;
  currentCropHeightMm: number;
  segments: AxisSegments;
  hasCutLines: boolean;
  isSelectedPageSplit?: boolean;
  splitPageWidthMm?: number;
  splitPageHeightMm?: number;
}

export function DimensionsBox({
  currentCropWidthMm,
  currentCropHeightMm,
  segments,
  hasCutLines,
  isSelectedPageSplit,
  splitPageWidthMm,
  splitPageHeightMm,
}: DimensionsBoxProps) {
  const vCount = segments.vertical.length;
  const hCount = segments.horizontal.length;
  const mixed = vCount > 1 && hCount > 1;
  const singleVertical = vCount === 2 && hCount === 1;
  return (
    <div className="space-y-1.5 p-2 rounded-lg bg-[#0F131C] border border-amber-500/30">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span className="flex items-center space-x-1.5 text-amber-400">
          <span>📐</span>
          <span>{hasCutLines ? "Sheet & Page Dimensions" : "Resulting Dimensions"}</span>
        </span>
      </div>

      {isSelectedPageSplit ? (
        <div className="bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38] flex justify-between items-center text-[11px] font-mono">
          <span className="text-slate-400 font-sans text-[10px]">This Page:</span>
          <span className="text-amber-300 font-bold">
            {splitPageWidthMm ?? currentCropWidthMm} × {splitPageHeightMm ?? currentCropHeightMm} mm
          </span>
        </div>
      ) : hasCutLines ? (
        <div className="space-y-1 text-[10px] font-mono">
          <div className="flex justify-between items-center bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38]">
            <span className="text-slate-400 font-sans">Full Sheet:</span>
            <span className="text-slate-200 font-bold">
              {currentCropWidthMm} × {currentCropHeightMm} mm
            </span>
          </div>
          {singleVertical ? (
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-[#181D27] p-1.5 rounded border border-[#242A38] flex flex-col">
                <div className="text-amber-400 text-[9px] font-sans font-bold"><span>PAGE 1 (LEFT)</span></div>
                <span className="text-slate-100 font-bold text-[11px] mt-0.5">
                  {segments.vertical[0]} × {currentCropHeightMm} mm
                </span>
              </div>
              <div className="bg-[#181D27] p-1.5 rounded border border-[#242A38] flex flex-col items-end text-right">
                <div className="text-amber-400 text-[9px] font-sans font-bold"><span>PAGE 2 (RIGHT)</span></div>
                <span className="text-slate-100 font-bold text-[11px] mt-0.5">
                  {segments.vertical[1]} × {currentCropHeightMm} mm
                </span>
              </div>
            </div>
          ) : mixed ? (
            <div className="space-y-1">
              <div className="bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38]">
                <div className="text-amber-400 text-[9px] font-sans font-bold mb-0.5">COLUMNS ({vCount})</div>
                <div className="text-slate-100 font-bold text-[11px]">{segments.vertical.join(" · ")} mm</div>
              </div>
              <div className="bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38]">
                <div className="text-amber-400 text-[9px] font-sans font-bold mb-0.5">ROWS ({hCount})</div>
                <div className="text-slate-100 font-bold text-[11px]">{segments.horizontal.join(" · ")} mm</div>
              </div>
              <div className="text-center text-amber-300/90 font-sans text-[10px]">
                {vCount * hCount} pages per sheet
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {(vCount > 1 ? segments.vertical : segments.horizontal).map((size, i) => (
                <div key={i} className="bg-[#181D27] p-1.5 rounded border border-[#242A38] flex flex-col">
                  <div className="text-amber-400 text-[9px] font-sans font-bold">
                    <span>{vCount > 1 ? `PAGE ${i + 1}` : `STRIP ${i + 1}`}</span>
                  </div>
                  <span className="text-slate-100 font-bold text-[11px] mt-0.5">
                    {vCount > 1 ? `${size} × ${currentCropHeightMm} mm` : `${currentCropWidthMm} × ${size} mm`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#181D27] px-2 py-1.5 rounded border border-[#242A38] flex justify-between items-center text-[11px] font-mono">
          <span className="text-slate-400 font-sans text-[10px]">Page Size:</span>
          <span className="text-amber-300 font-bold">
            {currentCropWidthMm} × {currentCropHeightMm} mm
          </span>
        </div>
      )}
    </div>
  );
}
