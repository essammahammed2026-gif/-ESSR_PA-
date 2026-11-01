"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  Clock,
  PlayCircle,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import type { ProjectTag } from "./types";

interface BatchActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchTag: (tag: ProjectTag) => void;
  onBatchArchive: (status: "archived" | "active") => void;
  onBatchDelete: () => void;
}

export function BatchActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBatchTag,
  onBatchArchive,
  onBatchDelete,
}: BatchActionsToolbarProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#181D27] border border-[#2E3648] rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center gap-2 sm:gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200 backdrop-blur-md">
        {/* Selection Count & Select All */}
        <div className="flex items-center space-x-2 pr-2 border-r border-[#242A38]">
          <span className="font-bold text-white flex items-center space-x-1">
            <CheckSquare size={14} className="text-cyan-400" />
            <span>{selectedCount} selected</span>
          </span>
          {selectedCount < totalCount && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
            >
              Select all {totalCount}
            </button>
          )}
        </div>

        {/* Tagging Actions */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold hidden sm:inline">
            Tag:
          </span>
          <button
            type="button"
            onClick={() => onBatchTag("pending")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold transition-colors cursor-pointer"
            title="Set status tag to Pending"
          >
            <Clock size={11} />
            <span>Pending</span>
          </button>
          <button
            type="button"
            onClick={() => onBatchTag("in-progress")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-semibold transition-colors cursor-pointer"
            title="Set status tag to In-Progress"
          >
            <PlayCircle size={11} />
            <span>In-Progress</span>
          </button>
          <button
            type="button"
            onClick={() => onBatchTag("done")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold transition-colors cursor-pointer"
            title="Mark as Done and move to Archive automatically"
          >
            <CheckCircle2 size={11} />
            <span>Done (Archive)</span>
          </button>
        </div>

        {/* Archive / Restore */}
        <div className="flex items-center space-x-1 pl-1 border-l border-[#242A38]">
          <button
            type="button"
            onClick={() => onBatchArchive("archived")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Move to Archive while preserving original tag"
          >
            <Archive size={11} />
            <span className="hidden md:inline">Archive</span>
          </button>
          <button
            type="button"
            onClick={() => onBatchArchive("active")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Restore to active production while preserving tag"
          >
            <ArchiveRestore size={11} />
            <span className="hidden md:inline">Restore</span>
          </button>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer ml-1"
          title="Delete selected projects"
        >
          <Trash2 size={13} />
        </button>

        {/* Close / Deselect */}
        <button
          type="button"
          onClick={onDeselectAll}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Deselect all"
        >
          <X size={14} />
        </button>
      </div>

      {/* Confirmation Modal for Batch Deletion */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181D27] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2 bg-red-500/15 rounded-xl border border-red-500/30">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete {selectedCount} Projects?</h4>
                <p className="text-xs text-slate-400">This will permanently delete all selected sessions and cache files.</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  onBatchDelete();
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer shadow-lg"
              >
                Delete {selectedCount} Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
