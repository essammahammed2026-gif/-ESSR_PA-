"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

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
}: WorkspaceToolbarProps) {
  return (
    <div className="p-2.5 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
      {/* Left: Prev / Next Navigation with Clean Count */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
          <button
            onClick={onPrev}
            disabled={selectedIdx === 0}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
            title="Previous Page (Shortcut: [ or Left Arrow)"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-mono font-bold text-cyan-400 px-2 min-w-[56px] text-center">
            {selectedIdx + 1} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={selectedIdx === totalPages - 1}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
            title="Next Page (Shortcut: ] or Right Arrow)"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {/* Center: Clean Show Original / Show Edited Toggle Button */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onToggleOriginal}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
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
          <span className="text-[10px] font-mono opacity-60 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 ml-1">
            Space / O
          </span>
        </button>
      </div>
      {/* Right: Rotate CW / CCW, Zoom Controls, Fullscreen */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={() => onRotate(-90)}
          className="p-1.5 text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 rounded-lg border border-[#2E3648] transition-colors"
          title="Rotate 90° CCW (Shortcut: Shift+R)"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => onRotate(90)}
          className="p-1.5 text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 rounded-lg border border-[#2E3648] transition-colors"
          title="Rotate 90° CW (Shortcut: R)"
        >
          <RotateCw size={14} />
        </button>
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
  );
}
