"use client";

import React from "react";
import { CheckCircle2, AlertCircle, RefreshCw, X, FileCheck, Sparkles } from "lucide-react";

export interface StudioExportProgress {
  jobId?: string | null;
  status: "idle" | "pending" | "processing" | "success" | "failed";
  progress: number;
  stage?: string;
  message?: string;
  totalPages?: number;
  currentPage?: number;
  fileSizeBytes?: number | null;
  error?: string | null;
  title?: string;
  description?: string;
}

export interface ExportProgressModalProps {
  progress: StudioExportProgress;
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Universal modal displaying streaming compilation/export progress.
 * Suitable for multi-page PDF generation, ZIP archive packaging, and background renders.
 */
export function ExportProgressModal({
  progress,
  onDismiss,
  title,
  subtitle,
}: ExportProgressModalProps) {
  if (progress.status === "idle") return null;

  const isComplete = progress.status === "success";
  const isFailed = progress.status === "failed";
  const isRunning = progress.status === "pending" || progress.status === "processing";

  const defaultTitle = isComplete
    ? "Export Complete"
    : isFailed
    ? "Export Failed"
    : (title || "Exporting Document");

  const defaultSubtitle = isComplete
    ? "Print-ready file compiled & downloaded"
    : isFailed
    ? "An error occurred during file compilation"
    : (subtitle || "Compiling document streams & prepress optimizations");

  const totalPages = progress.totalPages || 0;
  const currentPage = progress.currentPage || 0;

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
                {defaultTitle}
              </h3>
              <p className="text-[11px] text-slate-400">
                {defaultSubtitle}
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
            {totalPages > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                {currentPage > 0
                  ? `Page ${currentPage} of ${totalPages}`
                  : `${totalPages} total pages`}
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
              style={{ width: `${Math.max(5, progress.progress)}%` }}
            />
          </div>

          {/* Dynamic Status Pill */}
          <div className="bg-[#131720] border border-[#242A38] rounded-xl p-3 flex items-start space-x-3">
            <div className="mt-0.5 shrink-0">
              {isComplete ? (
                <FileCheck size={16} className="text-emerald-400" />
              ) : isFailed ? (
                <AlertCircle size={16} className="text-rose-400" />
              ) : (
                <Sparkles size={16} className="text-amber-400 animate-pulse" />
              )}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">
                {progress.message || (isComplete ? "Compilation ready" : "Processing...")}
              </p>
              {progress.fileSizeBytes && progress.fileSizeBytes > 0 && (
                <p className="text-[10px] text-slate-500 font-mono">
                  Payload size: {formatBytes(progress.fileSizeBytes)}
                </p>
              )}
              {isFailed && progress.error && (
                <p className="text-[11px] text-rose-400 font-mono break-words pt-1">
                  {progress.error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#242A38] bg-[#131720] flex items-center justify-end">
          {isRunning ? (
            <span className="text-[11px] text-slate-500 italic flex items-center space-x-1.5">
              <span>Streaming PDF assembly in background...</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                isComplete
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {isComplete ? "Done" : "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
