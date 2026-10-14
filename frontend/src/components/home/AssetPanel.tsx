"use client";

import React from "react";
import { FileText, ArrowRight } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import type { UniversalAnalysis } from "./types";

export interface AssetPanelProps {
  analysis: UniversalAnalysis;
  routingStudio: string | null;
  onRouteToStudio: (studio: string, item: UniversalAnalysis) => void;
  onAnalyzeAnother: () => void;
  formatFileSize: (bytes: number) => string;
}

export function AssetPanel({
  analysis,
  routingStudio,
  onRouteToStudio,
  onAnalyzeAnother,
  formatFileSize,
}: AssetPanelProps) {
  return (
    <div className="lg:col-span-4 space-y-3">
      {/* Asset Card */}
      <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-3.5 shadow-sm">
        <div className="flex items-start space-x-3">
          {analysis.thumbnail_url ? (
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#2E3648] bg-black/40 shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getApiUrl(analysis.thumbnail_url)}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[#12151B] border border-[#2E3648] flex items-center justify-center text-slate-400 shrink-0">
              <FileText size={22} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-white truncate" title={analysis.filename}>
              {analysis.filename}
            </h3>
            <p className="text-[11px] font-mono text-cyan-400 font-semibold mt-0.5">
              {analysis.width_mm} × {analysis.height_mm} mm
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"} •{" "}
              {formatFileSize(analysis.size_bytes)}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-[#242A38] flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#12151B] text-slate-400 border border-[#2E3648]">
            {analysis.color_space}
          </span>
          <button
            onClick={onAnalyzeAnother}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#12151B] border border-[#242A38] hover:border-slate-500 transition-colors"
          >
            Analyze Another
          </button>
        </div>
      </div>

      {/* Dedicated Studio Launchpad */}
      <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-2.5 shadow-sm">
        <div className="text-xs font-semibold text-slate-300">Open in Studio</div>

        <div className="space-y-1.5">
          {analysis.suggested_studios.map((option) => (
            <button
              key={option.studio}
              disabled={routingStudio !== null}
              onClick={() => onRouteToStudio(option.studio, analysis)}
              className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-center justify-between group ${
                option.primary
                  ? "bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400 text-white"
                  : "bg-[#141822] border-[#242A38] hover:border-slate-500 text-slate-300"
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {option.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{option.reason}</div>
              </div>
              <ArrowRight
                size={13}
                className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
