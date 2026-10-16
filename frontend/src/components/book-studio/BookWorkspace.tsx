"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { BookStudioPage, CropModuleConfig, CropBox } from "@/types/book_studio";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { PageCanvas } from "./PageCanvas";
import type { HistoryEntry } from "@/hooks/useBookHistory";

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
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onRestoreOriginal?: () => void;
  history?: HistoryEntry[];
  currentHistoryIndex?: number;
  onSelectHistoryStep?: (index: number) => void;
  shortcutLabels?: Record<string, string>;
}

export function BookWorkspace({
  pages, selectedPageId, setSelectedPageId, getThumbnailUrl, rotatePage,
  deletePage, sessionId, showGrid = false, cropModule, setCropModule,
  onUndo, canUndo, onRedo, canRedo, onRestoreOriginal,
  history, currentHistoryIndex, onSelectHistoryStep, shortcutLabels,
}: BookWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeCropDrag, setActiveCropDrag] = useState<string | null>(null);
  const cropDragStartRef = useRef<{ relX: number; relY: number; box: CropBox } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLockedOriginal, setIsLockedOriginal] = useState<boolean>(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState<boolean>(false);
  const isViewingOriginal = isLockedOriginal || isHoldingSpace;
  const selectedIdx = pages.findIndex((p) => p.id === selectedPageId);
  const selectedPage = selectedIdx >= 0 ? pages[selectedIdx] : null;
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
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
    if (overlayRef.current && cropModule) {
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cropDragStartRef.current = {
          relX: (e.clientX - rect.left) / rect.width,
          relY: (e.clientY - rect.top) / rect.height,
          box: { ...cropModule.cropBox },
        };
      }
    }
  };

  useEffect(() => {
    if (!activeCropDrag) return;
    const onMove = (e: PointerEvent) => {
      if (!overlayRef.current || !setCropModule) return;
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      if (activeCropDrag === "move") {
        if (!cropDragStartRef.current) return;
        const { relX: sx, relY: sy, box: b } = cropDragStartRef.current;
        const w = b.x2 - b.x1, h = b.y2 - b.y1;
        const nx1 = Math.max(0, Math.min(1 - w, b.x1 + relX - sx));
        const ny1 = Math.max(0, Math.min(1 - h, b.y1 + relY - sy));
        setCropModule((prev) => ({
          ...prev,
          cropBox: {
            x1: Math.round(nx1 * 1000) / 1000, y1: Math.round(ny1 * 1000) / 1000,
            x2: Math.round((nx1 + w) * 1000) / 1000, y2: Math.round((ny1 + h) * 1000) / 1000,
          },
        }));
        return;
      }

      setCropModule((prev) => {
        const box = { ...prev.cropBox };
        const prevLines = prev.splitLines.map((l) => ({ ...l }));
        let lines = prevLines;
        let sPos = prev.splitPos;

        const spineIdx = activeCropDrag === "spine" ? 0
          : activeCropDrag.startsWith("spine-") ? Number(activeCropDrag.slice(6)) : -1;
        if (spineIdx >= 0 && spineIdx < prevLines.length) {
          const target = prevLines[spineIdx];
          const isH = target.direction === "horizontal";
          const bx = Math.max(0.02, box.x2 - box.x1);
          const by = Math.max(0.02, box.y2 - box.y1);
          const relInBox = isH ? (relY - box.y1) / by : (relX - box.x1) / bx;
          const v = Math.round(Math.max(0.01, Math.min(0.99, relInBox)) * 1000) / 1000;
          lines = prevLines.map((ln, j) => (j === spineIdx ? { ...ln, pos: v } : ln));
          sPos = lines[0]?.pos ?? prev.splitPos;
        } else {
          const pbW = Math.max(0.02, prev.cropBox.x2 - prev.cropBox.x1), pbH = Math.max(0.02, prev.cropBox.y2 - prev.cropBox.y1);
          const prevAbs = prevLines.map((ln) => ln.direction === "horizontal" ? prev.cropBox.y1 + ln.pos * pbH : prev.cropBox.x1 + ln.pos * pbW);
          if (activeCropDrag === "w" || activeCropDrag === "nw" || activeCropDrag === "sw") box.x1 = Math.min(relX, box.x2 - 0.02);
          if (activeCropDrag === "e" || activeCropDrag === "ne" || activeCropDrag === "se") box.x2 = Math.max(relX, box.x1 + 0.02);
          if (activeCropDrag === "n" || activeCropDrag === "nw" || activeCropDrag === "ne") box.y1 = Math.min(relY, box.y2 - 0.02);
          if (activeCropDrag === "s" || activeCropDrag === "sw" || activeCropDrag === "se") box.y2 = Math.max(relY, box.y1 + 0.02);
          const nbW = Math.max(0.02, box.x2 - box.x1), nbH = Math.max(0.02, box.y2 - box.y1);
          lines = prevLines.map((ln, j) => ({
            ...ln,
            pos: Math.round(Math.max(0.01, Math.min(0.99, ln.direction === "horizontal" ? (prevAbs[j] - box.y1) / nbH : (prevAbs[j] - box.x1) / nbW)) * 1000) / 1000,
          }));
          sPos = lines[0]?.pos ?? prev.splitPos;
        }
        return {
          ...prev,
          cropBox: {
            x1: Math.round(box.x1 * 1000) / 1000, y1: Math.round(box.y1 * 1000) / 1000,
            x2: Math.round(box.x2 * 1000) / 1000, y2: Math.round(box.y2 * 1000) / 1000,
          },
          splitPos: Math.round(sPos * 1000) / 1000, splitLines: lines,
        };
      });
    };
    const onUp = () => { setActiveCropDrag(null); cropDragStartRef.current = null; };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [activeCropDrag, setCropModule]);
  const handleCropPointerMove = () => {};
  const handleCropPointerUp = () => {};
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
        onUndo={onUndo} canUndo={canUndo} onRedo={onRedo} canRedo={canRedo}
        onRestoreOriginal={onRestoreOriginal} history={history} currentHistoryIndex={currentHistoryIndex}
        onSelectHistoryStep={onSelectHistoryStep} shortcutLabels={shortcutLabels}
      />
      <PageCanvas
        containerRef={containerRef} overlayRef={overlayRef} imageSrc={getThumbnailUrl(selectedPage.id, !isViewingOriginal, 150)}
        imageAlt={`Page ${selectedIdx + 1}`} zoom={zoom} pan={pan} isPanning={isPanning} showGrid={showGrid}
        cropModule={cropModule} splitLines={splitLines} hideCutLines={false}
        currentCropHeightMm={currentCropHeightMm} currentCropWidthMm={currentCropWidthMm}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onImageLoad={(w, h) => setNaturalSize({ w, h })}
        onCropPointerDown={handleCropPointerDown} onCropPointerMove={handleCropPointerMove} onCropPointerUp={handleCropPointerUp} activeDrag={activeCropDrag}
      />
    </div>
  );
}
