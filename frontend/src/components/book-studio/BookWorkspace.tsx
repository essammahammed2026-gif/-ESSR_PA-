"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { BookStudioPage, CropModuleConfig } from "@/types/book_studio";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { PageCanvas } from "./PageCanvas";

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
  pages, selectedPageId, setSelectedPageId, getThumbnailUrl, rotatePage,
  deletePage, sessionId, showGrid = false, cropModule, setCropModule,
}: BookWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeCropDrag, setActiveCropDrag] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLockedOriginal, setIsLockedOriginal] = useState<boolean>(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState<boolean>(false);
  const isViewingOriginal = isLockedOriginal || isHoldingSpace;
  const selectedIdx = pages.findIndex((p) => p.id === selectedPageId);
  const selectedPage = selectedIdx >= 0 ? pages[selectedIdx] : null;
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const isSelectedPageSplit = Boolean(
    selectedPage && (selectedPage.half === "left" || selectedPage.half === "right" ||
      selectedPage.slice_box != null || selectedPage.parent_page_id != null ||
      (selectedPage.half && (selectedPage.half.startsWith("col_") || selectedPage.half.startsWith("row_"))))
  );
  const splitLines = cropModule?.splitLines ?? [];
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
  const goToNextPage = useCallback(() => {
    if (selectedIdx < pages.length - 1) setSelectedPageId(pages[selectedIdx + 1].id);
  }, [selectedIdx, pages, setSelectedPageId]);
  const goToPrevPage = useCallback(() => {
    if (selectedIdx > 0) setSelectedPageId(pages[selectedIdx - 1].id);
  }, [selectedIdx, pages, setSelectedPageId]);
  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, [selectedPageId]);
  const toggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try { await el.requestFullscreen(); setIsFullscreen(true); }
      catch (err) { console.error("Fullscreen request failed:", err); }
    } else {
      try { await document.exitFullscreen(); setIsFullscreen(false); }
      catch (err) { console.error("Exit fullscreen failed:", err); }
    }
  }, []);
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
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
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (zoom > 1.0 || e.altKey)) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - startPanRef.current.x, y: e.clientY - startPanRef.current.y });
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleCropPointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
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
      const prevLines = prev.splitLines.map((l) => ({ ...l }));
      let lines = prevLines;
      let sPos = prev.splitPos;

      const spineIdx = activeCropDrag === "spine" ? 0
        : activeCropDrag.startsWith("spine-") ? Number(activeCropDrag.slice(6)) : -1;
      if (spineIdx >= 0 && spineIdx < prevLines.length) {
        // Dragging a cut line along its own axis, relative to the crop box
        const target = prevLines[spineIdx];
        const isHorizontal = target.direction === "horizontal";
        const boxX = Math.max(0.05, box.x2 - box.x1);
        const boxY = Math.max(0.05, box.y2 - box.y1);
        const relInBox = isHorizontal ? (relY - box.y1) / boxY : (relX - box.x1) / boxX;
        const v = Math.round(Math.max(0.01, Math.min(0.99, relInBox)) * 1000) / 1000;
        lines = prevLines.map((ln, j) => (j === spineIdx ? { ...ln, pos: v } : ln));
        sPos = lines[0]?.pos ?? prev.splitPos;
      } else {
        // Outer margin drag: each cut line stays anchored to the physical page content
        const prevBoxW = Math.max(0.05, prev.cropBox.x2 - prev.cropBox.x1);
        const prevBoxH = Math.max(0.05, prev.cropBox.y2 - prev.cropBox.y1);
        const prevAbs = prevLines.map((ln) => ln.direction === "horizontal"
          ? prev.cropBox.y1 + ln.pos * prevBoxH
          : prev.cropBox.x1 + ln.pos * prevBoxW);

        if (activeCropDrag === "w") box.x1 = Math.min(relX, box.x2 - 0.05);
        else if (activeCropDrag === "e") box.x2 = Math.max(relX, box.x1 + 0.05);
        else if (activeCropDrag === "n") box.y1 = Math.min(relY, box.y2 - 0.05);
        else if (activeCropDrag === "s") box.y2 = Math.max(relY, box.y1 + 0.05);
        else if (activeCropDrag === "nw") { box.x1 = Math.min(relX, box.x2 - 0.05); box.y1 = Math.min(relY, box.y2 - 0.05); }
        else if (activeCropDrag === "ne") { box.x2 = Math.max(relX, box.x1 + 0.05); box.y1 = Math.min(relY, box.y2 - 0.05); }
        else if (activeCropDrag === "sw") { box.x1 = Math.min(relX, box.x2 - 0.05); box.y2 = Math.max(relY, box.y1 + 0.05); }
        else if (activeCropDrag === "se") { box.x2 = Math.max(relX, box.x1 + 0.05); box.y2 = Math.max(relY, box.y1 + 0.05); }
        // Anchor preservation: cut lines stay at the physical page content!
        const newBoxW = Math.max(0.05, box.x2 - box.x1);
        const newBoxH = Math.max(0.05, box.y2 - box.y1);
        lines = prevLines.map((ln, j) => {
          const abs = prevAbs[j];
          const rel = ln.direction === "horizontal" ? (abs - box.y1) / newBoxH : (abs - box.x1) / newBoxW;
          return { ...ln, pos: Math.round(Math.max(0.01, Math.min(0.99, rel)) * 1000) / 1000 };
        });
        sPos = lines[0]?.pos ?? prev.splitPos;
      }
      return {
        ...prev,
        cropBox: {
          x1: Math.round(box.x1 * 1000) / 1000, y1: Math.round(box.y1 * 1000) / 1000,
          x2: Math.round(box.x2 * 1000) / 1000, y2: Math.round(box.y2 * 1000) / 1000,
        },
        splitPos: Math.round(sPos * 1000) / 1000,
        splitLines: lines,
      };
    });
  };
  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (activeCropDrag) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setActiveCropDrag(null);
    }
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault(); setZoom(1.0); setPan({ x: 0, y: 0 }); return;
      }
      if (e.code === "Space") { e.preventDefault(); setIsHoldingSpace(true); }
      else if (e.key === "o" || e.key === "O") { e.preventDefault(); setIsLockedOriginal((prev) => !prev); }
      else if (e.key === "ArrowLeft" || e.key === "[") { e.preventDefault(); goToPrevPage(); }
      else if (e.key === "ArrowRight" || e.key === "]") { e.preventDefault(); goToNextPage(); }
      else if ((e.key === "r" || e.key === "R") && selectedPage) {
        e.preventDefault();
        rotatePage(selectedPage.id, e.shiftKey ? -90 : 90);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setIsHoldingSpace(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
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
    <div ref={viewportRef} className={`flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden shadow-sm select-none relative ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""}`}>
      <WorkspaceToolbar
        selectedIdx={selectedIdx} totalPages={pages.length} isViewingOriginal={isViewingOriginal} zoom={zoom} isFullscreen={isFullscreen}
        onPrev={goToPrevPage} onNext={goToNextPage} onToggleOriginal={() => setIsLockedOriginal((p) => !p)}
        onRotate={(d) => rotatePage(selectedPage.id, d)} onZoomOut={() => setZoom((z) => Math.max(0.4, z - 0.2))}
        onZoomIn={() => setZoom((z) => Math.min(4.0, z + 0.2))} onZoomReset={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
        onToggleFullscreen={toggleFullscreen} onDelete={() => deletePage(selectedPage.id)}
      />
      <PageCanvas
        containerRef={containerRef} overlayRef={overlayRef} imageSrc={getThumbnailUrl(selectedPage.id, !isViewingOriginal, 150)}
        imageAlt={`Page ${selectedIdx + 1}`} zoom={zoom} pan={pan} isPanning={isPanning} showGrid={showGrid}
        cropModule={cropModule} splitLines={splitLines} hideCutLines={isSelectedPageSplit}
        currentCropHeightMm={currentCropHeightMm} currentCropWidthMm={currentCropWidthMm}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onImageLoad={(w, h) => setNaturalSize({ w, h })}
        onCropPointerDown={handleCropPointerDown} onCropPointerMove={handleCropPointerMove} onCropPointerUp={handleCropPointerUp}
      />
    </div>
  );
}
