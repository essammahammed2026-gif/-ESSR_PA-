"use client";

import React from "react";
import { FileText, ArrowRight } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { formatMmInUnit, LengthUnit } from "@/lib/units";
import type { UniversalAnalysis } from "./types";

export interface AssetPanelProps {
  analysis: UniversalAnalysis;
  routingStudio: string | null;
  unit?: LengthUnit;
  onRouteToStudio: (studio: string, item: UniversalAnalysis) => void;
  onAnalyzeAnother: () => void;
  formatFileSize: (bytes: number) => string;
}

export function AssetPanel({
  analysis,
  routingStudio,
  unit = "mm",
  onRouteToStudio,
  onAnalyzeAnother,
  formatFileSize,
}: AssetPanelProps) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [analysis.thumbnail_url, analysis.file_id, analysis.filename]);

  const formattedDimensions =
    unit && unit !== "mm"
      ? `${formatMmInUnit(analysis.width_mm, unit)} × ${formatMmInUnit(analysis.height_mm, unit)}`
      : `${analysis.width_mm} × ${analysis.height_mm} mm`;

  const availableStudios = (analysis.suggested_studios || []).filter(
    (option) => option.studio !== "preflight"
  );

  const rawThumb = analysis.thumbnail_url || (analysis.file_id ? `/api/inspect/thumbnail/${analysis.file_id}` : null);
  const thumbUrl = rawThumb ? getApiUrl(rawThumb) : null;

  return (
    <div className="lg:col-span-4 space-y-3">
      {/* Asset Card */}
      <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-3.5 shadow-sm">
        {/* Large Artwork Preview */}
        {thumbUrl && !imgError ? (
          <div className="w-full h-52 sm:h-60 rounded-lg overflow-hidden border border-[#2E3648] bg-[#10131A] flex items-center justify-center p-2 relative shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl}
              alt={analysis.filename}
              className="max-w-full max-h-full object-contain rounded"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-44 rounded-lg bg-[#12151B] border border-[#2E3648] flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
            <div
              className="p-3 rounded-full"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <FileText size={28} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 truncate max-w-[200px]" title={analysis.filename}>
                {analysis.filename}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"} • {formattedDimensions}
              </p>
            </div>
          </div>
        )}

        {/* File Metadata */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white truncate" title={analysis.filename}>
            {analysis.filename}
          </h3>
          <p
            className="text-xs font-mono font-semibold"
            style={{ color: "var(--app-accent-text, var(--app-accent, #06b6d4))" }}
          >
            {formattedDimensions}
          </p>
          <p className="text-[11px] text-slate-400">
            {analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"} •{" "}
            {formatFileSize(analysis.size_bytes)}
          </p>
        </div>

        <div className="pt-2 border-t border-[#242A38] flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#12151B] text-slate-400 border border-[#2E3648]">
            {analysis.color_space}
          </span>
          <button
            onClick={onAnalyzeAnother}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#12151B] border border-[#242A38] hover:border-slate-500 transition-colors cursor-pointer"
          >
            Analyze Another
          </button>
        </div>
      </div>

      {/* Dedicated Studio Launchpad */}
      <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-2.5 shadow-sm">
        <div className="text-xs font-semibold text-slate-300">Open in Studio</div>

        <div className="space-y-1.5">
          {availableStudios.map((option) => (
            <button
              key={option.studio}
              disabled={routingStudio !== null}
              onClick={() => onRouteToStudio(option.studio, analysis)}
              className={`w-full px-3 py-2.5 rounded-lg border transition-all text-left flex items-center justify-between group cursor-pointer ${
                option.primary
                  ? "border-[var(--app-accent,#06b6d4)] text-white"
                  : "bg-[#141822] border-[#242A38] hover:border-[var(--app-accent,#06b6d4)] text-slate-300"
              }`}
              style={
                option.primary
                  ? { backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))" }
                  : undefined
              }
            >
              <span className="text-xs font-semibold text-white group-hover:text-[var(--app-accent,#06b6d4)] transition-colors">
                {option.name}
              </span>
              <ArrowRight
                size={13}
                className="text-slate-500 group-hover:text-[var(--app-accent,#06b6d4)] group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
