"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Eye,
  EyeOff,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  LayoutGrid,
} from "lucide-react";
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
  unit?: string;
}

export function PreviewViewport({
  previewData,
  items,
  isPreviewing,
  sheetW,
  sheetH,
  margin,
  drawBorder,
  borderColor,
  cropMarks,
  regMarks = false,
  error,
  currentPage,
  setCurrentPage,
  isDeckOpen = false,
  onToggleDeck,
  unit = "mm",
}: PreviewViewportProps): React.JSX.Element {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(true);
  const [showPageOverlay, setShowPageOverlay] = useState<boolean>(true);

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
        const newScale = Math.min(Math.max(0.05, prevScale + prevScale * delta), 15);
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

  const handleMouseUp = (): void => {
    setIsDragging(false);
  };
  const handleMouseLeave = (): void => {
    setIsDragging(false);
  };

  const fitCurrentSheet = (): void => {
    if (!previewData?.preview_pages[currentPage] || !canvasRef.current) return;
    const pageW = previewData.preview_pages[currentPage].w;
    const pageH = previewData.preview_pages[currentPage].h;
    if (pageW <= 0 || pageH <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const availW = Math.max(100, rect.width - 48);
    const availH = Math.max(100, rect.height - 48);
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
  const efficiency = previewData?.stats?.avg_efficiency ?? null;

  return (
    <div className="flex-1 min-w-0 w-full h-full flex flex-col bg-[var(--surface-canvas,#090C12)] select-none">
      {error && (
        <div className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border-b border-rose-500/30 text-xs shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Minimal Toolbar: Deck Toggle & Hand Tool */}
        <div className="px-3 py-1.5 border-b border-[var(--border-subtle,#242C3D)] bg-[var(--surface-panel,#141923)]/80 backdrop-blur-md flex items-center justify-between relative z-20 shrink-0">
          <div className="flex items-center space-x-1.5">
            {onToggleDeck && (
              <button
                type="button"
                onClick={onToggleDeck}
                className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isDeckOpen
                    ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] border border-[var(--border-subtle,#242C3D)]"
                    : "text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)]"
                }`}
                title={isDeckOpen ? "Hide Page Deck" : "Show Page Deck"}
              >
                <LayoutGrid size={14} />
                <span className="text-[11px] font-medium hidden sm:inline">Deck</span>
              </button>
            )}

            <div className="w-px h-3.5 bg-[var(--border-subtle,#242C3D)] mx-1" />

            <button
              type="button"
              onClick={() => setIsPanMode((prev) => !prev)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isPanMode
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] border border-[var(--border-subtle,#242C3D)]"
                  : "text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)]"
              }`}
              title="Hand Tool (Drag to Pan Sheet)"
            >
              <Hand size={14} />
            </button>
          </div>

          {/* Top Center Dimension Notch */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] text-[11px] shadow-sm">
            <span className="font-mono text-[var(--text-primary,#F1F5F9)] font-semibold">
              {Math.round(sheetW)} × {Math.round(sheetH)} {unit}
            </span>
            {efficiency !== null && efficiency > 0 && (
              <>
                <span className="text-[var(--border-strong,#333E54)]">•</span>
                <span className="font-mono text-[var(--app-accent,#F59E0B)] font-medium">
                  {Math.round(efficiency)}% Used
                </span>
              </>
            )}
            {pageCount > 0 && (
              <>
                <span className="text-[var(--border-strong,#333E54)]">•</span>
                <span className="text-[var(--text-muted,#64748B)]">
                  Sheet {currentPage + 1}/{pageCount}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isPreviewing && (
              <span className="text-[11px] text-[var(--app-accent,#F59E0B)] flex items-center font-medium">
                <Loader2 className="animate-spin mr-1.5" size={12} />
                Calculating...
              </span>
            )}
          </div>
        </div>

        {/* Center Interactive Sheet Canvas */}
        <div
          ref={canvasRef}
          className={`flex-1 bg-[var(--surface-canvas,#090C12)] flex items-center justify-center overflow-hidden relative ${
            isPanMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {!previewData && (
            <div className="text-[var(--text-muted,#64748B)] flex flex-col items-center p-6 text-center">
              <SlidersHorizontal size={36} className="mb-3 opacity-25 text-[var(--app-accent,#F59E0B)]" />
              {items.length === 0 ? (
                <>
                  <p className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)]">
                    Upload a PDF or artwork to begin
                  </p>
                  <p className="text-[11px] text-[var(--text-muted,#64748B)] mt-1">
                    Automatic prepress imposition & nesting
                  </p>
                </>
              ) : showEmptyHint ? (
                <>
                  <p className="text-xs font-semibold text-[var(--app-accent,#F59E0B)]">
                    Select a Target Press Sheet
                  </p>
                  <p className="text-[11px] text-[var(--text-muted,#64748B)] mt-1">
                    Pick your press sheet size to calculate layout
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-[var(--text-secondary,#94A3B8)]">
                  Calculating sheet layout...
                </p>
              )}
            </div>
          )}

          {previewData && activeSheet && (
            <SheetCanvas
              sheet={activeSheet}
              margin={margin}
              drawBorder={drawBorder}
              borderColor={borderColor}
              cropMarks={cropMarks}
              regMarks={regMarks}
              showPageOverlay={showPageOverlay}
              scale={scale}
              position={position}
              isDragging={isDragging}
            />
          )}

          {/* Floating Bottom Navigation & Zoom HUD Pill (Matches Book Studio) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-[var(--surface-panel,#141923)]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[var(--border-subtle,#242C3D)] shadow-2xl z-30 text-xs">
            {showNav && previewData && (
              <>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    title="First Sheet"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(0)}
                    className="p-1 hover:bg-[var(--surface-card,#181D27)] rounded text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    type="button"
                    title="Previous Sheet"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="p-1 hover:bg-[var(--surface-card,#181D27)] rounded text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <div className="flex items-center space-x-1 px-1">
                    <input
                      type="number"
                      min={1}
                      max={pageCount}
                      value={currentPage + 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= pageCount) setCurrentPage(val - 1);
                      }}
                      className="w-9 text-xs font-mono font-bold bg-[var(--surface-inset,#11151E)] border border-[var(--border-subtle,#242C3D)] text-[var(--text-primary,#F1F5F9)] text-center rounded px-1 py-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] font-mono text-[var(--text-muted,#64748B)] whitespace-nowrap">
                      / {pageCount}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Next Sheet"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                    className="p-1 hover:bg-[var(--surface-card,#181D27)] rounded text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    title="Last Sheet"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setCurrentPage(pageCount - 1)}
                    className="p-1 hover:bg-[var(--surface-card,#181D27)] rounded text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
                <div className="w-px h-4 bg-[var(--border-subtle,#242C3D)] mx-1" />
              </>
            )}

            {/* Page Overlay Labels Toggle */}
            <button
              type="button"
              onClick={() => setShowPageOverlay(!showPageOverlay)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                showPageOverlay
                  ? "text-[var(--app-accent,#F59E0B)] bg-[var(--app-accent-15)]"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)]"
              }`}
              title={showPageOverlay ? "Hide Page Labels" : "Show Page Labels"}
            >
              {showPageOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <div className="w-px h-4 bg-[var(--border-subtle,#242C3D)] mx-1" />

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.05, s * 0.85))}
                className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <input
                type="range"
                min={10}
                max={400}
                step={5}
                value={Math.min(400, Math.max(10, Math.round(scale * 100)))}
                onChange={(e) => setScale(Number(e.target.value) / 100)}
                className="w-20 h-1 bg-[var(--surface-inset,#11151E)] rounded-lg appearance-none cursor-pointer accent-[var(--app-accent,#F59E0B)]"
                title="Zoom Level"
              />
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(15, s * 1.2))}
                className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={fitCurrentSheet}
                className="px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer min-w-[38px] text-center"
                title="Click to Fit Sheet"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={fitCurrentSheet}
                className="p-1 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] rounded hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer"
                title="Fit to Screen"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
