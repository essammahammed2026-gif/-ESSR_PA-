"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  RotateCw,
  Crop,
  Copy,
  RefreshCw,
  Trash2,
  Layers,
  Maximize2,
  Grid,
  Crosshair,
  SlidersHorizontal,
} from "lucide-react";
import { ImposingItem } from "@/types/prepress";
import { mmToUnit, unitToMm } from "@/lib/units";

type ImposingToolId = "mode" | "sheet" | "grid" | "actions" | "marks";

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
  handlePreview,
}: RightControlPanelProps) {
  const [activeTool, setActiveTool] = useState<ImposingToolId | null>(null);

  const tools: {
    id: ImposingToolId;
    title: string;
    category: "IMPOSITION SETUP" | "FINISHING & ACTIONS";
    icon: React.ReactNode;
  }[] = [
    { id: "mode", title: "Imposition Mode", category: "IMPOSITION SETUP", icon: <Layers size={15} /> },
    { id: "sheet", title: "Sheet & Format", category: "IMPOSITION SETUP", icon: <Maximize2 size={15} /> },
    { id: "grid", title: "Layout & Grid", category: "IMPOSITION SETUP", icon: <Grid size={15} /> },
    { id: "marks", title: "Prepress Marks", category: "FINISHING & ACTIONS", icon: <Crosshair size={15} /> },
    { id: "actions", title: "Page Actions", category: "FINISHING & ACTIONS", icon: <SlidersHorizontal size={15} /> },
  ];

  const activeToolMeta = tools.find((t) => t.id === activeTool);

  return (
    <div className="flex flex-col h-full bg-[#11141B] select-none overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#1E232E] shrink-0">
        {activeTool && activeToolMeta ? (
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="flex items-center space-x-2 text-slate-200 hover:text-white transition-colors cursor-pointer group"
          >
            <ChevronLeft size={16} className="text-slate-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
            <span className="text-xs font-semibold tracking-tight">{activeToolMeta.title}</span>
          </button>
        ) : (
          <span className="text-xs font-semibold text-slate-100 tracking-tight">Imposing Tools</span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!activeTool ? (
          <div className="space-y-5">
            {(["IMPOSITION SETUP", "FINISHING & ACTIONS"] as const).map((cat) => (
              <div key={cat} className="space-y-1">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {cat}
                </div>
                {tools
                  .filter((t) => t.category === cat)
                  .map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className="w-full flex items-center space-x-3 px-2.5 py-2.5 rounded-lg text-left text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                        {tool.icon}
                      </span>
                      <span className="text-[13px] font-normal tracking-tight truncate">
                        {tool.title}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 px-1">
            {activeTool === "mode" && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Workflow Mode
                </label>
                <div className="relative">
                  <select
                    value={jobMode}
                    onChange={(e) => setJobMode(e.target.value as "book" | "gang")}
                    className="w-full appearance-none bg-[#181D27] border border-[#242A38] text-slate-200 text-xs px-3 py-2 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="gang">Step & Repeat / N-Up (Auto-nest)</option>
                    <option value="book">Publication / Booklet</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {activeTool === "sheet" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Sheet Width / Height</label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-[#181D27] border border-[#242A38] rounded px-2 py-1.5 flex items-center">
                      <input
                        type="number"
                        value={mmToUnit(sheetW, unit)}
                        onChange={(e) => {
                          setSheetPreset("custom");
                          setSheetW(unitToMm(parseFloat(e.target.value) || 1, unit));
                        }}
                        className="w-full bg-transparent text-white text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500">{unit}</span>
                    </div>
                    <span className="text-slate-500 text-xs font-mono">×</span>
                    <div className="flex-1 bg-[#181D27] border border-[#242A38] rounded px-2 py-1.5 flex items-center">
                      <input
                        type="number"
                        value={mmToUnit(sheetH, unit)}
                        onChange={(e) => {
                          setSheetPreset("custom");
                          setSheetH(unitToMm(parseFloat(e.target.value) || 1, unit));
                        }}
                        className="w-full bg-transparent text-white text-xs outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500">{unit}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300">Orientation</label>
                  <select className="bg-[#181D27] border border-[#242A38] text-slate-200 text-xs px-2 py-1 rounded outline-none w-28">
                    <option>Portrait</option>
                    <option>Landscape</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300">Margins</label>
                  <div className="flex items-center bg-[#181D27] border border-[#242A38] rounded px-2 py-1 w-24">
                    <input
                      type="number"
                      value={mmToUnit(margin, unit)}
                      onChange={(e) => setMargin(unitToMm(parseFloat(e.target.value) || 0, unit))}
                      className="w-full bg-transparent text-white text-xs text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTool === "grid" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Grid Mode</span>
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
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-[#242A38] transition-colors cursor-pointer"
                  >
                    {!rows && !cols ? "Auto-Fit Active" : "Manual Grid Locked"}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300">Rows</label>
                  <div className="flex items-center bg-[#181D27] border border-[#242A38] rounded px-2 py-1 w-20">
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
                  <div className="flex items-center bg-[#181D27] border border-[#242A38] rounded px-2 py-1 w-20">
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
                  <div className="flex items-center bg-[#181D27] border border-[#242A38] rounded px-2 py-1 w-24">
                    <input
                      type="number"
                      value={mmToUnit(gap, unit)}
                      onChange={(e) => setGap(unitToMm(parseFloat(e.target.value) || 0, unit))}
                      className="w-full bg-transparent text-white text-xs text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTool === "actions" && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Quick Page Operations
                </span>
                <div className="flex items-center justify-between pt-1">
                  <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group cursor-pointer">
                    <div className="p-2 rounded bg-[#181D27] group-hover:bg-white/[0.08] border border-[#242A38]"><RotateCw size={14} /></div>
                    <span className="text-[9px]">Rotate 90°</span>
                  </button>
                  <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group cursor-pointer">
                    <div className="p-2 rounded bg-[#181D27] group-hover:bg-white/[0.08] border border-[#242A38]"><Crop size={14} /></div>
                    <span className="text-[9px]">Crop</span>
                  </button>
                  <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group cursor-pointer">
                    <div className="p-2 rounded bg-[#181D27] group-hover:bg-white/[0.08] border border-[#242A38]"><Copy size={14} /></div>
                    <span className="text-[9px]">Extract</span>
                  </button>
                  <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white transition-colors group cursor-pointer">
                    <div className="p-2 rounded bg-[#181D27] group-hover:bg-white/[0.08] border border-[#242A38]"><RefreshCw size={14} /></div>
                    <span className="text-[9px]">Replace</span>
                  </button>
                  <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-rose-400 transition-colors group cursor-pointer">
                    <div className="p-2 rounded bg-[#181D27] group-hover:bg-rose-500/20 border border-[#242A38] group-hover:border-rose-500/30"><Trash2 size={14} /></div>
                    <span className="text-[9px]">Delete</span>
                  </button>
                </div>
              </div>
            )}

            {activeTool === "marks" && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Sheet Marks
                </span>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={cropMarks}
                      onChange={(e) => setCropMarks(e.target.checked)}
                      className="rounded bg-[#181D27] border-[#242A38] text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-300">Trim Marks</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={regMarks}
                      onChange={(e) => setRegMarks(e.target.checked)}
                      className="rounded bg-[#181D27] border-[#242A38] text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-300">Registration Marks</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer opacity-50 py-1">
                    <input type="checkbox" disabled className="rounded bg-[#181D27] border-[#242A38]" />
                    <span className="text-xs text-slate-400">Color Bars</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer opacity-50 py-1">
                    <input type="checkbox" disabled className="rounded bg-[#181D27] border-[#242A38]" />
                    <span className="text-xs text-slate-400">Job Info Slug</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Primary Actions */}
      <div className="p-3 border-t border-[#1E232E] space-y-2 shrink-0">
        <button
          onClick={handlePreview}
          className="w-full py-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          Apply to Sheet
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isExporting ? "Exporting PDF..." : "Process & Export PDF"}
        </button>
      </div>
    </div>
  );
}
