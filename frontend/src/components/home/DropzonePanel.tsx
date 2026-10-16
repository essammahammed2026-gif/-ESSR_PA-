"use client";

import React from "react";
import Link from "next/link";
import {
  Upload,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Compass,
} from "lucide-react";
import {
  IconImposingStudio,
  IconContourStudio,
  IconBookStudio,
  IconFlipbookStudio,
} from "@/components/shared/StudioIcons";
import { formatMmInUnit, LengthUnit } from "@/lib/units";
import type { UniversalAnalysis } from "./types";

export interface DropzonePanelProps {
  isDragging: boolean;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStatusText: string;
  recentJobs: UniversalAnalysis[];
  unit?: LengthUnit;
  fileInputRef: React.Ref<HTMLInputElement>;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onBrowseClick: () => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectRecent: (job: UniversalAnalysis) => void;
  onClearRecent: () => void;
}

export function DropzonePanel({
  isDragging,
  isAnalyzing,
  analysisProgress,
  analysisStatusText,
  recentJobs,
  unit = "mm",
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onBrowseClick,
  onFileInput,
  onSelectRecent,
  onClearRecent,
}: DropzonePanelProps) {
  return (
    <div className="space-y-4">
      {/* Artwork Drag & Drop Triage Area */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => {
          if (!isAnalyzing) onBrowseClick();
        }}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
          isDragging
            ? "border-cyan-400 bg-cyan-950/20 shadow-xl shadow-cyan-950/30 scale-[0.995]"
            : "border-[#2B3344] bg-[#161A24] hover:bg-[#1A1F2C] hover:border-slate-500 shadow-sm"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
          onChange={onFileInput}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:bg-cyan-500/15 transition-all mb-3 shadow-sm">
          {isAnalyzing ? (
            <RefreshCw size={22} className="animate-spin text-cyan-400" />
          ) : (
            <Upload size={22} />
          )}
        </div>

        <div className="space-y-1.5 max-w-sm">
          <p className="text-xs md:text-sm font-semibold text-white">
            {isAnalyzing ? "Inspecting Prepress File..." : "Drop print artwork here or click to browse"}
          </p>
          <p className="text-[11px] text-slate-400">
            Instant DPI, trim boxes, geometry audit, and smart studio triage
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {["PDF", "PNG", "JPG", "TIFF", "WEBP"].map((ext) => (
              <span
                key={ext}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#11141B] text-slate-400 border border-[#242A38]"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>

        {/* Active Analysis Progress Bar */}
        {isAnalyzing && (
          <div className="w-full max-w-xs mt-4 space-y-1.5 animate-in fade-in">
            <div className="w-full bg-[#12151B] h-2 rounded-full overflow-hidden border border-[#2B3344]">
              <div
                className="bg-cyan-500 h-full transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{analysisStatusText}</span>
              <span>{analysisProgress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Files */}
      {recentJobs.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-[#242A38]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <FolderOpen size={13} className="text-slate-400" />
              <span>Recent Inspections</span>
            </h2>
            <button
              onClick={onClearRecent}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {recentJobs.map((job, idx) => (
              <div
                key={`${job.filename}-${idx}`}
                onClick={() => onSelectRecent(job)}
                className="p-2.5 bg-[#181D27] hover:bg-[#1E2432] border border-[#242A38] hover:border-slate-500 rounded-lg transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium text-white truncate" title={job.filename}>
                    {job.filename}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {unit && unit !== "mm"
                      ? `${formatMmInUnit(job.width_mm, unit)} × ${formatMmInUnit(job.height_mm, unit)}`
                      : `${job.width_mm} × ${job.height_mm} mm`}{" "}
                    • {job.page_count} {job.page_count === 1 ? "page" : "pages"}
                  </p>
                </div>
                <span className="text-[11px] text-cyan-400 font-medium shrink-0 flex items-center space-x-1">
                  <span>Open</span>
                  <ArrowRight size={11} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Studios Quick Launch (4 Core Studios - Navbar Order) */}
      <div className="space-y-2.5 pt-2 border-t border-[#242A38]">
        <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
          <Compass size={13} className="text-slate-400" />
          <span>Production Studios</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Book Studio */}
          <Link
            href="/book-studio"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] rounded-xl transition-all flex items-center space-x-3 group shadow-sm hover:border-[var(--app-accent,#06b6d4)]"
          >
            <div
              className="p-2 rounded-lg shrink-0 group-hover:scale-105 transition-transform"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <IconBookStudio size={18} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[var(--app-accent,#06b6d4)] transition-colors truncate">
              Book Studio
            </span>
          </Link>

          {/* 2. Imposing Studio */}
          <Link
            href="/imposing"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] rounded-xl transition-all flex items-center space-x-3 group shadow-sm hover:border-[var(--app-accent,#06b6d4)]"
          >
            <div
              className="p-2 rounded-lg shrink-0 group-hover:scale-105 transition-transform"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <IconImposingStudio size={18} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[var(--app-accent,#06b6d4)] transition-colors truncate">
              Imposing Studio
            </span>
          </Link>

          {/* 3. Contour Studio */}
          <Link
            href="/contour"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] rounded-xl transition-all flex items-center space-x-3 group shadow-sm hover:border-[var(--app-accent,#06b6d4)]"
          >
            <div
              className="p-2 rounded-lg shrink-0 group-hover:scale-105 transition-transform"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <IconContourStudio size={18} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[var(--app-accent,#06b6d4)] transition-colors truncate">
              Contour Studio
            </span>
          </Link>

          {/* 4. Flipbook Studio */}
          <Link
            href="/flipbook"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] rounded-xl transition-all flex items-center space-x-3 group shadow-sm hover:border-[var(--app-accent,#06b6d4)]"
          >
            <div
              className="p-2 rounded-lg shrink-0 group-hover:scale-105 transition-transform"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <IconFlipbookStudio size={18} />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[var(--app-accent,#06b6d4)] transition-colors truncate">
              Flipbook Studio
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
