"use client";

import React, { useRef, useState } from "react";
import { FileText, Layers, FileCheck, Upload, Sparkles, RefreshCw, FolderOpen, ChevronLeft } from "lucide-react";
import { BookIntakeMode, BookStudioPage } from "@/types/book_studio";
import { DeckCard } from "./DeckCard";
import { DeckListView } from "./DeckListView";
import { PageContextMenu } from "./PageContextMenu";
import { PagePropertiesModal } from "./PagePropertiesModal";
import { DeckGrid } from "@/components/shared/DeckGrid";

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
  duplicatePage?: (targetPageId: string, position?: "before" | "after") => void;
  insertBlankPage?: (targetPageId: string, position?: "before" | "after", widthMm?: number, heightMm?: number) => void;
  copyPage?: (page: BookStudioPage) => void;
  pastePage?: (targetPageId: string, position?: "before" | "after") => void;
  canPaste?: boolean;
  extractPage?: (pageId: string, format?: "pdf" | "png" | "jpeg" | "webp") => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  viewMode?: "grid" | "list";
  onCollapse?: () => void;
}

export function BookLeftPanel({
  intakeMode, setIntakeMode, fileSingle, setFileSingle, fileOdds, setFileOdds, fileEvens, setFileEvens,
  oddsOrder, setOddsOrder, evensOrder, setEvensOrder, sessionId, pages, selectedPageId, setSelectedPageId,
  isInitializing, initSession, resetJob, rotatePage, deletePage, reorderPages,
  duplicatePage, insertBlankPage, copyPage, pastePage, canPaste = false, extractPage,
  getThumbnailUrl, viewMode = "grid", onCollapse,
}: BookLeftPanelProps) {
  const singleInputRef = useRef<HTMLInputElement>(null);
  const oddsInputRef = useRef<HTMLInputElement>(null);
  const evensInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    page: BookStudioPage;
    position: { x: number; y: number };
  } | null>(null);
  const [propertiesPage, setPropertiesPage] = useState<BookStudioPage | null>(null);

  const handleContextMenu = (e: React.MouseEvent, page: BookStudioPage) => {
    e.preventDefault();
    setContextMenu({
      page,
      position: { x: e.clientX, y: e.clientY },
    });
  };
  const intakeModes: { id: BookIntakeMode; title: string; subtitle: string; icon: React.ReactNode }[] = [
    { id: "single_page", title: "Standard Book PDF", subtitle: "Single pages or 2-up spreads to split in studio", icon: <FileText size={16} className="text-cyan-400" /> },
    { id: "dual_pass", title: "Dual Pass (Odds/Evens)", subtitle: "Duplex scan batches collated", icon: <Layers size={16} className="text-cyan-400" /> },
    { id: "digital", title: "Digital / Original", subtitle: "Born-digital or vector PDF book", icon: <FileCheck size={16} className="text-cyan-400" /> },
  ];
  return (
    <div className="flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm select-none">
      <div className="p-3 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm truncate">
          <FolderOpen size={16} className="text-cyan-400 shrink-0" />
          <span className="truncate">{sessionId ? "Pages Deck" : "Document Intake"}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {sessionId && (
            <button onClick={resetJob} className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-[#2E3648] transition-colors">
              New Job
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Collapse Left Panel">
              <ChevronLeft size={15} />
            </button>
          )}
        </div>
      </div>
      {!sessionId ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">1. Select Intake Type</span>
            <div className="space-y-1.5">
              {intakeModes.map((m) => {
                const isSelected = intakeMode === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setIntakeMode(m.id)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-start space-x-2.5 ${isSelected ? "border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500/30 text-white" : "border-[#242A38] bg-[#131720]/50 hover:bg-[#131720] text-slate-300 hover:border-slate-700"}`}>
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
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">2. Upload Source PDF</span>
            {intakeMode === "dual_pass" ? (
              <div className="space-y-2.5">
                <div onClick={() => oddsInputRef.current?.click()}
                  className={`p-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${fileOdds ? "border-cyan-500/60 bg-cyan-950/20" : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"}`}>
                  <input ref={oddsInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileOdds(e.target.files?.[0] || null)} />
                  <div className="text-xs font-medium text-slate-200 truncate">{fileOdds ? fileOdds.name : "Select Odds PDF (Pages 1, 3, 5...)"}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Click to choose file</div>
                </div>
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-400">Odds Order:</span>
                  <select value={oddsOrder} onChange={(e) => setOddsOrder(e.target.value as "forward" | "reverse")} className="bg-[#131720] border border-[#2E3648] text-slate-200 rounded px-2 py-0.5 text-[11px]">
                    <option value="forward">Forward (1, 3, 5)</option>
                    <option value="reverse">Reverse (5, 3, 1)</option>
                  </select>
                </div>
                <div onClick={() => evensInputRef.current?.click()}
                  className={`p-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${fileEvens ? "border-cyan-500/60 bg-cyan-950/20" : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"}`}>
                  <input ref={evensInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileEvens(e.target.files?.[0] || null)} />
                  <div className="text-xs font-medium text-slate-200 truncate">{fileEvens ? fileEvens.name : "Select Evens PDF (Pages 6, 4, 2...)"}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Click to choose file</div>
                </div>
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-400">Evens Order:</span>
                  <select value={evensOrder} onChange={(e) => setEvensOrder(e.target.value as "reverse" | "forward")} className="bg-[#131720] border border-[#2E3648] text-slate-200 rounded px-2 py-0.5 text-[11px]">
                    <option value="reverse">Reverse (...6, 4, 2) [ADF]</option>
                    <option value="forward">Forward (2, 4, 6...)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div onClick={() => singleInputRef.current?.click()}
                className={`p-5 rounded-lg border-2 border-dashed cursor-pointer text-center transition-all ${fileSingle ? "border-cyan-500/60 bg-cyan-950/20" : "border-[#2E3648] hover:border-cyan-400/50 bg-[#131720]/40"}`}>
                <input ref={singleInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileSingle(e.target.files?.[0] || null)} />
                <Upload size={24} className="mx-auto text-cyan-400 mb-2" />
                <div className="text-xs font-semibold text-slate-200 truncate">{fileSingle ? fileSingle.name : "Drop or Browse Book PDF"}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Single pages or 2-up spreads loaded directly into the studio workspace
                </div>
              </div>
            )}
          </div>
          <div className="pt-2">
            <button onClick={initSession} disabled={isInitializing || (intakeMode === "dual_pass" ? (!fileOdds || !fileEvens) : !fileSingle)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed">
              {isInitializing ? (<><RefreshCw className="animate-spin" size={14} /><span>Loading & Splitting...</span></>)
                : (<><Sparkles size={14} /><span>Open Book in Studio</span></>)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2 border-b border-[#242A38] bg-[#1A202C] flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Pages ({pages.length})</span>
            <span className="text-[10px] text-slate-500">Drag to reorder</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {viewMode === "list" ? (
              <DeckListView
                pages={pages}
                selectedPageId={selectedPageId}
                onSelect={setSelectedPageId}
                onReorder={reorderPages}
                onContextMenu={handleContextMenu}
              />
            ) : (
              <DeckGrid
                pages={pages}
                columns={2}
                emptyLabel="No pages in deck"
                onReorder={reorderPages}
                renderCard={(p, idx, drag, handlers) => (
                  <DeckCard
                    key={p.id}
                    page={p}
                    index={idx}
                    isSelected={p.id === selectedPageId}
                    isDragTarget={drag.dragOverIdx === idx}
                    isSelfDragging={drag.draggedIdx === idx}
                    thumbnailUrl={getThumbnailUrl(p.id, false, 80)}
                    onSelect={setSelectedPageId}
                    onDragStart={handlers.onDragStart}
                    onDragOver={handlers.onDragOver}
                    onDrop={handlers.onDrop}
                    onDragEnd={handlers.onDragEnd}
                    onContextMenu={handleContextMenu}
                  />
                )}
              />
            )}
          </div>

          {contextMenu && (
            <PageContextMenu
              page={contextMenu.page}
              position={contextMenu.position}
              onClose={() => setContextMenu(null)}
              onRotate={(id, delta) => rotatePage(id, delta)}
              onDelete={(id) => deletePage(id)}
              onCopy={(p) => copyPage && copyPage(p)}
              onDuplicate={(id) => duplicatePage && duplicatePage(id)}
              onPaste={(targetId, pos) => pastePage && pastePage(targetId, pos)}
              canPaste={canPaste}
              onInsertBlank={(targetId, pos) => insertBlankPage && insertBlankPage(targetId, pos)}
              onExtract={(id, fmt) => extractPage && extractPage(id, fmt)}
              onShowProperties={(p) => setPropertiesPage(p)}
            />
          )}

          {propertiesPage && (
            <PagePropertiesModal
              page={propertiesPage}
              pageIndex={pages.findIndex((p) => p.id === propertiesPage.id)}
              isOpen={Boolean(propertiesPage)}
              onClose={() => setPropertiesPage(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
