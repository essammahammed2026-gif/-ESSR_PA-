"use client";

import React, { useRef, useState } from "react";
import { 
  FileText, 
  Layers, 
  BookOpen, 
  FileCheck, 
  RotateCw, 
  Trash2, 
  Upload, 
  Sparkles, 
  RefreshCw,
  FolderOpen,
  GripVertical,
  ChevronLeft
} from "lucide-react";
import { BookIntakeMode, BookStudioPage } from "@/types/book_studio";

interface BookLeftPanelProps {
  intakeMode: BookIntakeMode;
  setIntakeMode: (mode: BookIntakeMode) => void;
  fileSingle: File | null;
  setFileSingle: (file: File | null) => void;
  fileOdds: File | null;
  setFileOdds: (file: File | null) => void;
  fileEvens: File | null;
  setFileEvens: (file: File | null) => void;
  oddsOrder: "forward" | "reverse";
  setOddsOrder: (order: "forward" | "reverse") => void;
  evensOrder: "reverse" | "forward";
  setEvensOrder: (order: "reverse" | "forward") => void;
  splitPos: number;
  setSplitPos: (pos: number) => void;
  sessionId: string | null;
  pages: BookStudioPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string) => void;
  isInitializing: boolean;
  initSession: () => void;
  resetJob: () => void;
  rotatePage: (pageId: string, delta?: number) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIdx: number, toIdx: number) => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  onCollapse?: () => void;
}

export function BookLeftPanel({
  intakeMode,
  setIntakeMode,
  fileSingle,
  setFileSingle,
  fileOdds,
  setFileOdds,
  fileEvens,
  setFileEvens,
  oddsOrder,
  setOddsOrder,
  evensOrder,
  setEvensOrder,
  sessionId,
  pages,
  selectedPageId,
  setSelectedPageId,
  isInitializing,
  initSession,
  resetJob,
  rotatePage,
  deletePage,
  reorderPages,
  getThumbnailUrl,
  onCollapse,
}: BookLeftPanelProps) {
  const singleInputRef = useRef<HTMLInputElement>(null);
  const oddsInputRef = useRef<HTMLInputElement>(null);
  const evensInputRef = useRef<HTMLInputElement>(null);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const intakeModes: { id: BookIntakeMode; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      id: "single_page",
      title: "Single Pages",
      subtitle: "1 page per scan sheet (Most Common)",
      icon: <FileText size={16} className="text-cyan-400" />,
    },
    {
      id: "spread",
      title: "2-Page Spreads",
      subtitle: "2-Up spreads split into 1-Up pages",
      icon: <BookOpen size={16} className="text-cyan-400" />,
    },
    {
      id: "dual_pass",
      title: "Dual Pass (Odds/Evens)",
      subtitle: "Duplex scan batches collated",
      icon: <Layers size={16} className="text-cyan-400" />,
    },
    {
      id: "digital",
      title: "Digital / Original",
      subtitle: "Born-digital or vector PDF book",
      icon: <FileCheck size={16} className="text-cyan-400" />,
    },
  ];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      reorderPages(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm select-none">
      {/* Panel Header */}
      <div className="p-3 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm truncate">
          <FolderOpen size={16} className="text-cyan-400 shrink-0" />
          <span className="truncate">{sessionId ? "Pages Deck" : "Document Intake"}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {sessionId && (
            <button
              onClick={resetJob}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-[#2E3648] transition-colors"
            >
              New Job
            </button>
          )}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Collapse Left Panel"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>
      </div>

      {!sessionId ? (
        /* Intake & File Upload Screen */
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Preset / Mode Selection */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              1. Select Intake Type
            </span>
            <div className="space-y-1.5">
              {intakeModes.map((m) => {
                const isSelected = intakeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setIntakeMode(m.id)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-start space-x-2.5 ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500/30 text-white"
                        : "border-[#242A38] bg-[#131720]/50 hover:bg-[#131720] text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{m.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{m.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{m.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Dropzones */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              2. Upload Source PDF
            </span>

            {intakeMode === "dual_pass" ? (
              /* Dual Pass Upload (Odds + Evens) */
              <div className="space-y-2.5">
                {/* Odds Upload */}
                <div
                  onClick={() => oddsInputRef.current?.click()}
                  className={`p-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${
                    fileOdds
                      ? "border-cyan-500/60 bg-cyan-950/20"
                      : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"
                  }`}
                >
                  <input
                    ref={oddsInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFileOdds(e.target.files?.[0] || null)}
                  />
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {fileOdds ? fileOdds.name : "Select Odds PDF (Pages 1, 3, 5...)"}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Click to choose file</div>
                </div>

                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-400">Odds Order:</span>
                  <select
                    value={oddsOrder}
                    onChange={(e) => setOddsOrder(e.target.value as "forward" | "reverse")}
                    className="bg-[#131720] border border-[#2E3648] text-slate-200 rounded px-2 py-0.5 text-[11px]"
                  >
                    <option value="forward">Forward (1, 3, 5)</option>
                    <option value="reverse">Reverse (5, 3, 1)</option>
                  </select>
                </div>

                {/* Evens Upload */}
                <div
                  onClick={() => evensInputRef.current?.click()}
                  className={`p-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${
                    fileEvens
                      ? "border-cyan-500/60 bg-cyan-950/20"
                      : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"
                  }`}
                >
                  <input
                    ref={evensInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFileEvens(e.target.files?.[0] || null)}
                  />
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {fileEvens ? fileEvens.name : "Select Evens PDF (Pages 6, 4, 2...)"}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Click to choose file</div>
                </div>

                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-400">Evens Order:</span>
                  <select
                    value={evensOrder}
                    onChange={(e) => setEvensOrder(e.target.value as "reverse" | "forward")}
                    className="bg-[#131720] border border-[#2E3648] text-slate-200 rounded px-2 py-0.5 text-[11px]"
                  >
                    <option value="reverse">Reverse (...6, 4, 2) [ADF]</option>
                    <option value="forward">Forward (2, 4, 6...)</option>
                  </select>
                </div>
              </div>
            ) : (
              /* Single PDF Dropzone */
              <div
                onClick={() => singleInputRef.current?.click()}
                className={`p-5 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${
                  fileSingle
                    ? "border-cyan-500/60 bg-cyan-950/20"
                    : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"
                }`}
              >
                <input
                  ref={singleInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFileSingle(e.target.files?.[0] || null)}
                />
                <Upload size={24} className="mx-auto text-cyan-400 mb-2" />
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {fileSingle ? fileSingle.name : "Drop or Browse Book PDF"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {intakeMode === "spread" 
                    ? "2-page spreads will be split into individual pages" 
                    : "Single-page sequence will be loaded directly"}
                </div>
              </div>
            )}
          </div>

          {/* Launch Ingestion Button */}
          <div className="pt-2">
            <button
              onClick={initSession}
              disabled={isInitializing || (intakeMode === "dual_pass" ? (!fileOdds || !fileEvens) : !fileSingle)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  <span>Loading & Splitting...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Open Book in Studio</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Loaded Deck Thumbnail Gallery (Left Panel) */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2 border-b border-[#242A38] bg-[#1A202C] flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Pages ({pages.length})</span>
            <span className="text-[10px] text-slate-500">Drag to reorder</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-2">
              {pages.map((p, idx) => {
                const isSelected = p.id === selectedPageId;
                const isDragTarget = dragOverIdx === idx;
                const isSelfDragging = draggedIdx === idx;

                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedPageId(p.id)}
                    className={`group relative flex flex-col rounded-lg border cursor-pointer transition-all ${
                      isSelfDragging
                        ? "opacity-30 border-dashed border-cyan-500 scale-95"
                        : isDragTarget
                        ? "border-cyan-400 bg-cyan-950/20 scale-[1.02]"
                        : isSelected
                        ? "border-cyan-500 ring-2 ring-cyan-500/40 bg-[#1E2638] shadow"
                        : "border-[#272E3F] hover:border-slate-500 bg-[#131720]"
                    }`}
                  >
                    {/* Thumbnail Card Preview */}
                    <div className="relative aspect-[3/4] bg-[#0A0D14] rounded-t-lg overflow-hidden flex items-center justify-center p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getThumbnailUrl(p.id, false, 80)}
                        alt={p.label}
                        loading="lazy"
                        decoding="async"
                        className="object-contain max-h-full max-w-full pointer-events-none transition-transform duration-150"
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                      />

                      {/* Page Number Badge */}
                      <span className="absolute top-1 left-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                        #{idx + 1}
                      </span>

                      {/* Rotation Tag */}
                      {p.rotation !== 0 && (
                        <span className="absolute top-1 right-1 bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[8px] font-mono px-1 rounded">
                          {p.rotation}°
                        </span>
                      )}

                      {/* Grip indicator on hover */}
                      <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded px-1 py-0.5 text-white/80 flex items-center pointer-events-none">
                        <GripVertical size={10} />
                      </div>

                      {/* Hover Actions Toolbar */}
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-slate-900/90 rounded p-0.5 border border-slate-700/60 backdrop-blur-sm">
                        <button
                          type="button"
                          title="Rotate 90° CW"
                          onClick={(e) => {
                            e.stopPropagation();
                            rotatePage(p.id, 90);
                          }}
                          className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                          <RotateCw size={10} />
                        </button>
                        <button
                          type="button"
                          title="Delete Page"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePage(p.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Label Strip */}
                    <div className="px-1.5 py-1 text-[10px] text-slate-300 truncate font-medium bg-[#131720]/80 rounded-b-lg border-t border-[#242A38]">
                      {p.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
