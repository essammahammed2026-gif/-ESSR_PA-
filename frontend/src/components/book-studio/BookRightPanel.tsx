"use client";

import React from "react";
import Link from "next/link";
import { 
  Crop, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Layers, 
  BookOpen, 
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface BookRightPanelProps {
  bleedMm: number;
  setBleedMm: (val: number) => void;
  showCropMarks: boolean;
  setShowCropMarks: (val: boolean) => void;
  exportDpi: number;
  setExportDpi: (val: number) => void;
  cleanBorders: boolean;
  setCleanBorders: (val: boolean) => void;
  borderMarginPx: number;
  setBorderMarginPx: (val: number) => void;
  enhanceColors: boolean;
  setEnhanceColors: (val: boolean) => void;
  saturation: number;
  setSaturation: (val: number) => void;
  contrast: number;
  setContrast: (val: number) => void;
  deskew: boolean;
  setDeskew: (val: boolean) => void;
  handleExport: () => void;
  isExporting: boolean;
  sessionId: string | null;
  totalPages: number;
  onCollapse?: () => void;
}

export function BookRightPanel({
  bleedMm,
  setBleedMm,
  showCropMarks,
  setShowCropMarks,
  exportDpi,
  setExportDpi,
  cleanBorders,
  setCleanBorders,
  borderMarginPx,
  setBorderMarginPx,
  enhanceColors,
  setEnhanceColors,
  saturation,
  setSaturation,
  contrast,
  setContrast,
  deskew,
  setDeskew,
  handleExport,
  isExporting,
  sessionId,
  totalPages,
  onCollapse,
}: BookRightPanelProps) {
  return (
    <div className="flex flex-col space-y-3 pb-2 select-none">
      {/* Top Header with Collapse */}
      <div className="flex items-center justify-between pb-0.5 px-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Controls & Export
        </span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Collapse Right Panel"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* 1. Print Bleed & Prepress Geometry */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#242A38] pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
            <Crop size={14} className="text-cyan-400" />
            <span>Print Bleed & Marks</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800/40 rounded">
            Prepress
          </span>
        </div>

        {/* Bleed Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Bleed Width:</span>
            <span className="font-mono font-bold text-cyan-400">{bleedMm.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={bleedMm}
            onChange={(e) => setBleedMm(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="text-[10px] text-slate-500 leading-tight">
            Mirrors outer edge pixels to synthesize standard print bleed.
          </div>
        </div>

        {/* Crop Marks Toggle */}
        <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300 pt-1">
          <input
            type="checkbox"
            checked={showCropMarks}
            onChange={(e) => setShowCropMarks(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span className="text-xs">Draw Vector Crop / Cut Marks</span>
        </label>

        {/* Export DPI Quality */}
        <div className="pt-2 border-t border-[#242A38] space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-400 block">Export Resolution</label>
          <div className="relative">
            <select
              value={exportDpi}
              onChange={(e) => setExportDpi(parseInt(e.target.value, 10))}
              className="w-full appearance-none bg-[#131720] border border-[#2E3648] text-slate-200 text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
            >
              <option value="150">150 DPI (Fast / Draft)</option>
              <option value="200">200 DPI (Standard Press)</option>
              <option value="300">300 DPI (High-End Production)</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 2. Scan Restoration & Color Controls */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#242A38] pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
            <Sparkles size={14} className="text-amber-400" />
            <span>Restoration & Cleanup</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 px-1.5 py-0.5 bg-amber-950/60 border border-amber-800/40 rounded">
            Vision
          </span>
        </div>

        {/* Border Cleaning Toggle & Slider */}
        <div className="space-y-2 p-2 bg-[#131720] rounded-lg border border-[#242A38]">
          <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-200">
            <input
              type="checkbox"
              checked={cleanBorders}
              onChange={(e) => setCleanBorders(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span className="font-semibold text-xs">Edge & Border Cleanup</span>
          </label>
          <p className="text-[10px] text-slate-500 leading-tight">
            Removes dirty glass scanner edges and feed shadows along outer borders.
          </p>

          {cleanBorders && (
            <div className="pt-1 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Edge Depth:</span>
                <span className="font-mono font-bold text-blue-400">{borderMarginPx} px</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={borderMarginPx}
                onChange={(e) => setBorderMarginPx(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Washed-Out Color Recovery */}
        <div className="space-y-2 p-2 bg-[#131720] rounded-lg border border-[#242A38]">
          <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-200">
            <input
              type="checkbox"
              checked={enhanceColors}
              onChange={(e) => setEnhanceColors(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span className="font-semibold text-xs">Paper Whitening & Contrast</span>
          </label>
          <p className="text-[10px] text-slate-500 leading-tight">
            Clears yellow/milky scanner haze, deepens text blacks, and boosts color richness.
          </p>

          {enhanceColors && (
            <div className="pt-1 space-y-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Saturation:</span>
                  <span className="font-mono font-bold text-blue-400">
                    +{Math.round((saturation - 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.8"
                  step="0.05"
                  value={saturation}
                  onChange={(e) => setSaturation(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Contrast & Black Depth:</span>
                  <span className="font-mono font-bold text-blue-400">{contrast.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.4"
                  step="0.02"
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Auto-Deskew Minor Tilt */}
        <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300 pt-1">
          <input
            type="checkbox"
            checked={deskew}
            onChange={(e) => setDeskew(e.target.checked)}
            className="rounded accent-blue-500"
          />
          <span className="text-xs">Auto-Deskew Tilted Pages</span>
        </label>
      </div>

      {/* 3. Export & Inter-Studio Handoff */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#242A38] pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
            <Download size={14} className="text-emerald-400" />
            <span>Export & Handoff</span>
          </div>
          {sessionId && (
            <span className="text-[10px] font-mono text-slate-400">
              {totalPages} pages
            </span>
          )}
        </div>

        {/* Main Export Button */}
        <button
          onClick={handleExport}
          disabled={!sessionId || isExporting}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all"
        >
          {isExporting ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              <span>Rendering PDF...</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Export Cleaned Book PDF</span>
            </>
          )}
        </button>

        {/* Studio Handoffs */}
        <div className="pt-2 border-t border-[#242A38] space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Workflow Handoffs</div>
          <Link
            href="/imposing"
            className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs"
          >
            <div className="flex items-center space-x-2">
              <Layers size={13} className="text-cyan-400" />
              <span>Send to Imposing Studio</span>
            </div>
            <span className="text-[10px] text-slate-500">Booklet / Gang</span>
          </Link>

          <Link
            href="/flipbook"
            className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs"
          >
            <div className="flex items-center space-x-2">
              <BookOpen size={13} className="text-amber-400" />
              <span>Preview in 3D Flipbook</span>
            </div>
            <span className="text-[10px] text-slate-500">Proofing</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
