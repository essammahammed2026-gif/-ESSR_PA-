"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Eye, EyeOff, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, SlidersHorizontal, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
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
}

export function PreviewViewport({
  previewData, items, jobMode, bookStep, isPreviewing, sheetW, sheetH,
  margin, drawBorder, borderColor, cropMarks, regMarks = false,
  error, currentPage, setCurrentPage,
}: PreviewViewportProps): React.JSX.Element {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
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
    <div className="flex-1 min-w-0 w-full h-full flex flex-col space-y-2">
      {error && (
        <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">{error}</div>
      )}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col overflow-hidden h-full shadow-sm relative">
        <div className="p-2.5 border-b border-[#242A38] flex flex-wrap justify-between items-center bg-[#141822] gap-2">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300">
                {jobMode === "book" && bookStep === 1 ? "Step 1: Page Trim & Bleed View" : "Step 2: Live Press Sheet View"}
              </span>
              {isPreviewing && (
                <span className="text-xs text-emerald-400 flex items-center font-medium ml-2">
                  <Loader2 className="animate-spin mr-1.5" size={13} />Calculating...
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPageOverlay(!showPageOverlay)}
              className={`text-[10px] px-2 py-1 rounded border flex items-center space-x-1.5 transition-colors font-medium ${showPageOverlay ? "bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold" : "bg-[#1A202C] text-slate-400 border-[#2E3648] hover:text-white"}`}
              title={showPageOverlay ? "Page labels visible" : "Page labels hidden"}
            >
              {showPageOverlay ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} />}
              <span>{showPageOverlay ? "Labels On" : "Labels Off"}</span>
            </button>
          </div>
          {showNav && previewData && (
            <div className="flex items-center space-x-1.5 bg-[#1A202C] rounded-lg border border-[#2E3648] px-2 py-1">
              <button type="button" title="First Sheet" disabled={currentPage === 0} onClick={() => setCurrentPage(0)} className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"><ChevronsLeft size={14} /></button>
              <button type="button" title="Previous Sheet" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
              <div className="flex items-center space-x-1 px-1">
                <span className="text-xs text-slate-400 font-medium">Sheet</span>
                <input
                  type="number" min={1} max={pageCount} value={currentPage + 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= pageCount) setCurrentPage(val - 1);
                  }}
                  className="w-12 text-xs font-mono font-bold bg-[#131720] border border-[#2E3648] text-white text-center rounded px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs font-mono font-semibold text-slate-400 whitespace-nowrap">/ {pageCount}</span>
              </div>
              <button type="button" title="Next Sheet" disabled={currentPage >= pageCount - 1} onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))} className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
              <button type="button" title="Last Sheet" disabled={currentPage >= pageCount - 1} onClick={() => setCurrentPage(pageCount - 1)} className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"><ChevronsRight size={14} /></button>
            </div>
          )}
        </div>
        <div
          ref={canvasRef}
          className="flex-1 bg-[#0F1218] flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-[#181D27]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2E3648] shadow-lg z-10">
            <button type="button" onClick={() => setScale((s) => Math.min(15, s * 1.25))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors" title="Zoom In"><ZoomIn size={15} /></button>
            <button type="button" onClick={() => setScale((s) => Math.max(0.1, s * 0.8))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors" title="Zoom Out"><ZoomOut size={15} /></button>
            <div className="w-px h-3.5 bg-[#2E3648] mx-1" />
            <button type="button" onClick={fitCurrentSheet} className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors" title="Fit to Screen"><Maximize2 size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
