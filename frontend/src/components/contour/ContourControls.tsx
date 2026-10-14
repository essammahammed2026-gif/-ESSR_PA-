"use client";

import React from "react";
import {
  Scissors,
  Download,
  Loader2,
  RotateCcw,
  Upload,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { NumberControl } from "@/components/ui/NumberControl";

export const PRESET_COLORS: { name: string; value: string }[] = [
  { name: "CutContour (Magenta)", value: "#FF00FF" },
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#00FF00" },
  { name: "Blue", value: "#0000FF" },
  { name: "Black", value: "#000000" },
];

export interface ContourSuggestedOptions {
  offset_val: string;
  threshold: string;
  smoothing_factor: string;
  keep_holes: boolean;
  add_white_matte: boolean;
  stroke_color: string;
}

export interface DetectedProfile {
  width: number;
  height: number;
  hasAlpha: boolean;
  bgType: string;
  suggestedOptions: ContourSuggestedOptions;
}

export interface ContourControlsProps {
  offsetVal: string;
  setOffsetVal: (v: string) => void;
  threshold: string;
  setThreshold: (v: string) => void;
  smoothing: string;
  setSmoothing: (v: string) => void;
  keepHoles: boolean;
  setKeepHoles: (v: boolean) => void;
  addWhiteMatte: boolean;
  setAddWhiteMatte: (v: boolean) => void;
  strokeColor: string;
  setStrokeColor: (v: string) => void;
  detectedProfile: DetectedProfile | null;
  fileId: string | null;
  svgContent: string | null;
  isGenerating: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerate: () => void;
  handleDownload: () => void;
  handleResetToAuto: () => void;
}

export function ContourControls({
  offsetVal,
  setOffsetVal,
  threshold,
  setThreshold,
  smoothing,
  setSmoothing,
  keepHoles,
  setKeepHoles,
  addWhiteMatte,
  setAddWhiteMatte,
  strokeColor,
  setStrokeColor,
  detectedProfile,
  fileId,
  svgContent,
  isGenerating,
  handleFileUpload,
  handleGenerate,
  handleDownload,
  handleResetToAuto,
}: ContourControlsProps) {
  return (
    <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-3.5 h-full overflow-y-auto">
      <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-[#242A38]">
        <Upload size={14} className="text-pink-400" />
        <span>Input Artwork</span>
      </div>

      <div>
        <label
          htmlFor="contour-file-input"
          className="w-full border-2 border-dashed border-[#2E3648] hover:border-pink-500/50 rounded-lg p-4 text-center cursor-pointer block bg-[#131720]/60 transition-colors"
        >
          <input
            id="contour-file-input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Scissors size={24} className="text-pink-400 mx-auto mb-2 opacity-80" />
          <span className="text-xs font-semibold text-slate-300 block">
            Select Artwork File
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            PNG with transparency or PDF
          </span>
        </label>
      </div>

      {detectedProfile && (
        <div className="bg-[#131720] border border-[#2E3648] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-pink-400" />
              Auto-Configured Profile
            </span>
            <button
              type="button"
              onClick={handleResetToAuto}
              title="Reset options to auto-detected settings for this image"
              className="text-[10px] text-slate-400 hover:text-pink-300 flex items-center gap-1 hover:underline transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-[#1F2633] text-slate-300 font-mono">
              {detectedProfile.width} × {detectedProfile.height}px
            </span>
            <span className={`px-1.5 py-0.5 rounded font-mono ${
              detectedProfile.hasAlpha
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800/40"
                : "bg-blue-950 text-blue-300 border border-blue-800/40"
            }`}>
              {detectedProfile.hasAlpha ? "Alpha Cutout" : detectedProfile.bgType.replace("_", " ")}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1F2633] text-slate-300 font-mono">
              Thresh: {detectedProfile.suggestedOptions.threshold}
            </span>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-[#242A38] space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <SlidersHorizontal size={14} className="text-pink-400" />
          <span>Cut Geometry</span>
        </div>

        <NumberControl
          label="Bleed / Choke Offset"
          value={offsetVal}
          min="-10"
          max="10"
          step="0.5"
          unit="mm"
          onChange={setOffsetVal}
        />

        <NumberControl
          label="Edge Smoothing"
          value={smoothing}
          min="0"
          max="15"
          step="1"
          onChange={setSmoothing}
        />

        <NumberControl
          label="Detection Threshold"
          value={threshold}
          min="0"
          max="100"
          step="1"
          onChange={setThreshold}
        />
      </div>

      {/* Stroke Color */}
      <div className="pt-3 border-t border-[#242A38]">
        <label className="block text-xs font-semibold text-slate-300 mb-2">Spot Stroke Swatch</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              onClick={() => setStrokeColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 ${
                strokeColor === c.value ? "border-white scale-110" : "border-transparent hover:scale-105"
              } transition-transform shadow-sm`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div
            title="Custom Spot Color"
            className="relative w-6 h-6 rounded-full border border-[#2E3648] overflow-hidden cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-[#232936]"
          >
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0"
            />
            <span className="text-[10px] font-bold text-slate-300">+</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">{strokeColor.toUpperCase()} (CutContour)</div>
      </div>

      {/* Finishing Toggles */}
      <div className="pt-3 border-t border-[#242A38] space-y-2.5">
        <label className="flex items-center space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={keepHoles}
            onChange={(e) => setKeepHoles(e.target.checked)}
            className="rounded bg-[#131720] border-[#2E3648] text-pink-500 focus:ring-pink-500"
          />
          <span className="text-xs font-medium text-slate-300">Preserve Internal Cut Holes</span>
        </label>

        <label className="flex items-center space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={addWhiteMatte}
            onChange={(e) => setAddWhiteMatte(e.target.checked)}
            className="rounded bg-[#131720] border-[#2E3648] text-pink-500 focus:ring-pink-500"
          />
          <span className="text-xs font-medium text-slate-300">Underbase White Matte Base</span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#242A38] space-y-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!fileId || isGenerating}
          className="w-full px-3 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-sm"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{isGenerating ? "Tracing Die Lines..." : "Generate Cut Path"}</span>
        </button>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!svgContent}
            className="flex-1 px-3 py-1.5 bg-[#232936] hover:bg-[#2E3648] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Download size={13} />
            <span>Export SVG</span>
          </button>
          <button
            type="button"
            onClick={handleResetToAuto}
            disabled={!detectedProfile}
            title="Reset options to auto-detected settings for this image"
            className="flex-1 px-3 py-1.5 bg-[#232936] hover:bg-[#2E3648] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset to Auto</span>
          </button>
        </div>
      </div>
    </div>
  );
}
