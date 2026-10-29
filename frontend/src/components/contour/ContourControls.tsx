"use client";

import React, { useState } from "react";
import {
  Scissors,
  Download,
  Loader2,
  RotateCcw,
  Upload,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  Palette,
  Layers,
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
  artworkOpacity?: string;
  setArtworkOpacity?: React.Dispatch<React.SetStateAction<string>>;
}

type ContourToolId = "artwork" | "geometry" | "swatch" | "finishing";

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
  artworkOpacity,
  setArtworkOpacity,
}: ContourControlsProps) {
  const [activeTool, setActiveTool] = useState<ContourToolId | null>(null);

  const tools: {
    id: ContourToolId;
    title: string;
    category: "DIE-CUT SETUP" | "FINISHING & COLOR";
    icon: React.ReactNode;
  }[] = [
    { id: "artwork", title: "Input Artwork", category: "DIE-CUT SETUP", icon: <Upload size={15} /> },
    { id: "geometry", title: "Cut Geometry", category: "DIE-CUT SETUP", icon: <SlidersHorizontal size={15} /> },
    { id: "swatch", title: "Spot Stroke Swatch", category: "FINISHING & COLOR", icon: <Palette size={15} /> },
    { id: "finishing", title: "Finishing Options", category: "FINISHING & COLOR", icon: <Layers size={15} /> },
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
          <span className="text-xs font-semibold text-slate-100 tracking-tight">Contour Tools</span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!activeTool ? (
          <div className="space-y-5">
            {(["DIE-CUT SETUP", "FINISHING & COLOR"] as const).map((cat) => (
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
            {activeTool === "artwork" && (
              <div className="space-y-3">
                <label
                  htmlFor="contour-file-input"
                  className="w-full border border-dashed border-[#242A38] hover:border-slate-500 rounded-lg p-4 text-center cursor-pointer block bg-[#181D27]/50 transition-colors"
                >
                  <input
                    id="contour-file-input"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Scissors size={22} className="text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-200 block">
                    Select Artwork File
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    PNG with transparency or PDF
                  </span>
                </label>

                {detectedProfile && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Sparkles size={12} />
                        Detected Profile
                      </span>
                      <button
                        type="button"
                        onClick={handleResetToAuto}
                        title="Reset options to auto-detected settings for this image"
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 hover:underline transition-colors cursor-pointer"
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 font-mono">
                        {detectedProfile.width} × {detectedProfile.height}px
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 font-mono">
                        {detectedProfile.hasAlpha ? "Alpha Cutout" : detectedProfile.bgType.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )}

                {artworkOpacity !== undefined && setArtworkOpacity && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">Artwork Proof Opacity</label>
                      <span className="text-[10px] font-mono text-slate-400">{artworkOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={artworkOpacity}
                      onChange={(e) => setArtworkOpacity(e.target.value)}
                      className="w-full h-1 bg-[#242A38] rounded appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTool === "geometry" && (
              <div className="space-y-4">
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
            )}

            {activeTool === "swatch" && (
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Spot Stroke Swatch
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => setStrokeColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        strokeColor === c.value ? "border-white scale-110" : "border-transparent hover:scale-105"
                      } transition-transform shadow-sm`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <div
                    title="Custom Spot Color"
                    className="relative w-6 h-6 rounded-full border border-[#242A38] overflow-hidden cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-[#181D27]"
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
            )}

            {activeTool === "finishing" && (
              <div className="space-y-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cut Path & Underbase
                </span>
                <label className="flex items-center space-x-2.5 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={keepHoles}
                    onChange={(e) => setKeepHoles(e.target.checked)}
                    className="rounded bg-[#181D27] border-[#242A38] text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-300">Preserve Internal Cut Holes</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={addWhiteMatte}
                    onChange={(e) => setAddWhiteMatte(e.target.checked)}
                    className="rounded bg-[#181D27] border-[#242A38] text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-300">Underbase White Matte Base</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-3 border-t border-[#1E232E] space-y-2 shrink-0">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!fileId || isGenerating}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-sm cursor-pointer"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{isGenerating ? "Tracing Die Lines..." : "Generate Cut Path"}</span>
        </button>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!svgContent}
            className="flex-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>Export SVG</span>
          </button>
          <button
            type="button"
            onClick={handleResetToAuto}
            disabled={!detectedProfile}
            title="Reset options to auto-detected settings for this image"
            className="flex-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
