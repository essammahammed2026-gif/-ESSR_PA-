"use client";

import React, { useState } from "react";
import { 
  Upload, 
  Trash2, 
  File, 
  FolderOpen, 
  MoreVertical, 
  Loader2, 
  RotateCw, 
  RotateCcw, 
  Copy, 
  Eye, 
  EyeOff, 
  GripVertical 
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { ImposingItem, ImposingPage } from "@/types/prepress";

interface LeftAssetPanelProps {
  items: ImposingItem[];
  pages: ImposingPage[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  rotatePage: (id: string, dir: "cw" | "ccw") => void;
  toggleDeletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  clearAllPages: () => void;
}

export function LeftAssetPanel({ 
  items, 
  pages, 
  handleFileUpload, 
  isUploading, 
  reorderPages, 
  rotatePage, 
  toggleDeletePage, 
  duplicatePage, 
  clearAllPages 
}: LeftAssetPanelProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const activeCount = pages.filter(p => !p.is_deleted).length;
  const deletedCount = pages.length - activeCount;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    const sourceIdxStr = e.dataTransfer.getData("text/plain");
    const sourceIdx = parseInt(sourceIdxStr, 10);
    if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      reorderPages(sourceIdx, targetIdx);
    }
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm select-none">
      {/* File Manager Header Area */}
      <div className="p-3 border-b border-[#242A38] bg-[#131720]">
        <div className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm truncate pr-2">
            <FolderOpen size={16} className="text-blue-400 shrink-0" />
            <span className="truncate">{items && items.length > 0 ? items[0].name : "File Manager"}</span>
          </div>
          <MoreVertical size={14} className="text-slate-500 group-hover:text-white shrink-0" />
        </div>
      </div>
      
      <div className="p-2 border-b border-[#242A38] bg-[#1A202C] flex items-center justify-between">
        <div className="bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded border border-blue-500/30 text-xs font-semibold flex items-center space-x-1.5">
          <File size={13} />
          <span>Page Deck</span>
        </div>
        {pages.length > 0 && (
          <span className="text-[11px] font-mono text-slate-400">
            {activeCount} {activeCount === 1 ? "page" : "pages"}
            {deletedCount > 0 && <span className="text-rose-400 ml-1">({deletedCount} excluded)</span>}
          </span>
        )}
      </div>

      {/* Pages Grid Container */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Pages Deck
          </span>
          {pages.length > 0 && (
            <span className="text-[10px] text-slate-500">
              Drag to reorder
            </span>
          )}
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-[#2E3648] rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs mb-1 font-medium">No pages loaded</div>
            <div className="text-slate-500 text-[11px] mb-3">Upload a PDF or images to begin imposition</div>
            <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm">
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              <span>Import Artwork</span>
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
          <div className="grid grid-cols-2 gap-2.5">
            {pages.map((pg, i) => {
              const isOver = dragOverIdx === i;
              const isSelfDragging = draggedIdx === i;
              const thumbSrc = pg.thumb_url.startsWith("http") 
                ? pg.thumb_url 
                : `${API_BASE_URL}${pg.thumb_url.startsWith("/") ? "" : "/"}${pg.thumb_url}`;

              return (
                <div 
                  key={pg.id}
                  draggable={!pg.is_deleted}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`group relative flex flex-col items-center rounded-lg border transition-all duration-150 ${
                    isSelfDragging 
                      ? "opacity-30 border-dashed border-blue-500 scale-95" 
                      : isOver 
                        ? "border-blue-400 ring-2 ring-blue-500/30 scale-[1.02]" 
                        : pg.is_deleted
                          ? "border-rose-900/40 bg-[#12151c]/60 opacity-50"
                          : "border-[#272E3F] hover:border-blue-500/60 bg-[#141822]"
                  }`}
                >
                  {/* Thumbnail Card */}
                  <div className="w-full aspect-[1/1.35] rounded-t-lg bg-[#0F1219] flex items-center justify-center relative overflow-hidden p-1">
                    {/* Page Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbSrc}
                      alt={`Page ${i + 1}`}
                      className="max-h-full max-w-full object-contain rounded-sm transition-transform duration-200 pointer-events-none drop-shadow-sm"
                      style={{ transform: `rotate(${pg.rotation}deg)` }}
                      onError={(e) => {
                        // Fallback styling if image fails
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />

                    {/* Drag Handle Icon on Hover */}
                    {!pg.is_deleted && (
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded px-1 py-0.5 text-white/80 flex items-center pointer-events-none">
                        <GripVertical size={11} />
                      </div>
                    )}

                    {/* Excluded Badge Overlay */}
                    {pg.is_deleted && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-1 text-center">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                          Excluded
                        </span>
                        <button
                          onClick={() => toggleDeletePage(pg.id)}
                          className="mt-1 text-[9px] text-blue-300 hover:text-white underline cursor-pointer"
                        >
                          Restore
                        </button>
                      </div>
                    )}

                    {/* Hover Toolbar (Top Right) */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-slate-900/90 rounded p-0.5 border border-slate-700/60 backdrop-blur-sm shadow-md">
                      {/* Rotate CW */}
                      <button
                        title="Rotate 90° CW"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(pg.id, "cw");
                        }}
                        className="p-1 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                      >
                        <RotateCw size={11} />
                      </button>

                      {/* Rotate CCW */}
                      <button
                        title="Rotate 90° CCW"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(pg.id, "ccw");
                        }}
                        className="p-1 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                      >
                        <RotateCcw size={11} />
                      </button>

                      {/* Duplicate */}
                      <button
                        title="Duplicate Page"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePage(pg.id);
                        }}
                        className="p-1 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                      >
                        <Copy size={11} />
                      </button>

                      {/* Exclude / Include */}
                      <button
                        title={pg.is_deleted ? "Include Page" : "Exclude Page"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDeletePage(pg.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          pg.is_deleted 
                            ? "text-emerald-400 hover:bg-emerald-500/20" 
                            : "text-rose-400 hover:bg-rose-500/20"
                        }`}
                      >
                        {pg.is_deleted ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                    </div>
                  </div>

                  {/* Page Footer Label & Meta */}
                  <div className="w-full px-1.5 py-1 border-t border-[#1F2533] bg-[#10141D] flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-300 truncate">
                      Pg {i + 1}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {pg.rotation !== 0 ? `${pg.rotation}°` : `${Math.round(pg.w)}×${Math.round(pg.h)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Actions Bar */}
      <div className="p-2 border-t border-[#242A38] bg-[#131720] flex items-center justify-between">
        <label 
          className="cursor-pointer p-1.5 hover:bg-[#232936] rounded text-slate-400 hover:text-white transition-colors flex items-center space-x-1" 
          title="Import Additional Files"
        >
          <Upload size={15} />
          <span className="text-xs font-medium">Add Files</span>
          <input 
            type="file" 
            multiple
            accept="application/pdf,image/*" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
        </label>
        
        {pages.length > 0 && (
          <button 
            className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded text-slate-400 transition-colors flex items-center space-x-1" 
            title="Clear All Pages"
            onClick={clearAllPages}
          >
            <Trash2 size={15} />
            <span className="text-xs font-medium">Clear All</span>
          </button>
        )}
      </div>
    </div>
  );
}
