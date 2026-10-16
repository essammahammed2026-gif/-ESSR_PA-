"use client";

import React from "react";
import { RotateCcw, AlertTriangle, X } from "lucide-react";

export interface RestoreOriginalModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreOriginalModal({
  open,
  onConfirm,
  onCancel,
}: RestoreOriginalModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#181D27] border border-[#2E3648] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242A38]">
          <div className="flex items-center space-x-2.5 text-amber-400">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <RotateCcw size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Restore Original Document</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <div className="flex items-start space-x-3 text-amber-300/90 text-xs bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This will discard all subsequent edits (splits, crops, rotations, page ordering) and restore your document to its initial intake state.
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            You can still undo this restore using the History Journal as long as you do not apply any new modifications.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2.5 px-5 py-3.5 bg-[#131720] border-t border-[#242A38]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-md transition cursor-pointer"
          >
            Restore Original
          </button>
        </div>
      </div>
    </div>
  );
}
