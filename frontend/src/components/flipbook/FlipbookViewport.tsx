"use client";

import React from "react";
import { BookOpen, Loader2 } from "lucide-react";

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
    <div className="flex-1 flex flex-col h-full bg-[#14171F] overflow-hidden relative">
      {p.isGenerating && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
          <Loader2 className="animate-spin text-blue-400" size={38} />
          <div className="text-sm font-semibold text-white">{p.statusMsg}</div>
          <div className="w-full max-w-sm bg-[#11141B] rounded-full h-1.5 border border-[#242A38] overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 font-mono">{p.progress}% Complete</div>
        </div>
      )}

      {!p.isGenerating && !p.resultUrl && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 select-none">
          <BookOpen size={44} className="mb-3 opacity-30 text-blue-400" />
          <p className="text-sm font-medium text-slate-300">Upload PDF to synthesize an interactive 3D proof</p>
          <p className="text-xs text-slate-500 mt-1">Simulates real paper turning physics & binding spine</p>
        </div>
      )}

      {!p.isGenerating && p.resultUrl && (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {p.isUpdating && (
            <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-[#11141B]/90 border border-[#242A38] text-[11px] text-blue-400 flex items-center font-medium shadow-lg">
              <Loader2 className="animate-spin mr-1.5" size={12} />
              Updating Model...
            </div>
          )}
          <iframe
            src={p.resultUrl}
            className="w-full flex-1 border-none bg-[#14171F]"
            allowFullScreen
            title="Flipbook Preview"
          />
        </div>
      )}
    </div>
  );
}
