"use client";

import React, { useRef, useState, useEffect } from "react";
import { Upload, RefreshCw, ChevronLeft, ChevronDown } from "lucide-react";
import {
  IconBookStudio,
  IconImposingStudio,
  IconPreflightStudio,
} from "@/components/shared/StudioIcons";
import { BookIntakeMode, BookStudioPage } from "@/types/book_studio";
import { LengthUnit } from "@/lib/units";
import { parsePageRange } from "@/lib/pageScope";
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
  selectedPageIds?: string[];
  setSelectedPageIds?: (ids: string[]) => void;
  isInitializing: boolean;
  initSession: () => void;
  resetJob: () => void;
  rotatePage: (pageId: string, delta?: number) => void;
  rotatePages?: (pageIds: string[], delta?: number) => void;
  deletePage: (pageId: string) => void;
  deletePages?: (pageIds: string[]) => void;
  reorderPages: (fromIdx: number, toIdx: number) => void;
  duplicatePage?: (targetPageId: string, position?: "before" | "after") => void;
  duplicatePages?: (pageIds: string[]) => void;
  insertBlankPage?: (targetPageId: string, position?: "before" | "after", widthMm?: number, heightMm?: number) => void;
  copyPage?: (page: BookStudioPage) => void;
  pastePage?: (targetPageId: string, position?: "before" | "after") => void;
  canPaste?: boolean;
  extractPage?: (pageId: string, format?: "pdf" | "png" | "jpeg" | "webp") => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  viewMode?: "grid" | "list";
  unit?: LengthUnit;
  onCollapse?: () => void;
}

export function BookLeftPanel({
  intakeMode, setIntakeMode, fileSingle, setFileSingle, fileOdds, setFileOdds, fileEvens, setFileEvens,
  oddsOrder, setOddsOrder, evensOrder, setEvensOrder, sessionId, pages, selectedPageId, setSelectedPageId,
  selectedPageIds = [], setSelectedPageIds, isInitializing, initSession, resetJob, rotatePage, rotatePages,
  deletePage, deletePages, reorderPages, duplicatePage, duplicatePages, insertBlankPage, copyPage, pastePage,
  canPaste = false, extractPage, getThumbnailUrl, viewMode = "grid", unit = "mm", onCollapse,
}: BookLeftPanelProps) {
  const singleInputRef = useRef<HTMLInputElement>(null);
  const oddsInputRef = useRef<HTMLInputElement>(null);
  const evensInputRef = useRef<HTMLInputElement>(null);
  const lastClickedIndexRef = useRef<number>(0);
  const selectMenuRef = useRef<HTMLDivElement>(null);

  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);
  const [showCustomRangeInput, setShowCustomRangeInput] = useState(false);
  const [customRangeText, setCustomRangeText] = useState("");

  const [contextMenu, setContextMenu] = useState<{
    page: BookStudioPage;
    position: { x: number; y: number };
  } | null>(null);
  const [propertiesPage, setPropertiesPage] = useState<BookStudioPage | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectMenuRef.current && !selectMenuRef.current.contains(e.target as Node)) {
        setIsSelectMenuOpen(false);
        setShowCustomRangeInput(false);
      }
    };
    if (isSelectMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isSelectMenuOpen]);

  const handleSelectPage = (id: string, e?: React.MouseEvent) => {
    const clickedIdx = pages.findIndex((p) => p.id === id);
    if (clickedIdx === -1) return;

    if (e?.shiftKey && setSelectedPageIds) {
      const anchorIdx =
        lastClickedIndexRef.current >= 0 && lastClickedIndexRef.current < pages.length
          ? lastClickedIndexRef.current
          : pages.findIndex((p) => p.id === selectedPageId);
      const start = Math.min(anchorIdx >= 0 ? anchorIdx : 0, clickedIdx);
      const end = Math.max(anchorIdx >= 0 ? anchorIdx : 0, clickedIdx);
      const rangeIds = pages.slice(start, end + 1).map((p) => p.id);
      setSelectedPageIds(rangeIds);
      setSelectedPageId(id);
    } else if ((e?.ctrlKey || e?.metaKey) && setSelectedPageIds) {
      const currentSelected = selectedPageIds || (selectedPageId ? [selectedPageId] : []);
      let nextSelected: string[];
      if (currentSelected.includes(id)) {
        nextSelected = currentSelected.filter((item) => item !== id);
        if (nextSelected.length === 0) nextSelected = [id];
      } else {
        nextSelected = [...currentSelected, id];
      }
      setSelectedPageIds(nextSelected);
      setSelectedPageId(id);
      lastClickedIndexRef.current = clickedIdx;
    } else {
      setSelectedPageId(id);
      if (setSelectedPageIds) {
        setSelectedPageIds([id]);
      }
      lastClickedIndexRef.current = clickedIdx;
    }
  };

  const handleSelectAll = () => {
    if (setSelectedPageIds) setSelectedPageIds(pages.map((p) => p.id));
    setIsSelectMenuOpen(false);
    setShowCustomRangeInput(false);
  };

  const handleSelectOdds = () => {
    if (setSelectedPageIds) {
      const odds = pages.filter((_, idx) => (idx + 1) % 2 !== 0).map((p) => p.id);
      setSelectedPageIds(odds);
      if (odds.length > 0 && !odds.includes(selectedPageId || "")) {
        setSelectedPageId(odds[0]);
      }
    }
    setIsSelectMenuOpen(false);
    setShowCustomRangeInput(false);
  };

  const handleSelectEvens = () => {
    if (setSelectedPageIds) {
      const evens = pages.filter((_, idx) => (idx + 1) % 2 === 0).map((p) => p.id);
      setSelectedPageIds(evens);
      if (evens.length > 0 && !evens.includes(selectedPageId || "")) {
        setSelectedPageId(evens[0]);
      }
    }
    setIsSelectMenuOpen(false);
    setShowCustomRangeInput(false);
  };

  const handleApplyCustomRange = () => {
    if (!setSelectedPageIds || !customRangeText.trim()) return;
    const rangeSet = parsePageRange(customRangeText);
    const matched = pages.filter((_, idx) => rangeSet.has(idx + 1)).map((p) => p.id);
    if (matched.length > 0) {
      setSelectedPageIds(matched);
      if (!matched.includes(selectedPageId || "")) {
        setSelectedPageId(matched[0]);
      }
    }
    setIsSelectMenuOpen(false);
    setShowCustomRangeInput(false);
  };

  const handleClearSelection = () => {
    if (setSelectedPageIds) {
      setSelectedPageIds(selectedPageId ? [selectedPageId] : []);
    }
    setIsSelectMenuOpen(false);
    setShowCustomRangeInput(false);
  };

  const handleContextMenu = (e: React.MouseEvent, page: BookStudioPage) => {
    e.preventDefault();
    if (setSelectedPageIds && !selectedPageIds.includes(page.id)) {
      setSelectedPageId(page.id);
      setSelectedPageIds([page.id]);
    }
    setContextMenu({
      page,
      position: { x: e.clientX, y: e.clientY },
    });
  };
  const intakeModes: { id: BookIntakeMode; title: string; tooltip: string; icon: React.ReactNode }[] = [
    { id: "single_page", title: "Standard Book PDF", tooltip: "Single pages or 2-up spreads to split in studio", icon: <IconBookStudio size={15} /> },
    { id: "dual_pass", title: "Dual Pass (Odds / Evens)", tooltip: "Collate separate odd and even duplex scan batches", icon: <IconImposingStudio size={15} /> },
    { id: "digital", title: "Digital / Vector PDF", tooltip: "Born-digital or pre-cleaned PDF book", icon: <IconPreflightStudio size={15} /> },
  ];
  return (
    <div className="flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden select-none">
      <div
        className="px-3 py-2 border-b border-[#242A38] bg-[#131720] flex items-center justify-between"
        title={sessionId ? "Drag thumbnails to reorder • Right-click for page actions" : "Configure document intake"}
      >
        <div className="flex items-center space-x-1.5 text-slate-200 font-semibold text-xs min-w-0">
          <IconBookStudio size={15} className="shrink-0" style={{ color: "var(--app-accent, #f59e0b)" }} />
          <span className="truncate">{sessionId ? "Deck" : "Intake"}</span>

          {sessionId && (
            <div className="relative shrink-0" ref={selectMenuRef}>
              <button
                type="button"
                onClick={() => setIsSelectMenuOpen((prev) => !prev)}
                className="flex items-center space-x-1 px-1.5 py-0.5 text-[10px] bg-[#181D27] hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-[#2E3648] transition-colors cursor-pointer"
                title="Select specific pages (All, Odds, Evens, Range)"
              >
                <span>Select</span>
                {selectedPageIds.length > 1 && (
                  <span className="px-1 bg-cyan-950 text-cyan-300 rounded font-mono text-[9px] border border-cyan-700/50">
                    {selectedPageIds.length}
                  </span>
                )}
                <ChevronDown size={10} className="text-slate-400" />
              </button>

              {isSelectMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#131720] border border-[#2E3648] rounded-lg shadow-xl py-1 z-50 text-[11px] text-slate-200">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>All Pages</span>
                    <span className="text-[10px] text-slate-500 font-mono">{pages.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectOdds}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>Odd Pages</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {pages.filter((_, i) => (i + 1) % 2 !== 0).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectEvens}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>Even Pages</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {pages.filter((_, i) => (i + 1) % 2 === 0).length}
                    </span>
                  </button>

                  <div className="border-t border-[#242A38] my-1" />

                  {!showCustomRangeInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomRangeInput(true)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
                    >
                      <span>Custom Range...</span>
                    </button>
                  ) : (
                    <div className="px-2 py-1 space-y-1">
                      <div className="text-[9px] text-slate-400">e.g. 1-5, 8, 11-14</div>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={customRangeText}
                          onChange={(e) => setCustomRangeText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleApplyCustomRange();
                          }}
                          placeholder="1-5, 8"
                          className="w-full bg-[#181D27] border border-[#2E3648] rounded px-1.5 py-0.5 text-[10px] text-white outline-none font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomRange}
                          className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedPageIds.length > 1 && (
                    <>
                      <div className="border-t border-[#242A38] my-1" />
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="w-full text-left px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      >
                        Reset Selection
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          {sessionId && (
            <button onClick={resetJob} className="text-[10px] px-2 py-0.5 bg-[#181D27] hover:bg-slate-800 text-slate-300 rounded border border-[#2E3648] transition-colors cursor-pointer" title="Close current session and start a new job">
              New Job
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer" title="Collapse Deck Panel">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>
      {!sessionId ? (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">1. Intake Mode</span>
            <div className="space-y-1">
              {intakeModes.map((m) => {
                const isSelected = intakeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setIntakeMode(m.id)}
                    title={m.tooltip}
                    className={`w-full px-2.5 py-2 rounded-lg border text-left transition-colors flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? "bg-[#131720] text-white"
                        : "border-[#242A38] bg-[#131720]/40 hover:bg-[#131720] text-slate-400 hover:text-slate-200"
                    }`}
                    style={isSelected ? { borderColor: "var(--app-accent, #f59e0b)" } : undefined}
                  >
                    <div className="shrink-0" style={isSelected ? { color: "var(--app-accent, #f59e0b)" } : undefined}>{m.icon}</div>
                    <span className="text-xs font-medium truncate">{m.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">2. Source File</span>
            {intakeMode === "dual_pass" ? (
              <div className="space-y-2">
                <div onClick={() => oddsInputRef.current?.click()}
                  title="Select PDF containing odd pages (1, 3, 5...)"
                  className={`p-2.5 rounded-lg border border-dashed cursor-pointer text-center transition-colors ${fileOdds ? "border-amber-500/60 bg-[#131720]" : "border-[#2E3648] hover:border-slate-500 bg-[#131720]/40"}`}>
                  <input ref={oddsInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileOdds(e.target.files?.[0] || null)} />
                  <div className="text-xs font-medium text-slate-200 truncate">{fileOdds ? fileOdds.name : "Odds PDF (1, 3, 5...)"}</div>
                </div>
                <div className="flex items-center justify-between text-[11px] px-0.5">
                  <span className="text-slate-400">Odds:</span>
                  <select value={oddsOrder} onChange={(e) => setOddsOrder(e.target.value as "forward" | "reverse")} className="bg-[#131720] border border-[#242A38] text-slate-200 rounded px-2 py-0.5 text-[11px]">
                    <option value="forward">Forward (1, 3, 5)</option>
                    <option value="reverse">Reverse (5, 3, 1)</option>
                  </select>
                </div>
                <div onClick={() => evensInputRef.current?.click()}
                  title="Select PDF containing even pages (2, 4, 6...)"
                  className={`p-2.5 rounded-lg border border-dashed cursor-pointer text-center transition-colors ${fileEvens ? "border-amber-500/60 bg-[#131720]" : "border-[#2E3648] hover:border-slate-500 bg-[#131720]/40"}`}>
                  <input ref={evensInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileEvens(e.target.files?.[0] || null)} />
                  <div className="text-xs font-medium text-slate-200 truncate">{fileEvens ? fileEvens.name : "Evens PDF (6, 4, 2...)"}</div>
                </div>
                <div className="flex items-center justify-between text-[11px] px-0.5">
                  <span className="text-slate-400">Evens:</span>
                  <select value={evensOrder} onChange={(e) => setEvensOrder(e.target.value as "reverse" | "forward")} className="bg-[#131720] border border-[#242A38] text-slate-200 rounded px-2 py-0.5 text-[11px]">
                    <option value="reverse">Reverse (...6, 4, 2)</option>
                    <option value="forward">Forward (2, 4, 6...)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div onClick={() => singleInputRef.current?.click()}
                title="Single pages or 2-up spreads loaded directly into the studio workspace"
                className={`p-4 rounded-lg border border-dashed cursor-pointer text-center transition-colors ${fileSingle ? "border-amber-500/60 bg-[#131720]" : "border-[#2E3648] hover:border-slate-500 bg-[#131720]/40"}`}>
                <input ref={singleInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFileSingle(e.target.files?.[0] || null)} />
                <Upload size={18} className="mx-auto mb-1.5" style={{ color: "var(--app-accent, #f59e0b)" }} />
                <div className="text-xs font-medium text-slate-200 truncate">{fileSingle ? fileSingle.name : "Browse Book PDF"}</div>
              </div>
            )}
          </div>
          <div className="pt-1">
            <button
              onClick={initSession}
              disabled={isInitializing || (intakeMode === "dual_pass" ? (!fileOdds || !fileEvens) : !fileSingle)}
              className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
              style={!(isInitializing || (intakeMode === "dual_pass" ? (!fileOdds || !fileEvens) : !fileSingle)) ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
            >
              {isInitializing ? (<><RefreshCw className="animate-spin" size={13} /><span>Loading...</span></>)
                : (<><IconBookStudio size={14} /><span>Open in Studio</span></>)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-2">
            {viewMode === "list" ? (
              <DeckListView
                pages={pages}
                selectedPageId={selectedPageId}
                selectedPageIds={selectedPageIds}
                onSelect={handleSelectPage}
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
                    isSelected={selectedPageIds ? selectedPageIds.includes(p.id) : p.id === selectedPageId}
                    isDragTarget={drag.dragOverIdx === idx}
                    isSelfDragging={drag.draggedIdx === idx}
                    thumbnailUrl={getThumbnailUrl(p.id, false, 80)}
                    onSelect={handleSelectPage}
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
              selectedPageIds={selectedPageIds}
              onRotate={(id, delta) => rotatePage(id, delta)}
              onBatchRotate={(delta) =>
                rotatePages && selectedPageIds.length > 1
                  ? rotatePages(selectedPageIds, delta)
                  : rotatePage(contextMenu.page.id, delta)
              }
              onDelete={(id) => deletePage(id)}
              onBatchDelete={() =>
                deletePages && selectedPageIds.length > 1
                  ? deletePages(selectedPageIds)
                  : deletePage(contextMenu.page.id)
              }
              onCopy={(p) => copyPage && copyPage(p)}
              onDuplicate={(id) => duplicatePage && duplicatePage(id)}
              onBatchDuplicate={() =>
                duplicatePages && selectedPageIds.length > 1
                  ? duplicatePages(selectedPageIds)
                  : duplicatePage && duplicatePage(contextMenu.page.id)
              }
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
              unit={unit}
              isOpen={Boolean(propertiesPage)}
              onClose={() => setPropertiesPage(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
