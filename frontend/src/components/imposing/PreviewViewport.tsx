"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Eye, EyeOff, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, SlidersHorizontal, ZoomIn, ZoomOut, Maximize2, Hand, LayoutGrid } from "lucide-react";
import { ImpositionPreviewResponse, ImposingItem } from "@/types/prepress";
import { SheetCanvas } from "./SheetCanvas";

export interface PreviewViewportProps {
  previewData: ImpositionPreviewResponse | null;
  items: ImposingItem[];
  jobMode: string;
  bookStep: number;
  isPreviewing: boolean;
  sheetW: number;
  sheetH: number;
  margin: number;
  drawBorder: boolean;
  borderColor: string;
  cropMarks: boolean;
  regMarks?: boolean;
  error: string | null;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  isDeckOpen?: boolean;
  onToggleDeck?: () => void;
}

export function PreviewViewport({
  previewData, items, isPreviewing, sheetW, sheetH,
  margin, drawBorder, borderColor, cropMarks, regMarks = false,
  error, currentPage, setCurrentPage,
  isDeckOpen = false, onToggleDeck,
}: PreviewViewportProps): React.JSX.Element {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(true);
  const [showPageOverlay, setShowPageOverlay] = useState<boolean>(false);

  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleNativeWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const zoomSensitivity = 0.002;
      const delta = -e.deltaY * zoomSensitivity;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      setScale((prevScale) => {
        const newScale = Math.min(Math.max(0.1, prevScale + prevScale * delta), 15);
        const ratio = newScale / prevScale;
        const mouseX = clientX - rect.left - rect.width / 2;
        const mouseY = clientY - rect.top - rect.height / 2;
        setPosition((prevPos) => ({
          x: mouseX - (mouseX - prevPos.x) * ratio,
          y: mouseY - (mouseY - prevPos.y) * ratio,
        }));
        return newScale;
      });
    };
    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!isDragging) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      setPosition({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
      rafId.current = null;
    });
  };

  const handleMouseUp = (): void => { setIsDragging(false); };
  const handleMouseLeave = (): void => { setIsDragging(false); };

  const fitCurrentSheet = (): void => {
    if (!previewData?.preview_pages[currentPage] || !canvasRef.current) return;
    const pageW = previewData.preview_pages[currentPage].w;
    const pageH = previewData.preview_pages[currentPage].h;
    if (pageW <= 0 || pageH <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const availW = Math.max(100, rect.width - 36);
    const availH = Math.max(100, rect.height - 36);
    setScale(Math.max(0.05, Math.min(availW / pageW, availH / pageH)));
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (previewData?.preview_pages[currentPage]) {
      const frame = requestAnimationFrame(fitCurrentSheet);
      return () => cancelAnimationFrame(frame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData, currentPage]);

  const activeSheet = previewData?.preview_pages[currentPage] ?? null;
  const pageCount = previewData?.preview_pages.length ?? 0;
  const showNav = previewData && previewData.preview_pages && pageCount > 1;
  const showEmptyHint = !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0;

  return (
    <div className="flex-1 min-w-0 w-full h-full flex flex-col">
      {error && (
        <div className="px-3 py-1.5 bg-red-500/10 text-red-400 border-b border-red-500/30 text-xs">{error}</div>
      )}
      <div className="bg-[#14171F] flex flex-col overflow-hidden h-full relative">
        {/* Minimal Borderless Top Toolbar: Hand Tool + Page Deck Toggle */}
        <div className="px-3 py-1.5 border-b border-[#1E232E] bg-[#14171F] flex items-center justify-center relative select-none z-20 shrink-0">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsPanMode((prev) => !prev)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isPanMode
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
              title="Hand Tool (Drag to Pan Sheet)"
            >
              <Hand size={15} />
            </button>

            <div className="w-px h-4 bg-[#1E232E] mx-1.5" />

            {onToggleDeck && (
              <button
                type="button"
                onClick={onToggleDeck}
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isDeckOpen
                    ? "bg-white/[0.1] text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
                title={isDeckOpen ? "Hide Page Deck" : "Show Page Deck"}
              >
                <LayoutGrid size={15} />
                <span className="text-[11px] font-medium hidden sm:inline">Pages</span>
              </button>
            )}
          </div>

          {isPreviewing && (
            <span className="absolute right-3 text-[11px] text-emerald-400 flex items-center font-medium">
              <Loader2 className="animate-spin mr-1.5" size={12} />Calculating...
            </span>
          )}
        </div>

        <div
          ref={canvasRef}
          className={`flex-1 bg-[#14171F] flex items-center justify-center overflow-hidden relative select-none ${
            isPanMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
        >
          {!previewData && (
            <div className="text-slate-400 flex flex-col items-center p-6 text-center">
              <SlidersHorizontal size={40} className="mb-3 opacity-30 text-emerald-400" />
              {items.length === 0 ? (
                <>
                  <p className="text-xs font-medium text-slate-300">Upload a PDF or artwork to begin</p>
                  <p className="text-[11px] text-slate-500 mt-1">Automatic imposition & nesting</p>
                </>
              ) : showEmptyHint ? (
                <>
                  <p className="text-xs font-semibold text-emerald-400">Select a Target Press Sheet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Pick your press sheet size to calculate layout</p>
                </>
              ) : (
                <p className="text-xs font-medium text-slate-300">Calculating sheet layout...</p>
              )}
            </div>
          )}
          {previewData && activeSheet && (
            <SheetCanvas
              sheet={activeSheet} margin={margin} drawBorder={drawBorder} borderColor={borderColor}
              cropMarks={cropMarks} regMarks={regMarks} showPageOverlay={showPageOverlay}
              scale={scale} position={position} isDragging={isDragging}
            />
          )}

          {/* Floating Bottom Pill HUD (Matches reference screenshot) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-[#14171F]/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#242A38] shadow-2xl z-30 text-xs select-none">
            {showNav && previewData && (
              <>
                <div className="flex items-center space-x-1">
                  <button type="button" title="First Sheet" disabled={currentPage === 0} onClick={() => setCurrentPage(0)} className="p-1 hover:bg-white/[0.06] rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ChevronsLeft size={14} /></button>
                  <button type="button" title="Previous Sheet" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} className="p-1 hover:bg-white/[0.06] rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ChevronLeft size={14} /></button>
                  <div className="flex items-center space-x-1 px-1">
                    <input
                      type="number" min={1} max={pageCount} value={currentPage + 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= pageCount) setCurrentPage(val - 1);
                      }}
                      className="w-10 text-xs font-mono font-bold bg-[#1C212C] border border-[#2B3242] text-white text-center rounded px-1 py-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">/ {pageCount}</span>
                  </div>
                  <button type="button" title="Next Sheet" disabled={currentPage >= pageCount - 1} onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))} className="p-1 hover:bg-white/[0.06] rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ChevronRight size={14} /></button>
                  <button type="button" title="Last Sheet" disabled={currentPage >= pageCount - 1} onClick={() => setCurrentPage(pageCount - 1)} className="p-1 hover:bg-white/[0.06] rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ChevronsRight size={14} /></button>
                </div>
                <div className="w-px h-4 bg-[#242A38] mx-1" />
              </>
            )}

            <button
              type="button"
              onClick={() => setShowPageOverlay(!showPageOverlay)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                showPageOverlay ? "text-blue-400 bg-blue-500/15" : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
              title={showPageOverlay ? "Hide Page Labels" : "Show Page Labels"}
            >
              {showPageOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <div className="w-px h-4 bg-[#242A38] mx-1" />

            <div className="flex items-center space-x-2">
              <button type="button" onClick={() => setScale((s) => Math.max(0.1, s * 0.85))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer" title="Zoom Out"><ZoomOut size={14} /></button>
              <input
                type="range"
                min={10}
                max={400}
                step={5}
                value={Math.min(400, Math.max(10, Math.round(scale * 100)))}
                onChange={(e) => setScale(Number(e.target.value) / 100)}
                className="w-24 h-1 bg-[#2B3242] rounded-lg appearance-none cursor-pointer accent-blue-500"
                title="Zoom Level"
              />
              <button type="button" onClick={() => setScale((s) => Math.min(15, s * 1.2))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer" title="Zoom In"><ZoomIn size={14} /></button>
              <button
                type="button"
                onClick={fitCurrentSheet}
                className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer min-w-[42px] text-center"
                title="Click to Fit Sheet"
              >
                {Math.round(scale * 100)}%
              </button>
              <button type="button" onClick={fitCurrentSheet} className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer" title="Fit to Screen"><Maximize2 size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
