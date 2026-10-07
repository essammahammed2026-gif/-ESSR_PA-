"use client";

import React from "react";
import { ChevronDown, RotateCw, Crop, Copy, RefreshCw, Trash2 } from "lucide-react";
import { ImposingItem } from "@/types/prepress";
import { toUnit, toMm } from "@/components/imposing/controls";

interface RightControlPanelProps {
  jobMode: string;
  setJobMode: (m: "book" | "gang") => void;
  items: ImposingItem[];
  sheetPreset: string;
  setSheetPreset: (p: string) => void;
  sheetW: number;
  setSheetW: (w: number) => void;
  sheetH: number;
  setSheetH: (h: number) => void;
  unit: string;
  gap: number;
  setGap: (g: number) => void;
  margin: number;
  setMargin: (m: number) => void;
  handleExport: () => void;
  isExporting: boolean;
  cropMarks: boolean;
  setCropMarks: (c: boolean) => void;
  regMarks: boolean;
  setRegMarks: (r: boolean) => void;
  rows?: number | null;
  setRows?: (r: number | null) => void;
  cols?: number | null;
  setCols?: (c: number | null) => void;
  handlePreview?: () => void;
}

export function RightControlPanel({
  jobMode,
  setJobMode,
  setSheetPreset,
  sheetW,
  setSheetW,
  sheetH,
  setSheetH,
  unit,
  gap,
  setGap,
  margin,
  setMargin,
  handleExport,
  isExporting,
  cropMarks,
  setCropMarks,
  regMarks,
  setRegMarks,
  rows,
  setRows,
  cols,
  setCols,
  handlePreview
}: RightControlPanelProps) {

  // For the manual rows/cols vs auto, we'll mock the rows/cols for now as read-only or auto
  

  return (
    <div className="flex flex-col space-y-3 pb-2">
      {/* Imposition Mode */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm">
        <label className="text-xs font-bold text-slate-300 block mb-2">Imposition Mode</label>
        <div className="relative">
          <select 
            value={jobMode}
            onChange={(e) => setJobMode(e.target.value as "book" | "gang")}
            className="w-full appearance-none bg-[#131720] border border-[#2E3648] text-slate-200 text-xs px-3 py-2 rounded-lg outline-none cursor-pointer"
          >
            <option value="gang">Step & Repeat / N-Up (Auto-nest)</option>
            <option value="book">Publication / Booklet</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Sheet & Format */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-3">
        <div className="text-xs font-bold text-slate-300 border-b border-[#242A38] pb-2">Sheet & Format</div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 uppercase font-semibold">Sheet Width/Height</label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-[#131720] border border-[#2E3648] rounded px-2 py-1 flex items-center">
              <input 
                type="number"
                value={toUnit(sheetW, unit)}
                onChange={(e) => { setSheetPreset("custom"); setSheetW(toMm(parseFloat(e.target.value) || 1, unit)); }}
                className="w-full bg-transparent text-white text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-500">{unit}</span>
            </div>
            <span className="text-slate-500 text-xs font-mono">x</span>
            <div className="flex-1 bg-[#131720] border border-[#2E3648] rounded px-2 py-1 flex items-center">
              <input 
                type="number"
                value={toUnit(sheetH, unit)}
                onChange={(e) => { setSheetPreset("custom"); setSheetH(toMm(parseFloat(e.target.value) || 1, unit)); }}
                className="w-full bg-transparent text-white text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-500">{unit}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300">Orientation</label>
          <select className="bg-[#131720] border border-[#2E3648] text-slate-200 text-xs px-2 py-1 rounded outline-none w-24">
            <option>Portrait</option>
            <option>Landscape</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300">Margins</label>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-2 py-1 w-24">
            <input 
              type="number"
              value={toUnit(margin, unit)}
              onChange={(e) => setMargin(toMm(parseFloat(e.target.value) || 0, unit))}
              className="w-full bg-transparent text-white text-xs text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
          </div>
        </div>
      </div>

      {/* Layout & Grid */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b border-[#242A38] pb-2">
           <div className="text-xs font-bold text-slate-300">Layout & Grid</div>
           <button 
             type="button"
             onClick={() => {
               if (rows || cols) {
                 setRows?.(null);
                 setCols?.(null);
               } else {
                 setRows?.(2);
                 setCols?.(2);
               }
             }}
             className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
               !rows && !cols
                 ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/50 hover:bg-emerald-900/50"
                 : "text-amber-400 bg-amber-950/50 border-amber-800/50 hover:bg-amber-900/50"
             }`}
           >
             {!rows && !cols ? "Auto-Fit Active" : "Manual Grid Locked"}
           </button>
        </div>
        
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300">Rows</label>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-2 py-1 w-20">
            <input 
              type="number" 
              min={1}
              max={50}
              placeholder="Auto"
              value={rows ?? ""} 
              onChange={(e) => {
                const val = e.target.value === "" ? null : Math.max(1, parseInt(e.target.value, 10) || 1);
                setRows?.(val);
              }}
              className="w-full bg-transparent text-white text-xs text-right outline-none placeholder:text-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300">Columns</label>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-2 py-1 w-20">
            <input 
              type="number" 
              min={1}
              max={50}
              placeholder="Auto"
              value={cols ?? ""} 
              onChange={(e) => {
                const val = e.target.value === "" ? null : Math.max(1, parseInt(e.target.value, 10) || 1);
                setCols?.(val);
              }}
              className="w-full bg-transparent text-white text-xs text-right outline-none placeholder:text-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300">Gap (Splitters)</label>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-2 py-1 w-24">
            <input 
              type="number"
              value={toUnit(gap, unit)}
              onChange={(e) => setGap(toMm(parseFloat(e.target.value) || 0, unit))}
              className="w-full bg-transparent text-white text-xs text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
          </div>
        </div>
      </div>

      {/* Page Actions */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-2">
        <div className="text-xs font-bold text-slate-300 border-b border-[#242A38] pb-2">Page Actions</div>
        <div className="flex items-center justify-between pt-1">
          <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group">
            <div className="p-1.5 rounded bg-[#131720] group-hover:bg-[#2E3648] border border-[#2E3648]"><RotateCw size={14}/></div>
            <span className="text-[9px]">Rotate 90°</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group">
            <div className="p-1.5 rounded bg-[#131720] group-hover:bg-[#2E3648] border border-[#2E3648]"><Crop size={14}/></div>
            <span className="text-[9px]">Crop</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group">
            <div className="p-1.5 rounded bg-[#131720] group-hover:bg-[#2E3648] border border-[#2E3648]"><Copy size={14}/></div>
            <span className="text-[9px]">Extract</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group">
            <div className="p-1.5 rounded bg-[#131720] group-hover:bg-[#2E3648] border border-[#2E3648]"><RefreshCw size={14}/></div>
            <span className="text-[9px]">Replace</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-rose-400 transition-colors group">
            <div className="p-1.5 rounded bg-[#131720] group-hover:bg-rose-500/20 border border-[#2E3648] group-hover:border-rose-500/30"><Trash2 size={14}/></div>
            <span className="text-[9px]">Delete</span>
          </button>
        </div>
      </div>

      {/* Prepress Marks */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-2.5">
        <div className="text-xs font-bold text-slate-300 border-b border-[#242A38] pb-2">Prepress Marks</div>
        <div className="grid grid-cols-2 gap-2 pt-1">
           <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} className="rounded bg-[#131720] border-[#2E3648] text-blue-500 focus:ring-blue-500" />
              <span className="text-[11px] text-slate-300">Trim Marks</span>
           </label>
           <label className="flex items-center space-x-2 cursor-pointer opacity-50">
              <input type="checkbox" disabled className="rounded bg-[#131720] border-[#2E3648]" />
              <span className="text-[11px] text-slate-400">Color Bars</span>
           </label>
           <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={regMarks} 
                onChange={(e) => setRegMarks(e.target.checked)} 
                className="rounded bg-[#131720] border-[#2E3648] text-blue-500 focus:ring-blue-500" 
              />
              <span className="text-[11px] text-slate-300">Register Marks</span>
           </label>
           <label className="flex items-center space-x-2 cursor-pointer opacity-50">
              <input type="checkbox" disabled className="rounded bg-[#131720] border-[#2E3648]" />
              <span className="text-[11px] text-slate-400">Job Info</span>
           </label>
           <label className="flex items-center space-x-2 cursor-pointer opacity-50">
              <input type="checkbox" disabled className="rounded bg-[#131720] border-[#2E3648]" />
              <span className="text-[11px] text-slate-400">Bleed Marks</span>
           </label>
        </div>
      </div>

      {/* Export Actions */}
      <div className="pt-2 space-y-2">
         <button 
           onClick={handleExport}
           disabled={isExporting}
           className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
         >
            {isExporting ? "Exporting PDF..." : "Process & Export PDF"}
         </button>
         <button 
           onClick={handlePreview}
           className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
         >
            Apply to Sheet
         </button>
      </div>
    </div>
  );
}
