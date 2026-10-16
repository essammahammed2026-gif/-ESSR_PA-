"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  History,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { HistoryPopover } from "./HistoryPopover";
import { RestoreOriginalModal } from "./RestoreOriginalModal";
import { RotateDropdown } from "./RotateDropdown";
import type { HistoryEntry } from "@/hooks/useBookHistory";

export interface WorkspaceToolbarProps {
  selectedIdx: number;
  totalPages: number;
  isViewingOriginal: boolean;
  zoom: number;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleOriginal: () => void;
  onRotate: (delta: number) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  onToggleFullscreen: () => void;
  onDelete: () => void;
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
  zoom,
  isFullscreen,
  onPrev,
  onNext,
  onToggleOriginal,
  onRotate,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  onToggleFullscreen,
  onDelete,
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
      <div className="p-2.5 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
        {/* Left: Prev / Next Navigation + History Journal Controls */}
        <div className="flex items-center space-x-2">
          {/* Deck Navigation */}
          <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
            <button
              onClick={onPrev}
              disabled={selectedIdx === 0}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
              title={`Previous Page (${shortcutLabels.prev_page || "["})`}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono font-bold text-cyan-400 px-2 min-w-[56px] text-center">
              {selectedIdx + 1} / {totalPages}
            </span>
            <button
              onClick={onNext}
              disabled={selectedIdx === totalPages - 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors cursor-pointer"
              title={`Next Page (${shortcutLabels.next_page || "]"})`}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="h-5 w-px bg-[#242A38]" />

          {/* Unified Undo / Redo / History Journal */}
          <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={`Undo (${shortcutLabels.undo || "Ctrl+Z"})`}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={`Redo (${shortcutLabels.redo || "Ctrl+Y"})`}
            >
              <Redo2 size={15} />
            </button>

            {/* History Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((p) => !p)}
                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  historyOpen
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
                title="Open History Journal"
              >
                <History size={14} className="text-amber-400" />
                <span className="text-[11px] font-mono font-bold text-amber-400">
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
                className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-30 cursor-pointer"
                title={`Restore Original Document (${shortcutLabels.restore_original || "Ctrl+Shift+R"})`}
              >
                <RotateCcw size={12} className="text-amber-400" />
                <span>Original</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Clean Show Original / Show Edited Toggle Button */}
        <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onToggleOriginal}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm cursor-pointer ${
            isViewingOriginal
              ? "bg-[#181D27] text-slate-200 border-[#2E3648] hover:bg-slate-800"
              : "bg-cyan-950/70 text-cyan-300 border-cyan-600/60 ring-1 ring-cyan-500/30"
          }`}
          title="Toggle between Original Scan and Cleaned Print View (Shortcut: Press O or Hold Space)"
        >
          {isViewingOriginal ? (
            <>
              <Sparkles size={14} className="text-cyan-400" />
              <span>Show Edited</span>
            </>
          ) : (
            <>
              <Eye size={14} className="text-cyan-400" />
              <span>Show Original</span>
            </>
          )}
        </button>
      </div>
      {/* Right: Rotate CW / CCW / 180 Dropdown, Zoom Controls, Fullscreen */}
      <div className="flex items-center space-x-1.5">
        {/* Unified Rotate Dropdown */}
        <RotateDropdown onRotate={onRotate} shortcutLabel={shortcutLabels.rotate} />

        <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
          <button
            onClick={onZoomOut}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={onZoomReset}
            className="text-[10px] font-mono text-slate-400 px-1 min-w-[38px] text-center hover:text-cyan-400 transition-colors"
            title="Click or press Ctrl+0 to reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
        </div>
        <button
          onClick={onToggleFullscreen}
          className={`p-1.5 rounded-lg border transition-colors ${
            isFullscreen
              ? "bg-cyan-600 text-white border-cyan-500"
              : "text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 border-[#2E3648]"
          }`}
          title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#181D27] hover:bg-rose-950/40 rounded-lg border border-[#2E3648] hover:border-rose-900/40 transition-colors"
          title="Delete this page"
        >
          <Trash2 size={14} />
        </button>
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
