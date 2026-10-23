"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { IconBookStudio, IconHandPan } from "@/components/shared/StudioIcons";
import { BookStudioPage, CropModuleConfig, BleedModuleConfig, CropBox } from "@/types/book_studio";
import { pxToMmAtDpi, type LengthUnit } from "@/lib/units";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { PageCanvas } from "./PageCanvas";
import type { HistoryEntry } from "@/hooks/useBookHistory";

interface BookWorkspaceProps {
  pages: BookStudioPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string) => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  rotatePage: (pageId: string, delta?: number) => void;
  sessionId: string | null;
  unit?: LengthUnit;
  showGrid?: boolean;
  gridColor?: string;
  eyedropperActive?: boolean;
  onPickColor?: (hex: string) => void;
  straightenActive?: boolean;
  onApplyStraightenAngle?: (deltaAngle: number) => void;
  onToggleStraighten?: () => void;
  maskToolActive?: boolean;
  onToggleMaskTool?: () => void;
  onToggleCropTool?: () => void;
  onApplyMaskBox?: (box: CropBox) => void;
  onRemoveMaskBox?: (maskId: string) => void;
  onToggleGrid?: () => void;
  cropModule?: CropModuleConfig;
  bleedModule?: BleedModuleConfig;
  setCropModule?: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onRestoreOriginal?: () => void;
  history?: HistoryEntry[];
  currentHistoryIndex?: number;
  onSelectHistoryStep?: (index: number) => void;
  shortcuts?: Record<string, string>;
  shortcutLabels?: Record<string, string>;
}

export function BookWorkspace({
  pages, selectedPageId, setSelectedPageId, getThumbnailUrl, rotatePage,
  sessionId, unit = "mm", showGrid = false, gridColor = "#06b6d4",
  eyedropperActive = false, onPickColor,
  straightenActive = false, onApplyStraightenAngle, onToggleStraighten,
  maskToolActive = false, onToggleMaskTool, onToggleCropTool, onApplyMaskBox, onRemoveMaskBox,
  onToggleGrid,
  cropModule, bleedModule, setCropModule,
  onUndo, canUndo, onRedo, canRedo, onRestoreOriginal,
  history, currentHistoryIndex, onSelectHistoryStep, shortcuts = {}, shortcutLabels = {},
}: BookWorkspaceProps) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [showSplitSizes, setShowSplitSizes] = useState<boolean>(true);
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
    if (naturalSize) return pxToMmAtDpi(naturalSize.w, 150);
    return 297.0;
  }, [selectedPage, naturalSize]);

  const pageBaseHeightMm = useMemo(() => {
    if (selectedPage?.height_mm) return selectedPage.height_mm;
    if (selectedPage?.orig_height_mm) return selectedPage.orig_height_mm;
    if (naturalSize) return pxToMmAtDpi(naturalSize.h, 150);
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

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(4.0, Math.round((z + 0.2) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.4, Math.round((z - 0.2) * 100) / 100));
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

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
      if (e.ctrlKey || e.metaKey) {
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
    if (straightenActive || maskToolActive) return;
    if (e.button === 1 || (e.button === 0 && (isPanMode || zoom > 1.0 || e.altKey))) {
      e.preventDefault();
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - startPanRef.current.x, y: e.clientY - startPanRef.current.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleCropPointerDown = (handle: string, e: React.PointerEvent) => {
    if (isPanMode) return;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");
      let keyName = e.key.toLowerCase();
      if (keyName === " ") keyName = "space";
      else if (keyName === "arrowleft") keyName = "left";
      else if (keyName === "arrowright") keyName = "right";
      else if (keyName === "arrowup") keyName = "up";
      else if (keyName === "arrowdown") keyName = "down";
      parts.push(keyName);
      const combo = parts.join("+");

      const zoomInShortcut = shortcuts.zoom_in || "=";
      const zoomOutShortcut = shortcuts.zoom_out || "-";
      const zoomResetShortcut = shortcuts.zoom_reset || "ctrl+0";
      const panShortcut = shortcuts.pan || "h";
      const prevShortcut = shortcuts.prev_page || "[";
      const nextShortcut = shortcuts.next_page || "]";
      const toggleOrigShortcut = shortcuts.toggle_original || "o";

      // Zoom In: configured shortcut or standard + / = / Ctrl+=
      if (combo === zoomInShortcut || combo === "=" || combo === "shift++" || combo === "+" || combo === "ctrl+=" || combo === "ctrl+shift++") {
        e.preventDefault();
        zoomIn();
        return;
      }
      // Zoom Out: configured shortcut or standard - / Ctrl+-
      if (combo === zoomOutShortcut || combo === "-" || combo === "ctrl+-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      // Zoom Reset: configured shortcut or Ctrl+0
      if (combo === zoomResetShortcut || (e.ctrlKey && (e.key === "0" || e.code === "Digit0"))) {
        e.preventDefault();
        zoomReset();
        return;
      }
      // Pan / Hand Tool toggle
      if (combo === panShortcut) {
        e.preventDefault();
        setIsPanMode((p) => !p);
        return;
      }

      // When in Pan mode or zoomed in with Shift+Arrows, allow keyboard nudging of pan
      if (isPanMode && (keyName === "left" || keyName === "right" || keyName === "up" || keyName === "down")) {
        e.preventDefault();
        const step = 40;
        setPan((prev) => ({
          x: prev.x + (keyName === "left" ? step : keyName === "right" ? -step : 0),
          y: prev.y + (keyName === "up" ? step : keyName === "down" ? -step : 0),
        }));
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsHoldingSpace(true);
      } else if (combo === toggleOrigShortcut) {
        e.preventDefault();
        setIsLockedOriginal((prev) => !prev);
      } else if (combo === prevShortcut || (!isPanMode && keyName === "left")) {
        e.preventDefault();
        goToPrevPage();
      } else if (combo === nextShortcut || (!isPanMode && keyName === "right")) {
        e.preventDefault();
        goToNextPage();
      }
      // Note: 'r' (Rotate 90° CW) is handled centrally by useBookShortcuts in useBookStudioState
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setIsHoldingSpace(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [goToNextPage, goToPrevPage, zoomIn, zoomOut, zoomReset, isPanMode, shortcuts]);

  if (!sessionId || pages.length === 0) {
    return (
      <div className="h-full bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col items-center justify-center p-8 text-center select-none">
        <div
          className="w-14 h-14 rounded-2xl bg-[#131720] border border-[#242A38] flex items-center justify-center mb-3"
          style={{ color: "var(--app-accent, #f59e0b)" }}
        >
          <IconBookStudio size={28} />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">Book Studio Ready</h3>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Drop or browse a book PDF in the left panel to crop, split spreads, deskew, and prepare print-ready pages.
        </p>
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
    <div ref={viewportRef} className={`flex flex-col h-full bg-[#181D27] rounded-xl border border-[#242A38] overflow-hidden select-none relative ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""}`}>
      <WorkspaceToolbar
        selectedIdx={selectedIdx}
        totalPages={pages.length}
        isViewingOriginal={isViewingOriginal}
        showSplitSizes={showSplitSizes}
        cropEnabled={Boolean(cropModule?.enabled)}
        straightenActive={straightenActive}
        maskToolActive={maskToolActive}
        showGrid={showGrid}
        onPrev={goToPrevPage}
        onNext={goToNextPage}
        onToggleOriginal={() => setIsLockedOriginal((p) => !p)}
        onToggleSplitSizes={() => setShowSplitSizes((p) => !p)}
        onToggleCropTool={
          onToggleCropTool ??
          (setCropModule
            ? () => setCropModule((prev) => ({ ...prev, enabled: !prev.enabled }))
            : undefined)
        }
        onToggleStraighten={onToggleStraighten}
        onToggleMaskTool={onToggleMaskTool}
        onToggleGrid={onToggleGrid}
        onRotate={(d) => rotatePage(selectedPage.id, d)}
        onUndo={onUndo}
        canUndo={canUndo}
        onRedo={onRedo}
        canRedo={canRedo}
        onRestoreOriginal={onRestoreOriginal}
        history={history}
        currentHistoryIndex={currentHistoryIndex}
        onSelectHistoryStep={onSelectHistoryStep}
        shortcutLabels={shortcutLabels}
      />

      <PageCanvas
        containerRef={containerRef}
        overlayRef={overlayRef}
        imageSrc={getThumbnailUrl(selectedPage.id, !isViewingOriginal, 150)}
        imageAlt={`Page ${selectedIdx + 1}`}
        zoom={zoom}
        pan={pan}
        isPanning={isPanning}
        isPanMode={isPanMode}
        unit={unit}
        showGrid={showGrid}
        gridColor={gridColor}
        showSplitSizes={showSplitSizes}
        eyedropperActive={eyedropperActive}
        onPickColor={onPickColor}
        straightenActive={straightenActive}
        onApplyStraightenAngle={onApplyStraightenAngle}
        maskToolActive={maskToolActive}
        pageMasks={isViewingOriginal ? [] : (selectedPage.masks || [])}
        onApplyMaskBox={onApplyMaskBox}
        onRemoveMaskBox={onRemoveMaskBox}
        cropModule={cropModule}
        bleedModule={bleedModule}
        splitLines={splitLines}

        hideCutLines={false}
        pageBaseWidthMm={pageBaseWidthMm}
        pageBaseHeightMm={pageBaseHeightMm}
        currentCropHeightMm={currentCropHeightMm}
        currentCropWidthMm={currentCropWidthMm}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onImageLoad={(w, h) => setNaturalSize({ w, h })}
        onCropPointerDown={handleCropPointerDown}
        activeDrag={activeCropDrag}
      />

      {/* Floating Bottom Zoom & Pan HUD Bar */}
      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1 px-2 py-1 rounded-full bg-[#131720]/95 backdrop-blur-md border border-[#283040] shadow-xl">
        <button
          type="button"
          onClick={() => setIsPanMode((p) => !p)}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            isPanMode
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800/70"
          }`}
          style={isPanMode ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          title={`Pan / Hand Tool (${shortcutLabels.pan || "H"} or Middle-Click Drag)`}
        >
          <IconHandPan size={13} />
        </button>

        <div className="h-3.5 w-px bg-[#242A38]" />

        <button
          type="button"
          onClick={zoomOut}
          className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          title={`Zoom Out (${shortcutLabels.zoom_out || "-"})`}
        >
          <ZoomOut size={13} />
        </button>

        <button
          type="button"
          onClick={zoomReset}
          className="text-[11px] font-mono font-semibold text-slate-300 hover:text-white px-2 py-0.5 min-w-[44px] text-center rounded-full hover:bg-slate-800/70 transition-colors cursor-pointer"
          title={`Reset Zoom to 100% (${shortcutLabels.zoom_reset || "Ctrl+0"})`}
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={zoomIn}
          className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          title={`Zoom In (${shortcutLabels.zoom_in || "="})`}
        >
          <ZoomIn size={13} />
        </button>

        <div className="h-3.5 w-px bg-[#242A38]" />

        <button
          type="button"
          onClick={toggleFullscreen}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            isFullscreen
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800/70"
          }`}
          style={isFullscreen ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}
