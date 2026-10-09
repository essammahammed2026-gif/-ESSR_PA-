"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Eye, 
  RotateCw, 
  RotateCcw,
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";

interface BookWorkspaceProps {
  pages: BookStudioPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string) => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  rotatePage: (pageId: string, delta?: number) => void;
  deletePage: (pageId: string) => void;
  sessionId: string | null;
}

export function BookWorkspace({
  pages,
  selectedPageId,
  setSelectedPageId,
  getThumbnailUrl,
  rotatePage,
  deletePage,
  sessionId,
}: BookWorkspaceProps) {
  // Container & Viewport refs
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Overlay state: locked toggle (O key) or momentary hold (Space key)
  const [isLockedOriginal, setIsLockedOriginal] = useState<boolean>(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState<boolean>(false);

  // Computed: whether the original raw scan is currently active
  const isViewingOriginal = isLockedOriginal || isHoldingSpace;

  const selectedIdx = pages.findIndex((p) => p.id === selectedPageId);
  const selectedPage = selectedIdx >= 0 ? pages[selectedIdx] : null;

  const goToNextPage = useCallback(() => {
    if (selectedIdx < pages.length - 1) {
      setSelectedPageId(pages[selectedIdx + 1].id);
    }
  }, [selectedIdx, pages, setSelectedPageId]);

  const goToPrevPage = useCallback(() => {
    if (selectedIdx > 0) {
      setSelectedPageId(pages[selectedIdx - 1].id);
    }
  }, [selectedIdx, pages, setSelectedPageId]);

  // Reset zoom & pan on page change
  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, [selectedPageId]);

  // Fullscreen toggle handler using Fullscreen API
  const toggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error("Fullscreen request failed:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error("Exit fullscreen failed:", err);
      }
    }
  }, []);

  // Sync fullscreen change events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  // Non-passive wheel event listener: Ctrl + Mouse Wheel for zoom centered on cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Prevent default browser zoom
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const factor = e.deltaY < 0 ? 1.15 : 0.85;

        setZoom((prevZoom) => {
          const nextZoom = Math.min(Math.max(0.4, prevZoom * factor), 4.0);
          setPan((prevPan) => ({
            x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
            y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom),
          }));
          return nextZoom;
        });
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Pan dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (zoom > 1.0 || e.altKey)) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Keyboard Shortcuts: Space (Hold for Original), O (Toggle), Ctrl+0 (Reset 100%), Arrows/Brackets, R / Shift+R
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea or select
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ctrl + 0: Reset zoom to 100% and center
      if (e.ctrlKey && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault();
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsHoldingSpace(true);
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setIsLockedOriginal((prev) => !prev);
      } else if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        goToNextPage();
      } else if ((e.key === "r" || e.key === "R") && selectedPage) {
        e.preventDefault();
        if (e.shiftKey) {
          rotatePage(selectedPage.id, -90);
        } else {
          rotatePage(selectedPage.id, 90);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsHoldingSpace(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [goToNextPage, goToPrevPage, rotatePage, selectedPage]);

  if (!sessionId || pages.length === 0) {
    return (
      <div className="h-full bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col items-center justify-center p-8 text-center select-none shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
          <BookOpen size={32} />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Book Studio Ready</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Select an intake mode in the left panel and drop your book PDF to preview, deskew, clean margins, and add print bleed.
        </p>
        <div className="grid grid-cols-3 gap-3 text-left max-w-md w-full">
          <div className="p-3 bg-[#131720] border border-[#242A38] rounded-lg">
            <div className="text-[11px] font-semibold text-cyan-400 mb-0.5">1. Deck Intake</div>
            <div className="text-[10px] text-slate-400">Thumbnails load in left column</div>
          </div>
          <div className="p-3 bg-[#131720] border border-[#242A38] rounded-lg">
            <div className="text-[11px] font-semibold text-amber-400 mb-0.5">2. Full Viewport</div>
            <div className="text-[10px] text-slate-400">High-res canvas & space overlay</div>
          </div>
          <div className="p-3 bg-[#131720] border border-[#242A38] rounded-lg">
            <div className="text-[11px] font-semibold text-emerald-400 mb-0.5">3. Print Output</div>
            <div className="text-[10px] text-slate-400">Print bleed & crop cut marks</div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="h-full bg-[#181D27] rounded-xl border border-[#242A38] flex items-center justify-center text-slate-400 text-xs">
        Select a page from the deck on the left to preview.
      </div>
    );
  }

  return (
    <div 
      ref={viewportRef}
      className={`flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm select-none relative ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""
      }`}
    >
      {/* Top Viewport Navigation & Toolbar */}
      <div className="p-2.5 border-b border-[#242A38] bg-[#131720] flex items-center justify-between">
        {/* Left: Prev / Next Navigation with Clean Count */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
            <button
              onClick={goToPrevPage}
              disabled={selectedIdx === 0}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
              title="Previous Page (Shortcut: [ or Left Arrow)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono font-bold text-cyan-400 px-2 min-w-[56px] text-center">
              {selectedIdx + 1} / {pages.length}
            </span>
            <button
              onClick={goToNextPage}
              disabled={selectedIdx === pages.length - 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
              title="Next Page (Shortcut: ] or Right Arrow)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Center: Clean Show Original / Show Edited Toggle Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsLockedOriginal((prev) => !prev)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
              isViewingOriginal
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-950/70"
                : "bg-amber-950/80 text-amber-300 border-amber-600/70 ring-1 ring-amber-500/30"
            }`}
            title="Toggle between Original Scan and Cleaned Print View (Shortcut: Press O or Hold Space)"
          >
            {isViewingOriginal ? (
              <>
                <Sparkles size={14} className="text-emerald-400" />
                <span>Show Edited</span>
              </>
            ) : (
              <>
                <Eye size={14} className="text-amber-400" />
                <span>Show Original</span>
              </>
            )}
            <span className="text-[10px] font-mono opacity-60 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 ml-1">
              Space / O
            </span>
          </button>
        </div>

        {/* Right: Rotate CW / CCW, Zoom Controls, Fullscreen */}
        <div className="flex items-center space-x-1.5">
          {/* Rotate Counter-Clockwise */}
          <button
            onClick={() => rotatePage(selectedPage.id, -90)}
            className="p-1.5 text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 rounded-lg border border-[#2E3648] transition-colors"
            title="Rotate 90° CCW (Shortcut: Shift+R)"
          >
            <RotateCcw size={14} />
          </button>

          {/* Rotate Clockwise */}
          <button
            onClick={() => rotatePage(selectedPage.id, 90)}
            className="p-1.5 text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 rounded-lg border border-[#2E3648] transition-colors"
            title="Rotate 90° CW (Shortcut: R)"
          >
            <RotateCw size={14} />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-[#181D27] p-1 rounded-lg border border-[#2E3648]">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="text-[10px] font-mono text-slate-400 px-1 min-w-[38px] text-center hover:text-cyan-400 transition-colors"
              title="Click or press Ctrl+0 to reset to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(4.0, z + 0.2))}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg border transition-colors ${
              isFullscreen
                ? "bg-blue-600 text-white border-blue-500"
                : "text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 border-[#2E3648]"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Delete Page */}
          <button
            onClick={() => deletePage(selectedPage.id)}
            className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#181D27] hover:bg-rose-950/40 rounded-lg border border-[#2E3648] hover:border-rose-900/40 transition-colors"
            title="Delete this page"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Full-Page High-Res Canvas Viewport with Pan & Cursor-Centric Wheel Zoom */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 overflow-hidden bg-[#0A0D14] flex items-center justify-center p-6 relative ${
          zoom > 1.0 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        }`}
      >
        <div 
          className="relative transition-transform duration-75 ease-out flex items-center justify-center max-w-full max-h-full"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getThumbnailUrl(selectedPage.id, !isViewingOriginal, 150)}
            alt={`Page ${selectedIdx + 1}`}
            className="max-h-[calc(100vh-14rem)] max-w-full object-contain rounded shadow-2xl transition-all duration-150 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] border border-slate-800"
            style={{ transform: `rotate(${selectedPage.rotation}deg)` }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
