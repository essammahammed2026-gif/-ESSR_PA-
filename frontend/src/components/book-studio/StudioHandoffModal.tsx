"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  IconImposingStudio,
  IconFlipbookStudio,
  IconContourStudio,
} from "@/components/shared/StudioIcons";
import { ExportOptions } from "@/types/book_studio";
import { StudioExportProgress } from "@/components/shared/ExportProgressModal";

export type TargetStudioId = "imposing" | "flipbook" | "contour";

interface TargetStudioDef {
  id: TargetStudioId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
}

const TARGET_STUDIOS: Record<TargetStudioId, TargetStudioDef> = {
  imposing: {
    id: "imposing",
    label: "Imposing Studio",
    subtitle: "Booklet signatures, press sheets, N-Up & step-and-repeat",
    icon: IconImposingStudio,
    accentColor: "text-amber-400",
  },
  flipbook: {
    id: "flipbook",
    label: "3D Virtual Flipbook",
    subtitle: "Interactive 3D virtual page-turning proofing",
    icon: IconFlipbookStudio,
    accentColor: "text-cyan-400",
  },
  contour: {
    id: "contour",
    label: "Contour Studio",
    subtitle: "Automatic vector die-cut boundary generation",
    icon: IconContourStudio,
    accentColor: "text-fuchsia-400",
  },
};

export interface StudioHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudio: TargetStudioId | null;
  totalPages: number;
  activePageIndex: number; // 0-based index of currently selected page
  activePageTitle?: string;
  exportProgress: StudioExportProgress;
  onExecuteHandoff: (
    target: TargetStudioId,
    options: ExportOptions & { targetPageNumber?: number }
  ) => Promise<void>;
}

export function StudioHandoffModal({
  isOpen,
  onClose,
  targetStudio,
  totalPages,
  activePageIndex,
  activePageTitle,
  exportProgress,
  onExecuteHandoff,
}: StudioHandoffModalProps) {
  const [selectedDpi, setSelectedDpi] = useState<number>(150);
  const [downloadBackup, setDownloadBackup] = useState<boolean>(false);
  const [targetPageNumber, setTargetPageNumber] = useState<number>(activePageIndex + 1);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Sync default target page number when active page changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetPageNumber(Math.min(Math.max(1, activePageIndex + 1), Math.max(1, totalPages)));
      setIsExecuting(false);
    }
  }, [isOpen, activePageIndex, totalPages]);

  // Keyboard navigation: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isExecuting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isExecuting, onClose]);

  if (!isOpen || !targetStudio) return null;

  const studioDef = TARGET_STUDIOS[targetStudio] || TARGET_STUDIOS.imposing;
  const StudioIcon = studioDef.icon;
  const isContour = targetStudio === "contour";

  const handleTransfer = async () => {
    if (isExecuting) return;
    setIsExecuting(true);

    const validPageNum = Math.min(Math.max(1, targetPageNumber), Math.max(1, totalPages));
    const targetPageIndices = isContour ? [validPageNum - 1] : undefined;

    try {
      await onExecuteHandoff(targetStudio, {
        dpi: selectedDpi,
        isHandoff: true,
        archiveSession: false,
        downloadBackup,
        targetPageIndices,
        targetPageNumber: validPageNum,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const isRunning = exportProgress.status === "processing" || exportProgress.status === "pending" || isExecuting;
  const progressPct = exportProgress.progress || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#242A38] bg-[#181D27] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-1.5 rounded-md bg-[#131720] border border-[#2E3648] ${studioDef.accentColor}`}>
              <StudioIcon size={16} />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center space-x-1.5">
                <span>Handoff to {studioDef.label}</span>
              </div>
              <p className="text-[10px] text-slate-400">{studioDef.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#252B3B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Active Edits Assurance Pill */}
          <div className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px]">
            <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-amber-300">Non-Destructive Transfer:</span> All active edits
              (spread splits, crops, deskew, cleanup masks, and bleeds) are baked into the transfer artifact. The source Book Studio project remains unchanged and active.
            </div>
          </div>

          {/* Contour Studio: Page Selection */}
          {isContour && (
            <div className="space-y-1.5 p-3 rounded-lg bg-[#181D27] border border-[#242A38]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Page to Vectorize</span>
                <span className="text-[10px] font-mono text-slate-400">
                  Total: {totalPages} {totalPages === 1 ? "page" : "pages"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={targetPageNumber}
                    disabled={isRunning}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) setTargetPageNumber(val);
                    }}
                    className="w-full bg-[#131720] border border-[#2E3648] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-fuchsia-500 font-mono disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    of {totalPages}
                  </span>
                </div>
                {activePageIndex + 1 !== targetPageNumber && (
                  <button
                    type="button"
                    onClick={() => setTargetPageNumber(activePageIndex + 1)}
                    disabled={isRunning}
                    className="px-2.5 py-1.5 bg-[#252B3B] hover:bg-[#2F374B] text-slate-200 text-[11px] font-medium rounded-md border border-[#374056] transition-colors cursor-pointer disabled:opacity-50"
                    title={`Use active page (${activePageIndex + 1})`}
                  >
                    Active (p.{activePageIndex + 1})
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Contour Studio will generate die-cut vector contours from this page.
              </p>
            </div>
          )}

          {/* Fidelity / DPI Preset */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Transfer Resolution</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDpi(150)}
                disabled={isRunning}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                  selectedDpi === 150
                    ? "bg-[#1E2536] border-amber-500/60 text-white shadow-xs"
                    : "bg-[#181D27] border-[#242A38] text-slate-400 hover:text-slate-200 hover:border-[#374056]"
                }`}
              >
                <div className="flex items-center space-x-1.5 font-semibold text-xs text-slate-200">
                  <span>Proof (150 DPI)</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">Fast</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Lightweight & ultra-fast transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDpi(300)}
                disabled={isRunning}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                  selectedDpi === 300
                    ? "bg-[#1E2536] border-amber-500/60 text-white shadow-xs"
                    : "bg-[#181D27] border-[#242A38] text-slate-400 hover:text-slate-200 hover:border-[#374056]"
                }`}
              >
                <div className="flex items-center space-x-1.5 font-semibold text-xs text-slate-200">
                  <span>Press (300 DPI)</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-700 text-slate-300">Full</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">High-fidelity prepress quality</span>
              </button>
            </div>
          </div>

          {/* Local Backup Checkbox */}
          <div className="pt-1">
            <label className="flex items-center space-x-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={downloadBackup}
                disabled={isRunning}
                onChange={(e) => setDownloadBackup(e.target.checked)}
                className="w-4 h-4 rounded border-[#2E3648] bg-[#181D27] text-amber-500 focus:ring-0 focus:outline-none cursor-pointer disabled:opacity-50"
              />
              <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                Download a local backup copy to disk before transfer
              </span>
            </label>
          </div>

          {/* Streaming Progress Bar (when running) */}
          {isRunning && (
            <div className="space-y-1.5 pt-2 border-t border-[#242A38] animate-in fade-in">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 flex items-center space-x-1.5">
                  <Loader2 size={12} className="animate-spin text-amber-400" />
                  <span>{exportProgress.message || "Synthesizing document modifications..."}</span>
                </span>
                <span className="font-mono text-amber-400 font-semibold">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#181D27] rounded-full overflow-hidden border border-[#242A38]">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(4, progressPct)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-[#242A38] bg-[#181D27] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-3.5 py-1.5 rounded-lg border border-[#2E3648] bg-[#131720] text-slate-300 hover:text-white hover:bg-[#1E2536] transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={isRunning}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Preparing Transfer...</span>
              </>
            ) : (
              <>
                <span>Transfer to {studioDef.label}</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
