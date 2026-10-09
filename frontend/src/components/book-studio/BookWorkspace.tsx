"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { BookStudioPage, CropModuleConfig } from "@/types/book_studio";

interface BookWorkspaceProps {
  pages: BookStudioPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string) => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  rotatePage: (pageId: string, delta?: number) => void;
  deletePage: (pageId: string) => void;
  sessionId: string | null;
  showGrid?: boolean;
  cropModule?: CropModuleConfig;
  setCropModule?: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
}

export function BookWorkspace({
  pages,
  selectedPageId,
  setSelectedPageId,
  getThumbnailUrl,
  rotatePage,
  deletePage,
  sessionId,
  showGrid = false,
  cropModule,
  setCropModule,
}: BookWorkspaceProps) {
  // Container & Viewport refs
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Crop drag handle state
  const [activeCropDrag, setActiveCropDrag] = useState<string | null>(null);

  const handleCropPointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveCropDrag(handle);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!activeCropDrag || !overlayRef.current || !cropModule || !setCropModule) return;
    const rect = overlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCropModule((prev) => {
      const box = { ...prev.cropBox };
      let sPos = prev.splitPos;

      if (activeCropDrag === "spine") {
        const boxW = Math.max(0.05, box.x2 - box.x1);
        const relInBox = (relX - box.x1) / boxW;
        sPos = Math.max(0.05, Math.min(0.95, relInBox));
      } else {
        // Calculate the current absolute position of the spine seam on the image
        const prevBoxW = Math.max(0.05, prev.cropBox.x2 - prev.cropBox.x1);
        const prevAbsSpineX = prev.cropBox.x1 + prev.splitPos * prevBoxW;

        if (activeCropDrag === "w") {
          box.x1 = Math.min(relX, box.x2 - 0.05);
        } else if (activeCropDrag === "e") {
          box.x2 = Math.max(relX, box.x1 + 0.05);
        } else if (activeCropDrag === "n") {
          box.y1 = Math.min(relY, box.y2 - 0.05);
        } else if (activeCropDrag === "s") {
          box.y2 = Math.max(relY, box.y1 + 0.05);
        } else if (activeCropDrag === "nw") {
          box.x1 = Math.min(relX, box.x2 - 0.05);
          box.y1 = Math.min(relY, box.y2 - 0.05);
        } else if (activeCropDrag === "ne") {
          box.x2 = Math.max(relX, box.x1 + 0.05);
          box.y1 = Math.min(relY, box.y2 - 0.05);
        } else if (activeCropDrag === "sw") {
          box.x1 = Math.min(relX, box.x2 - 0.05);
          box.y2 = Math.max(relY, box.y1 + 0.05);
        } else if (activeCropDrag === "se") {
          box.x2 = Math.max(relX, box.x1 + 0.05);
          box.y2 = Math.max(relY, box.y1 + 0.05);
        }

        // Anchor preservation: The spine seam stays anchored at the physical book spine!
        const newBoxW = Math.max(0.05, box.x2 - box.x1);
        const relInNewBox = (prevAbsSpineX - box.x1) / newBoxW;
        sPos = Math.max(0.05, Math.min(0.95, relInNewBox));
      }

      return {
        ...prev,
        cropBox: {
          x1: Math.round(box.x1 * 1000) / 1000,
          y1: Math.round(box.y1 * 1000) / 1000,
          x2: Math.round(box.x2 * 1000) / 1000,
          y2: Math.round(box.y2 * 1000) / 1000,
        },
        splitPos: Math.round(sPos * 1000) / 1000,
      };
    });
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (activeCropDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveCropDrag(null);
    }
  };

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Overlay state: locked toggle (O key) or momentary hold (Space key)
  const [isLockedOriginal, setIsLockedOriginal] = useState<boolean>(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState<boolean>(false);

  // Computed: whether the original raw scan is currently active
  const isViewingOriginal = isLockedOriginal || isHoldingSpace;

  const selectedIdx = pages.findIndex((p) => p.id === selectedPageId);
  const selectedPage = selectedIdx >= 0 ? pages[selectedIdx] : null;

  // Natural image dimensions from viewport preview (fallback mm estimation)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const isSelectedPageSplit = Boolean(selectedPage && (selectedPage.half === "left" || selectedPage.half === "right"));
  const isSpreadCut = !isSelectedPageSplit && cropModule?.mode === "spread";

  // Dimension calculations in millimeters
  const pageBaseWidthMm = useMemo(() => {
    if (selectedPage?.width_mm) return selectedPage.width_mm;
    if (selectedPage?.orig_width_mm) return selectedPage.orig_width_mm;
    if (naturalSize) return Math.round((naturalSize.w / 150) * 25.4 * 10) / 10;
    return 297.0;
  }, [selectedPage, naturalSize]);

  const pageBaseHeightMm = useMemo(() => {
    if (selectedPage?.height_mm) return selectedPage.height_mm;
    if (selectedPage?.orig_height_mm) return selectedPage.orig_height_mm;
    if (naturalSize) return Math.round((naturalSize.h / 150) * 25.4 * 10) / 10;
    return 210.0;
  }, [selectedPage, naturalSize]);

  const boxW = Math.max(0.01, (cropModule?.cropBox.x2 ?? 1) - (cropModule?.cropBox.x1 ?? 0));
  const boxH = Math.max(0.01, (cropModule?.cropBox.y2 ?? 1) - (cropModule?.cropBox.y1 ?? 0));

  const currentCropWidthMm = Math.round(pageBaseWidthMm * boxW * 10) / 10;
  const currentCropHeightMm = Math.round(pageBaseHeightMm * boxH * 10) / 10;

  const leftPageWidthMm = Math.round(currentCropWidthMm * (cropModule?.splitPos ?? 0.5) * 10) / 10;
  const rightPageWidthMm = Math.round(currentCropWidthMm * (1 - (cropModule?.splitPos ?? 0.5)) * 10) / 10;



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

  // Reset zoom & pan on page change, and sync crop module mode/bounds
  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    if (!selectedPage || !setCropModule) return;
    const isSplit = selectedPage.half === "left" || selectedPage.half === "right";
    setCropModule((prev) => ({
      ...prev,
      mode: isSplit ? "single" : (selectedPage.is_spread ? "spread" : "single"),
      cropBox: isSplit
        ? (selectedPage.page_crop_box || { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 })
        : (selectedPage.crop_box || { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 }),
      splitPos: selectedPage.split_pos ?? 0.5,
    }));
  }, [selectedPageId, selectedPage, setCropModule]);

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
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
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
            <div className="text-[11px] font-semibold text-cyan-400 mb-0.5">2. Full Viewport</div>
            <div className="text-[10px] text-slate-400">High-res canvas & space overlay</div>
          </div>
          <div className="p-3 bg-[#131720] border border-[#242A38] rounded-lg">
            <div className="text-[11px] font-semibold text-cyan-400 mb-0.5">3. Print Output</div>
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
                ? "bg-[#181D27] text-slate-200 border-[#2E3648] hover:bg-slate-800"
                : "bg-cyan-950/70 text-cyan-300 border-cyan-600/60 ring-1 ring-cyan-500/30"
            }`}
            title="Toggle between Original Scan and Cleaned Print View (Shortcut: Press O or Hold Space)"
          >
            {isViewingOriginal ? (
              <>
                <Sparkles size={14} className="text-cyan-400" />
                <span>Show Edited</span>
              </>
            ) : (
              <>
                <Eye size={14} className="text-cyan-400" />
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
                ? "bg-cyan-600 text-white border-cyan-500"
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
            onLoad={(e) => {
              setNaturalSize({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              });
            }}
            className="max-h-[calc(100vh-14rem)] max-w-full object-contain rounded shadow-2xl transition-all duration-150 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] border border-slate-800"
            draggable={false}
          />

          {/* Alignment Drafting Grid Overlay */}
          {showGrid && (
            <div 
              className="absolute inset-0 pointer-events-none rounded border border-cyan-500/40 overflow-hidden shadow-inner"
              style={{
                backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(6, 182, 212, 0.35) 28px)",
                backgroundSize: "100% 28px",
              }}
            />
          )}

          {/* Interactive Crop & Split Overlay */}
          {cropModule?.enabled && (
            <div
              ref={overlayRef}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              className="absolute inset-0 select-none pointer-events-auto"
            >
              {/* Dimmed backdrop outside crop area */}
              {/* Top */}
              <div
                className="absolute top-0 left-0 right-0 bg-black/60 pointer-events-none"
                style={{ height: `${cropModule.cropBox.y1 * 100}%` }}
              />
              {/* Bottom */}
              <div
                className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none"
                style={{ top: `${cropModule.cropBox.y2 * 100}%` }}
              />
              {/* Left */}
              <div
                className="absolute left-0 bg-black/60 pointer-events-none"
                style={{
                  top: `${cropModule.cropBox.y1 * 100}%`,
                  bottom: `${(1 - cropModule.cropBox.y2) * 100}%`,
                  width: `${cropModule.cropBox.x1 * 100}%`,
                }}
              />
              {/* Right */}
              <div
                className="absolute right-0 bg-black/60 pointer-events-none"
                style={{
                  top: `${cropModule.cropBox.y1 * 100}%`,
                  bottom: `${(1 - cropModule.cropBox.y2) * 100}%`,
                  left: `${cropModule.cropBox.x2 * 100}%`,
                }}
              />

              {/* Active Crop Box with High-Contrast Dual-Layer Border */}
              <div
                className="absolute border-2 border-dashed border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_0_15px_rgba(245,158,11,0.35)]"
                style={{
                  top: `${cropModule.cropBox.y1 * 100}%`,
                  left: `${cropModule.cropBox.x1 * 100}%`,
                  width: `${(cropModule.cropBox.x2 - cropModule.cropBox.x1) * 100}%`,
                  height: `${(cropModule.cropBox.y2 - cropModule.cropBox.y1) * 100}%`,
                }}
              >


                {/* Internal Page Badges (Spread Mode) */}
                {isSpreadCut && (
                  <>
                    {/* Left Page Size Badge */}
                    <div className="absolute top-1.5 left-1.5 bg-slate-950/85 border border-amber-400/70 text-amber-300 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col">
                      <span className="text-amber-400 font-bold">P1 (LEFT)</span>
                      <div className="text-slate-100 font-bold text-[9px]">
                        {leftPageWidthMm} × {currentCropHeightMm} mm
                      </div>
                    </div>

                    {/* Right Page Size Badge */}
                    <div className="absolute top-1.5 right-1.5 bg-slate-950/85 border border-amber-400/70 text-amber-300 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col items-end text-right">
                      <span className="text-amber-400 font-bold">P2 (RIGHT)</span>
                      <div className="text-slate-100 font-bold text-[9px]">
                        {rightPageWidthMm} × {currentCropHeightMm} mm
                      </div>
                    </div>
                  </>
                )}

                {/* High-Contrast Corner Handles */}
                <div
                  onPointerDown={(e) => handleCropPointerDown("nw", e)}
                  className="absolute -top-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nwse-resize hover:scale-125 hover:bg-amber-300 transition-transform"
                  title="Drag to resize top-left margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("ne", e)}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nesw-resize hover:scale-125 hover:bg-amber-300 transition-transform"
                  title="Drag to resize top-right margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("sw", e)}
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nesw-resize hover:scale-125 hover:bg-amber-300 transition-transform"
                  title="Drag to resize bottom-left margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("se", e)}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nwse-resize hover:scale-125 hover:bg-amber-300 transition-transform"
                  title="Drag to resize bottom-right margin"
                />

                {/* High-Contrast Edge Handles */}
                <div
                  onPointerDown={(e) => handleCropPointerDown("n", e)}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400 border-2 border-black rounded shadow-md cursor-ns-resize hover:scale-110 hover:bg-amber-300 transition-transform"
                  title="Drag to resize top margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("s", e)}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400 border-2 border-black rounded shadow-md cursor-ns-resize hover:scale-110 hover:bg-amber-300 transition-transform"
                  title="Drag to resize bottom margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("w", e)}
                  className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-amber-400 border-2 border-black rounded shadow-md cursor-ew-resize hover:scale-110 hover:bg-amber-300 transition-transform"
                  title="Drag to resize left margin"
                />
                <div
                  onPointerDown={(e) => handleCropPointerDown("e", e)}
                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-amber-400 border-2 border-black rounded shadow-md cursor-ew-resize hover:scale-110 hover:bg-amber-300 transition-transform"
                  title="Drag to resize right margin"
                />

                {/* In Spread Mode: High-Contrast Spine Split Seam */}
                {isSpreadCut && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: `${cropModule.splitPos * 100}%` }}
                  >
                    {/* Dark shadow backing for 100% visibility against white scans */}
                    <div className="absolute top-0 bottom-0 -ml-[2px] w-[4px] bg-black/75 shadow-sm" />
                    {/* Vivid Amber 2px dashed seam line */}
                    <div className="absolute top-0 bottom-0 -ml-[1px] w-[2px] border-l-2 border-dashed border-amber-400 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" />

                    {/* Top Anchor Notch */}
                    <div className="absolute top-0 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-b border-x border-b border-black shadow-md flex items-center justify-center pointer-events-none whitespace-nowrap">
                      <span>▼</span>
                    </div>

                    {/* Center Draggable Seam Grip Pill */}
                    <div
                      onPointerDown={(e) => handleCropPointerDown("spine", e)}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-black text-[11px] shadow-[0_4px_18px_rgba(0,0,0,0.85)] border-2 border-black ring-2 ring-amber-400/80 cursor-ew-resize pointer-events-auto flex items-center justify-center whitespace-nowrap select-none hover:scale-105 active:scale-95 transition-all"
                      title="Drag to position the spine split line between left and right pages"
                    >
                      <span>{(cropModule.splitPos * 100).toFixed(1)}%</span>
                    </div>

                    {/* Bottom Anchor Notch */}
                    <div className="absolute bottom-0 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-t border-x border-t border-black shadow-md flex items-center justify-center pointer-events-none whitespace-nowrap">
                      <span>▲</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
