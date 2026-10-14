"use client";

import React from "react";
import Link from "next/link";
import {
  Upload,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Compass,
  Layers,
  Scissors,
  BookOpen,
  FileCheck,
  Sparkles,
} from "lucide-react";
import type { UniversalAnalysis } from "./types";

export interface DropzonePanelProps {
  isDragging: boolean;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStatusText: string;
  recentJobs: UniversalAnalysis[];
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
    <div className="space-y-3">
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

        <div className="space-y-1 max-w-sm">
          <p className="text-xs md:text-sm font-semibold text-white">
            {isAnalyzing ? "Inspecting Prepress File..." : "Drop print artwork here or click to browse"}
          </p>
          <p className="text-[11px] text-slate-400">PDF, PNG, JPG, TIFF, WEBP</p>
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
              <span>Recent Files</span>
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
                    {job.width_mm} × {job.height_mm} mm • {job.page_count}p
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

      {/* Production Studios Quick Launch */}
      <div className="space-y-2.5 pt-2 border-t border-[#242A38]">
        <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
          <Compass size={13} className="text-slate-400" />
          <span>Studios</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <Link
            href="/imposing"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-emerald-500/50 rounded-lg transition-all flex flex-col justify-between group"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-2">
              <Layers size={16} />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
              Imposing Studio
            </div>
          </Link>

          <Link
            href="/contour"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-pink-500/50 rounded-lg transition-all flex flex-col justify-between group"
          >
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 w-fit mb-2">
              <Scissors size={16} />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
              Contour Studio
            </div>
          </Link>

          <Link
            href="/book-studio"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-amber-500/50 rounded-lg transition-all flex flex-col justify-between group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 w-fit mb-2">
              <BookOpen size={16} />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
              Book Studio
            </div>
          </Link>

          <Link
            href="/preflight"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-blue-500/50 rounded-lg transition-all flex flex-col justify-between group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-2">
              <FileCheck size={16} />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
              Preflight Studio
            </div>
          </Link>

          <Link
            href="/flipbook"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-indigo-500/50 rounded-lg transition-all flex flex-col justify-between group"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit mb-2">
              <Sparkles size={16} />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
              Flipbook Studio
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
