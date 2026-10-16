"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  Undo2,
  Redo2,
  History,
} from "lucide-react";
import { IconCompareScan } from "@/components/shared/StudioIcons";
import { HistoryPopover } from "./HistoryPopover";
import { RestoreOriginalModal } from "./RestoreOriginalModal";
import { RotateDropdown } from "./RotateDropdown";
import type { HistoryEntry } from "@/hooks/useBookHistory";

export interface WorkspaceToolbarProps {
  selectedIdx: number;
  totalPages: number;
  isViewingOriginal: boolean;
  showSplitSizes: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleOriginal: () => void;
  onToggleSplitSizes: () => void;
  onRotate: (delta: number) => void;
  // History & Safety controls
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onRestoreOriginal?: () => void;
  history?: HistoryEntry[];
  currentHistoryIndex?: number;
  onSelectHistoryStep?: (index: number) => void;
  shortcutLabels?: Record<string, string>;
}

export function WorkspaceToolbar({
  selectedIdx,
  totalPages,
  isViewingOriginal,
  showSplitSizes,
  onPrev,
  onNext,
  onToggleOriginal,
  onToggleSplitSizes,
  onRotate,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  onRestoreOriginal,
  history = [],
  currentHistoryIndex = 0,
  onSelectHistoryStep,
  shortcutLabels = {},
}: WorkspaceToolbarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  return (
    <>
      <div className="px-2.5 py-1.5 border-b border-[#242A38] bg-[#131720] flex items-center justify-between relative z-40">
        {/* Left: Prev / Next Navigation + History Journal Controls */}
        <div className="flex items-center space-x-1.5">
          {/* Deck Navigation */}
          <div className="flex items-center space-x-0.5 bg-[#181D27] p-0.5 rounded-lg border border-[#242A38]">
            <button
              onClick={onPrev}
              disabled={selectedIdx === 0}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
              title={`Previous Page (${shortcutLabels.prev_page || "["})`}
            >
              <ChevronLeft size={15} />
            </button>
            <span
              className="text-[11px] font-mono font-bold px-1.5 min-w-[48px] text-center"
              style={{ color: "var(--app-accent, #f59e0b)" }}
            >
              {selectedIdx + 1} / {totalPages}
            </span>
            <button
              onClick={onNext}
              disabled={selectedIdx === totalPages - 1}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
              title={`Next Page (${shortcutLabels.next_page || "]"})`}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="h-4 w-px bg-[#242A38]" />

          {/* Unified Undo / Redo / History Journal */}
          <div className="flex items-center space-x-0.5 bg-[#181D27] p-0.5 rounded-lg border border-[#242A38]">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={`Undo (${shortcutLabels.undo || "Ctrl+Z"})`}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={`Redo (${shortcutLabels.redo || "Ctrl+Y"})`}
            >
              <Redo2 size={14} />
            </button>

            {/* History Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((p) => !p)}
                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  historyOpen
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
                title="Open History Journal"
              >
                <History size={13} style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span className="text-[10px] font-mono font-bold" style={{ color: "var(--app-accent, #f59e0b)" }}>
                  {history.length > 0 ? history.length : 1}
                </span>
              </button>

              <HistoryPopover
                history={history}
                currentIndex={currentHistoryIndex}
                onSelectStep={(idx) => {
                  if (onSelectHistoryStep) onSelectHistoryStep(idx);
                  setHistoryOpen(false);
                }}
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
              />
            </div>

            {/* Restore Original Button */}
            {onRestoreOriginal && (
              <button
                type="button"
                onClick={() => setRestoreModalOpen(true)}
                disabled={currentHistoryIndex === 0 && history.length <= 1}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                title={`Restore Original Document (${shortcutLabels.restore_original || "Ctrl+Shift+R"})`}
              >
                <RotateCcw size={11} style={{ color: "var(--app-accent, #f59e0b)" }} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Show Original / Show Edited Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onToggleOriginal}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isViewingOriginal
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-[#181D27] text-slate-300 border-[#242A38] hover:text-white hover:border-slate-600"
            }`}
            title={`Toggle Original vs. Processed View (Shortcut: ${shortcutLabels.toggle_original || "O"} or Hold Space)`}
          >
            <IconCompareScan size={13} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>{isViewingOriginal ? "Original" : "Compare"}</span>
          </button>
        </div>

        {/* Right: Eye Toggle (Show/Hide Split Sizes on Preview) & Rotate Dropdown */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={onToggleSplitSizes}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showSplitSizes
                ? "bg-[#181D27] text-white border-[#2E3648] hover:bg-slate-800"
                : "bg-[#131720] text-slate-500 border-[#242A38] hover:text-slate-300"
            }`}
            style={showSplitSizes ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            title={showSplitSizes ? "Hide split dimensions on preview" : "Show split dimensions on preview"}
          >
            {showSplitSizes ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          <RotateDropdown onRotate={onRotate} shortcutLabel={shortcutLabels.rotate} />
        </div>
      </div>

      {/* Restore Original Confirmation Modal */}
      <RestoreOriginalModal
        open={restoreModalOpen}
        onConfirm={() => {
          if (onRestoreOriginal) onRestoreOriginal();
          setRestoreModalOpen(false);
        }}
        onCancel={() => setRestoreModalOpen(false)}
      />
    </>
  );
}
