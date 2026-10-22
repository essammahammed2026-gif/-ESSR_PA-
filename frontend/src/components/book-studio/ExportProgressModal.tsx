"use client";

import React from "react";
import { CheckCircle2, AlertCircle, RefreshCw, X, FileCheck, Sparkles } from "lucide-react";
import { ExportJobProgress } from "@/types/book_studio";

interface ExportProgressModalProps {
  progress: ExportJobProgress;
  onDismiss: () => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ExportProgressModal({ progress, onDismiss }: ExportProgressModalProps) {
  if (progress.status === "idle") return null;

  const isComplete = progress.status === "success";
  const isFailed = progress.status === "failed";
  const isRunning = progress.status === "pending" || progress.status === "processing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-lg ${
                isComplete
                  ? "bg-emerald-500/15 text-emerald-400"
                  : isFailed
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 size={18} />
              ) : isFailed ? (
                <AlertCircle size={18} />
              ) : (
                <RefreshCw size={18} className="animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {isComplete
                  ? "Export Complete"
                  : isFailed
                  ? "Export Failed"
                  : "Exporting Document"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isComplete
                  ? "Print-ready PDF compiled & downloaded"
                  : isFailed
                  ? "An error occurred during PDF compilation"
                  : "Optimizing color, synthesized bleed & PDF stream compression"}
              </p>
            </div>
          </div>
          {(isComplete || isFailed) && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Progress Percentage & Status */}
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {progress.progress}%
            </span>
            {progress.totalPages > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                {progress.currentPage > 0
                  ? `Page ${progress.currentPage} of ${progress.totalPages}`
                  : `${progress.totalPages} total pages`}
              </span>
            )}
          </div>

          {/* Progress Track */}
          <div className="w-full bg-[#131720] border border-[#242A38] h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isComplete
                  ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  : isFailed
                  ? "bg-rose-500"
                  : "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
              }`}
              style={{ width: `${Math.max(3, Math.min(100, progress.progress))}%` }}
            />
          </div>

          {/* Real-time Status Message */}
          <div className="bg-[#131720] border border-[#242A38] rounded-lg px-3 py-2.5">
            <div className="text-xs text-slate-200 font-medium flex items-center space-x-2 truncate">
              {isRunning && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />}
              <span className="truncate">{progress.message || "Working..."}</span>
            </div>
          </div>

          {/* Prepress Optimizations & File Size Indicator */}
          {isComplete && progress.fileSizeBytes ? (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-3 space-y-1.5 text-xs text-emerald-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center space-x-1.5">
                  <FileCheck size={14} className="text-emerald-400 shrink-0" />
                  <span>Output File Size</span>
                </span>
                <span className="font-mono font-bold text-white bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  {formatBytes(progress.fileSizeBytes)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Optimized with PyMuPDF stream deflation, DeviceGray / PNG encoding, and clean trim marks.
              </p>
            </div>
          ) : isRunning ? (
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 px-1">
              <Sparkles size={12} className="text-amber-400 shrink-0" />
              <span>Optimizing streams & discarding scanner noise to minimize file weight</span>
            </div>
          ) : null}

          {/* Error Message if Failed */}
          {isFailed && progress.error && (
            <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-3 text-xs text-rose-300">
              <p className="font-semibold mb-0.5">Export Error</p>
              <p className="text-[11px] text-rose-400 break-words">{progress.error}</p>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-1 flex items-center justify-end space-x-2">
            {isComplete ? (
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            ) : isFailed ? (
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
