"use client";

import React from "react";
import {
  Undo2,
  Redo2,
  PanelRight,
  Columns2,
} from "lucide-react";
import { IconHandPan } from "@/components/shared/StudioIcons";

export interface WorkspaceToolbarProps {
  isPanMode?: boolean;
  onTogglePanMode?: () => void;
  isSplitCurtain?: boolean;
  onToggleSplitCurtain?: () => void;
  isDeckOpen?: boolean;
  onToggleDeck?: () => void;
  totalPages?: number;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  shortcutLabels?: Record<string, string>;
}

export function WorkspaceToolbar({
  isPanMode = false,
  onTogglePanMode,
  isSplitCurtain = false,
  onToggleSplitCurtain,
  isDeckOpen = false,
  onToggleDeck,
  totalPages = 0,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  shortcutLabels = {},
}: WorkspaceToolbarProps) {
  return (
    <div className="h-10 px-3 border-b border-[#1E232E] bg-[#11141B] flex items-center justify-center space-x-2 relative z-40 shrink-0">
      {/* Hand / Pan Tool */}
      {onTogglePanMode && (
        <button
          type="button"
          onClick={onTogglePanMode}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isPanMode
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-[#1C212C]"
          }`}
          title={`Hand / Pan Tool (${shortcutLabels.pan || "H"} or Middle-Click Drag)`}
        >
          <IconHandPan size={15} />
        </button>
      )}

      {/* Split Curtain Compare Toggle */}
      {onToggleSplitCurtain && (
        <button
          type="button"
          onClick={onToggleSplitCurtain}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isSplitCurtain
              ? "bg-[#252B3B] text-white"
              : "text-slate-400 hover:text-white hover:bg-[#1C212C]"
          }`}
          title="Split Curtain: Compare Raw Scan vs. Processed with interactive divider"
        >
          <Columns2 size={15} />
        </button>
      )}

      <div className="h-4 w-px bg-[#232834]" />

      {/* Undo / Redo */}
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-md hover:bg-[#1C212C] disabled:opacity-30 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={`Undo (${shortcutLabels.undo || "Ctrl+Z"})`}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-md hover:bg-[#1C212C] disabled:opacity-30 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={`Redo (${shortcutLabels.redo || "Ctrl+Y"})`}
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className="h-4 w-px bg-[#232834]" />

      {/* Page Deck Toggle (Opens between Preview Panel and Tools Panel) */}
      {onToggleDeck && (
        <button
          type="button"
          onClick={onToggleDeck}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            isDeckOpen
              ? "bg-[#252B3B] text-white"
              : "text-slate-400 hover:text-white hover:bg-[#1C212C]"
          }`}
          title={isDeckOpen ? "Hide Page Deck" : "Show Page Deck"}
        >
          <PanelRight size={14} />
          <span>Page Deck</span>
          {totalPages > 0 && (
            <span className="text-[10px] font-mono text-slate-400">({totalPages})</span>
          )}
        </button>
      )}
    </div>
  );
}
