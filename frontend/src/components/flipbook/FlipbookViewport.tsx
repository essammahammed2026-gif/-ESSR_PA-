"use client";

import React from "react";
import { BookOpen, Loader2, Layers } from "lucide-react";

export interface FlipbookViewportProps {
  error: string | null;
  isGenerating: boolean;
  statusMsg: string;
  progress: number;
  resultUrl: string | null;
  isUpdating: boolean;
}

export function FlipbookViewport(p: FlipbookViewportProps) {
  return (
    <div className="lg:col-span-2">
      {p.error && (
        <div className="mb-4 p-3.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">
          {p.error}
        </div>
      )}

      {p.isGenerating && (
        <div className="bg-[#181D27] p-8 rounded-xl border border-[#242A38] flex flex-col items-center justify-center space-y-4 min-h-[460px]">
          <Loader2 className="animate-spin text-indigo-400" size={40} />
          <div className="text-sm font-semibold text-white">{p.statusMsg}</div>
          <div className="w-full max-w-sm bg-[#131720] rounded-full h-2 border border-[#2E3648] overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 font-mono">{p.progress}% Complete</div>
        </div>
      )}

      {!p.isGenerating && !p.resultUrl && (
        <div className="bg-[#181D27] p-8 rounded-xl border border-[#242A38] flex flex-col items-center justify-center min-h-[500px] text-slate-400">
          <BookOpen size={48} className="mb-3 opacity-30 text-indigo-400" />
          <p className="text-sm font-medium text-slate-300">Upload PDF to synthesize an interactive 3D proof</p>
          <p className="text-xs text-slate-400 mt-1">Simulates real paper turning physics & binding spine</p>
        </div>
      )}

      {!p.isGenerating && p.resultUrl && (
        <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col min-h-[720px] h-[calc(100vh-140px)] overflow-hidden relative shadow-lg">
          <div className="p-2.5 border-b border-[#242A38] flex justify-between items-center bg-[#141822]">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Layers size={14} className="text-indigo-400" />
                <span>Live 3D Proofing Stage</span>
              </span>
              {p.isUpdating && (
                <span className="text-xs text-indigo-400 flex items-center font-medium">
                  <Loader2 className="animate-spin mr-1.5" size={13} />
                  Updating Model...
                </span>
              )}
            </div>
          </div>
          <iframe
            src={p.resultUrl}
            className="w-full flex-1 border-none bg-[#0B0D12]"
            allowFullScreen
            title="Flipbook Preview"
          />
        </div>
      )}
    </div>
  );
}
