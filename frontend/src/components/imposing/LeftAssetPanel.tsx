"use client";

import React from "react";
import { Upload, Trash2, File, FolderOpen, MoreVertical, Loader2 } from "lucide-react";
import { ImposingItem } from "@/types/prepress";

interface LeftAssetPanelProps {
  items: ImposingItem[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  removeItem: (idx: number) => void;
}

export function LeftAssetPanel({ items, handleFileUpload, isUploading, removeItem }: LeftAssetPanelProps) {
  // We'll simulate individual pages based on the uploaded items
  const totalPages = items.reduce((sum, item) => sum + (item.page_count || 1), 0);
  const fakePages = Array.from({ length: totalPages }, (_, i) => `Pg ${i + 1}`);

  return (
    <div className="flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm">
      {/* File Manager Dropdown Area */}
      <div className="p-3 border-b border-[#242A38] bg-[#131720]">
        <div className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
            <FolderOpen size={16} className="text-blue-400" />
            <span>File Manager</span>
          </div>
          <MoreVertical size={14} className="text-slate-500 group-hover:text-white" />
        </div>
      </div>
      
      <div className="p-2 border-b border-[#242A38] bg-[#1A202C]">
         <div className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded border border-blue-500/30 text-xs font-semibold flex items-center space-x-2">
            <File size={14} />
            <span>Page Layout</span>
         </div>
         <div className="px-3 py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer transition-colors mt-1 flex items-center space-x-2">
            <File size={14} />
            <span>Templates</span>
         </div>
      </div>

      {/* Imported Files / Pages Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Imported Files
          </span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 border border-dashed border-[#2E3648] rounded-lg p-4 text-center">
             <div className="text-slate-500 mb-2">No files imported</div>
             <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5">
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              <span>Import PDF</span>
              <input 
                type="file" 
                multiple
                accept="application/pdf,image/*" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {fakePages.map((pg, i) => (
              <div key={i} className="group relative flex flex-col items-center">
                <div className="w-full aspect-[1/1.4] bg-white rounded border border-[#2E3648] group-hover:border-blue-400 flex items-center justify-center shadow-sm relative overflow-hidden transition-colors cursor-pointer">
                  {/* Mock thumbnail content */}
                  <div className="absolute inset-2 bg-slate-100 flex flex-col">
                    <div className="h-1/3 bg-blue-100 mb-1" />
                    <div className="h-1/3 bg-rose-100 mb-1" />
                    <div className="h-1/3 bg-emerald-100" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1.5 font-medium">{pg}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions Bar */}
      <div className="p-2 border-t border-[#242A38] bg-[#131720] flex items-center justify-between">
        <label className="cursor-pointer p-1.5 hover:bg-[#232936] rounded text-slate-400 hover:text-white transition-colors" title="Add File">
          <Upload size={16} />
          <input 
            type="file" 
            multiple
            accept="application/pdf,image/*" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
        </label>
        
        <button 
          className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded text-slate-400 transition-colors" 
          title="Delete All"
          onClick={() => {
             // We can just pop them all, or loop
             for(let i=items.length-1; i>=0; i--) removeItem(i);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
