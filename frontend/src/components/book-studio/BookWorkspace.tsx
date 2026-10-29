"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BookOpen, MoveHorizontal, File } from "lucide-react";
import { IconBookStudio } from "@/components/shared/StudioIcons";
import {
  BookStudioPage,
  CropModuleConfig,
  BleedModuleConfig,
  CleanupModuleConfig,
  CropBox,
  SplitLine,
  FocusedModuleId,
} from "@/types/book_studio";
import { pxToMmAtDpi, type LengthUnit } from "@/lib/units";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { PageCanvas } from "./PageCanvas";

interface BookWorkspaceProps {
  pages: BookStudioPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string) => void;
  getThumbnailUrl: (pageId: string, isClean: boolean, dpi?: number) => string;
  rotatePage: (pageId: string, delta?: number) => void;
  sessionId: string | null;
  unit?: LengthUnit;
  focusedModule?: FocusedModuleId | null;
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
  cleanupModule?: CleanupModuleConfig;
  setCropModule?: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  setCleanupModule?: React.Dispatch<React.SetStateAction<CleanupModuleConfig>>;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  shortcuts?: Record<string, string>;
  shortcutLabels?: Record<string, string>;
  isDeckOpen?: boolean;
  onToggleDeck?: () => void;
  isDualPage?: boolean;
  onToggleDualPage?: () => void;
  pageCrops?: Record<string, { cropBox: CropBox; splitPos: number; splitLines: SplitLine[] }>;
  focusCropPage?: (pageId: string, visibleIds: string[]) => void;
}

export function BookWorkspace({
  pages, selectedPageId, setSelectedPageId, getThumbnailUrl,
  sessionId, unit = "mm", focusedModule = null, showGrid = false, gridColor = "#06b6d4",
  eyedropperActive = false, onPickColor,
  straightenActive = false, onApplyStraightenAngle,
  maskToolActive = false, onApplyMaskBox, onRemoveMaskBox,
  cropModule, bleedModule, cleanupModule, setCropModule, setCleanupModule,
  onUndo, canUndo, onRedo, canRedo,
  shortcuts = {}, shortcutLabels = {},
  isDeckOpen = false, onToggleDeck,
  isDualPage: controlledIsDualPage,
  onToggleDualPage,
  pageCrops,
  focusCropPage,
}: BookWorkspaceProps) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cropOverlayElRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [showSplitSizes] = useState<boolean>(true);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeCropDrag, setActiveCropDrag] = useState<string | null>(null);
  const cropDragStartRef = useRef<{ relX: number; relY: number; box: CropBox } | null>(null);
  const [activeMaskDrag, setActiveMaskDrag] = useState<string | null>(null);
  const maskDragStartRef = useRef<{ relX: number; relY: number; box: CropBox } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLockedOriginal, setIsLockedOriginal] = useState<boolean>(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState<boolean>(false);
  const [isSplitCurtain, setIsSplitCurtain] = useState<boolean>(false);
  const [curtainPos, setCurtainPos] = useState<number>(0.5);
  const [internalIsDualPage, setInternalIsDualPage] = useState<boolean>(false);
  const isDualPage = controlledIsDualPage ?? internalIsDualPage;
  const toggleDualPage = onToggleDualPage ?? (() => setInternalIsDualPage((p) => !p));
  const isViewingOriginal = isLockedOriginal || isHoldingSpace;
  const rawSelectedIdx = pages.findIndex((p) => p.id === selectedPageId);
  const selectedIdx = rawSelectedIdx >= 0 ? rawSelectedIdx : 0;
  const pairStartIdx = isDualPage ? Math.floor(selectedIdx / 2) * 2 : selectedIdx;
  const selectedPage = pairStartIdx >= 0 && pairStartIdx < pages.length ? pages[pairStartIdx] : (pages[0] ?? null);
  const secondaryPage = isDualPage && pairStartIdx + 1 < pages.length ? pages[pairStartIdx + 1] : null;

  const isDualLinked = (cropModule?.target.dualSides?.length ?? 2) >= 2;

  const primaryCropBox = selectedPage
    ? (pageCrops?.[selectedPage.id]?.cropBox ?? cropModule?.cropBox ?? { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 })
    : (cropModule?.cropBox ?? { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 });

  const secondaryCropBox = secondaryPage
    ? (pageCrops?.[secondaryPage.id]?.cropBox ??
        (isDualLinked
          ? (cropModule?.cropBox ?? { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 })
          : (secondaryPage.crop_box ? { x1: 0, y1: 0, x2: 1, y2: 1 } : { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 })))
    : undefined;

  // Per-mask visibility: each saved mask is hidden only when its own applied entry is toggled off.
  // The mask currently being edited (draft) is also hidden so the editable draft box sits on top.
  const visiblePageMasks = useMemo(() => {
    const masks = selectedPage?.masks || [];
    if (masks.length === 0) return masks;
    if (cleanupModule?.enabled === false) return [];
    const hiddenIds = new Set<string>();
    for (const e of cleanupModule?.appliedEntries || []) {
      if (e.visible === false) {
        const id = e.params?.maskBox?.id || (e.id.startsWith("mask_") ? e.id.slice(5) : null);
        if (id) hiddenIds.add(id);
      }
    }
    const editingMaskId = cleanupModule?.draftMaskBox?.id;
    if (editingMaskId) hiddenIds.add(editingMaskId);
    return masks.filter((m) => !hiddenIds.has(m.id));
  }, [selectedPage?.masks, cleanupModule?.appliedEntries, cleanupModule?.draftMaskBox?.id, cleanupModule?.enabled]);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const primarySplitLines = selectedPage
    ? (pageCrops?.[selectedPage.id]?.splitLines ?? cropModule?.splitLines ?? [])
    : (cropModule?.splitLines ?? []);

  const secondarySplitLines = secondaryPage
    ? (pageCrops?.[secondaryPage.id]?.splitLines ??
        (isDualLinked
          ? (cropModule?.splitLines ?? [])
          : []))
    : [];

  // Stable identity + bail-out on equal size: PageCanvas re-runs its cached-image check whenever this changes,
  // so a fresh object/callback each render caused an endless render loop (flicker) after remounting.
  const handleImageLoad = useCallback((w: number, h: number) => {
    setNaturalSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

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
    if (isDualPage) {
      const nextIdx = pairStartIdx + 2;
      if (nextIdx < pages.length) setSelectedPageId(pages[nextIdx].id);
    } else {
      if (selectedIdx < pages.length - 1) setSelectedPageId(pages[selectedIdx + 1].id);
    }
  }, [isDualPage, pairStartIdx, selectedIdx, pages, setSelectedPageId]);

  const goToPrevPage = useCallback(() => {
    if (isDualPage) {
      const prevIdx = pairStartIdx - 2;
      if (prevIdx >= 0) setSelectedPageId(pages[prevIdx].id);
    } else {
      if (selectedIdx > 0) setSelectedPageId(pages[selectedIdx - 1].id);
    }
  }, [isDualPage, pairStartIdx, selectedIdx, pages, setSelectedPageId]);

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

  const fitWidth = useCallback(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (container && overlay) {
      const containerW = container.clientWidth - 64;
      const baseImgW = overlay.getBoundingClientRect().width / zoom;
      const totalBaseW = isDualPage && secondaryPage ? baseImgW * 2 + 16 : baseImgW;
      if (totalBaseW > 0 && containerW > 0) {
        const nextZoom = Math.min(4.0, Math.max(0.4, Math.round((containerW / totalBaseW) * 100) / 100));
        setZoom(nextZoom);
        setPan({ x: 0, y: 0 });
        return;
      }
    }
    setZoom(1.45);
    setPan({ x: 0, y: 0 });
  }, [zoom, isDualPage, secondaryPage]);

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
    const el = viewportRef.current;
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
    // Dual mode renders the crop box over both pages: measure whichever page overlay was grabbed.
    const grabbed = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-crop-overlay]");
    cropOverlayElRef.current = grabbed ?? overlayRef.current;
    const overlayEl = cropOverlayElRef.current;
    const side = grabbed?.getAttribute("data-crop-overlay") === "secondary" ? "secondary" : "primary";

    if (isDualPage && secondaryPage && selectedPage && cropModule?.target.base === "current") {
      const isDualLinked = (cropModule.target.dualSides?.length ?? 2) >= 2;
      if (!isDualLinked) {
        if (side === "secondary" && cropModule.target.dualSides?.[0] !== "right") {
          focusCropPage?.(secondaryPage.id, [selectedPage.id, secondaryPage.id]);
          const secDraft = pageCrops?.[secondaryPage.id];
          setCropModule?.((prev) => ({
            ...prev,
            cropBox: secDraft?.cropBox ?? prev.cropBox,
            splitLines: secDraft?.splitLines ? secDraft.splitLines.map((l) => ({ ...l })) : prev.splitLines,
            splitPos: secDraft?.splitPos ?? prev.splitPos,
            target: { ...prev.target, dualSides: ["right"] },
          }));
        } else if (side === "primary" && cropModule.target.dualSides?.[0] !== "left") {
          focusCropPage?.(selectedPage.id, [selectedPage.id, secondaryPage.id]);
          const priDraft = pageCrops?.[selectedPage.id];
          setCropModule?.((prev) => ({
            ...prev,
            cropBox: priDraft?.cropBox ?? prev.cropBox,
            splitLines: priDraft?.splitLines ? priDraft.splitLines.map((l) => ({ ...l })) : prev.splitLines,
            splitPos: priDraft?.splitPos ?? prev.splitPos,
            target: { ...prev.target, dualSides: ["left"] },
          }));
        }
      }
    }

    const boxToUse = side === "secondary" ? (secondaryCropBox ?? cropModule?.cropBox) : (primaryCropBox ?? cropModule?.cropBox);

    if (overlayEl && boxToUse) {
      const rect = overlayEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cropDragStartRef.current = {
          relX: (e.clientX - rect.left) / rect.width,
          relY: (e.clientY - rect.top) / rect.height,
          box: { ...boxToUse },
        };
      }
    }
  };

  useEffect(() => {
    if (!activeCropDrag) return;
    const onMove = (e: PointerEvent) => {
      const overlayEl = cropOverlayElRef.current ?? overlayRef.current;
      if (!overlayEl || !setCropModule || !cropDragStartRef.current) return;
      const rect = overlayEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const { relX: sx, relY: sy, box: b } = cropDragStartRef.current;

      if (focusedModule === "split") {
        const spineIdx = activeCropDrag === "spine" ? 0
          : activeCropDrag.startsWith("spine-") ? Number(activeCropDrag.slice(6)) : -1;
        if (spineIdx >= 0) {
          setCropModule((prev) => {
            const prevLines = prev.splitLines.map((l) => ({ ...l }));
            if (spineIdx >= prevLines.length) return prev;
            const target = prevLines[spineIdx];
            const isH = target.direction === "horizontal";
            const relInPage = isH ? relY : relX;
            const v = Math.round(Math.max(0.01, Math.min(0.99, relInPage)) * 1000) / 1000;
            const lines = prevLines.map((ln, j) => (j === spineIdx ? { ...ln, pos: v } : ln));
            const sPos = lines[0]?.pos ?? prev.splitPos;
            return {
              ...prev,
              splitPos: Math.round(sPos * 1000) / 1000,
              splitLines: lines,
            };
          });
        }
        return;
      }

      if (activeCropDrag === "move") {
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
          const pbW = Math.max(0.02, b.x2 - b.x1), pbH = Math.max(0.02, b.y2 - b.y1);
          const prevAbs = prevLines.map((ln) => ln.direction === "horizontal" ? b.y1 + ln.pos * pbH : b.x1 + ln.pos * pbW);
          const lock = prev.aspectLock || "lock";
          const isLocked = lock === "lock" || lock === "all";

          if (isLocked) {
            let delta = 0;
            if (activeCropDrag === "w") {
              delta = relX - sx;
            } else if (activeCropDrag === "e") {
              delta = sx - relX;
            } else if (activeCropDrag === "n") {
              delta = relY - sy;
            } else if (activeCropDrag === "s") {
              delta = sy - relY;
            } else if (activeCropDrag === "nw") {
              const dx = relX - sx;
              const dy = relY - sy;
              delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            } else if (activeCropDrag === "ne") {
              const dx = sx - relX;
              const dy = relY - sy;
              delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            } else if (activeCropDrag === "sw") {
              const dx = relX - sx;
              const dy = sy - relY;
              delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            } else if (activeCropDrag === "se") {
              const dx = sx - relX;
              const dy = sy - relY;
              delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            }

            const minMargin = Math.min(b.x1, 1.0 - b.x2, b.y1, 1.0 - b.y2);
            const maxShrinkW = Math.max(0, (b.x2 - b.x1 - 0.02) / 2);
            const maxShrinkH = Math.max(0, (b.y2 - b.y1 - 0.02) / 2);
            const maxDelta = Math.min(maxShrinkW, maxShrinkH);
            const minDelta = -minMargin;
            const clampedDelta = Math.max(minDelta, Math.min(maxDelta, delta));

            box.x1 = b.x1 + clampedDelta;
            box.x2 = b.x2 - clampedDelta;
            box.y1 = b.y1 + clampedDelta;
            box.y2 = b.y2 - clampedDelta;
          } else {
            const dx = relX - sx;
            const dy = relY - sy;
            if (activeCropDrag === "w") {
              box.x1 = Math.max(0, Math.min(b.x2 - 0.02, b.x1 + dx));
            } else if (activeCropDrag === "e") {
              box.x2 = Math.min(1.0, Math.max(b.x1 + 0.02, b.x2 + dx));
            } else if (activeCropDrag === "n") {
              box.y1 = Math.max(0, Math.min(b.y2 - 0.02, b.y1 + dy));
            } else if (activeCropDrag === "s") {
              box.y2 = Math.min(1.0, Math.max(b.y1 + 0.02, b.y2 + dy));
            } else if (activeCropDrag === "nw") {
              box.x1 = Math.max(0, Math.min(b.x2 - 0.02, b.x1 + dx));
              box.y1 = Math.max(0, Math.min(b.y2 - 0.02, b.y1 + dy));
            } else if (activeCropDrag === "ne") {
              box.x2 = Math.min(1.0, Math.max(b.x1 + 0.02, b.x2 + dx));
              box.y1 = Math.max(0, Math.min(b.y2 - 0.02, b.y1 + dy));
            } else if (activeCropDrag === "sw") {
              box.x1 = Math.max(0, Math.min(b.x2 - 0.02, b.x1 + dx));
              box.y2 = Math.min(1.0, Math.max(b.y1 + 0.02, b.y2 + dy));
            } else if (activeCropDrag === "se") {
              box.x2 = Math.min(1.0, Math.max(b.x1 + 0.02, b.x2 + dx));
              box.y2 = Math.min(1.0, Math.max(b.y1 + 0.02, b.y2 + dy));
            }
          }

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
  }, [activeCropDrag, setCropModule, focusedModule]);

  const handleMaskPointerDown = (handle: string, e: React.PointerEvent) => {
    if (isPanMode) return;
    e.stopPropagation(); e.preventDefault();
    setActiveMaskDrag(handle);
    if (overlayRef.current && cleanupModule?.draftMaskBox) {
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const b = cleanupModule.draftMaskBox;
        maskDragStartRef.current = {
          relX: (e.clientX - rect.left) / rect.width,
          relY: (e.clientY - rect.top) / rect.height,
          box: {
            ...b,
            x1: Math.min(b.x1, b.x2),
            y1: Math.min(b.y1, b.y2),
            x2: Math.max(b.x1, b.x2),
            y2: Math.max(b.y1, b.y2),
          },
        };
      }
    }
  };

  useEffect(() => {
    if (!activeMaskDrag) return;
    const onMove = (e: PointerEvent) => {
      if (!overlayRef.current || !setCleanupModule || !maskDragStartRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const { relX: sx, relY: sy, box: b } = maskDragStartRef.current;
      const minX = Math.min(b.x1, b.x2);
      const maxX = Math.max(b.x1, b.x2);
      const minY = Math.min(b.y1, b.y2);
      const maxY = Math.max(b.y1, b.y2);

      if (activeMaskDrag === "move") {
        const w = maxX - minX;
        const h = maxY - minY;
        const nx1 = Math.max(0, Math.min(1 - w, minX + relX - sx));
        const ny1 = Math.max(0, Math.min(1 - h, minY + relY - sy));
        setCleanupModule((prev) => {
          if (!prev.draftMaskBox) return prev;
          return {
            ...prev,
            draftMaskBox: {
              ...prev.draftMaskBox,
              x1: Math.round(nx1 * 1000) / 1000,
              y1: Math.round(ny1 * 1000) / 1000,
              x2: Math.round((nx1 + w) * 1000) / 1000,
              y2: Math.round((ny1 + h) * 1000) / 1000,
            },
          };
        });
        return;
      }

      let x1 = minX;
      let x2 = maxX;
      let y1 = minY;
      let y2 = maxY;

      if (activeMaskDrag === "w" || activeMaskDrag === "nw" || activeMaskDrag === "sw") {
        x1 = Math.min(relX, maxX - 0.005);
      }
      if (activeMaskDrag === "e" || activeMaskDrag === "ne" || activeMaskDrag === "se") {
        x2 = Math.max(relX, minX + 0.005);
      }
      if (activeMaskDrag === "n" || activeMaskDrag === "nw" || activeMaskDrag === "ne") {
        y1 = Math.min(relY, maxY - 0.005);
      }
      if (activeMaskDrag === "s" || activeMaskDrag === "sw" || activeMaskDrag === "se") {
        y2 = Math.max(relY, minY + 0.005);
      }

      setCleanupModule((prev) => {
        if (!prev.draftMaskBox) return prev;
        return {
          ...prev,
          draftMaskBox: {
            ...prev.draftMaskBox,
            x1: Math.round(x1 * 1000) / 1000,
            y1: Math.round(y1 * 1000) / 1000,
            x2: Math.round(x2 * 1000) / 1000,
            y2: Math.round(y2 * 1000) / 1000,
          },
        };
      });
    };
    const onUp = () => { setActiveMaskDrag(null); maskDragStartRef.current = null; };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [activeMaskDrag, setCleanupModule]);

  const [activeSpineDrag, setActiveSpineDrag] = useState<string | null>(null);
  const spineDragStartRef = useRef<{ relX: number; relY: number; box: CropBox } | null>(null);

  const handleSpinePointerDown = (handle: string, e: React.PointerEvent) => {
    if (isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    setActiveSpineDrag(handle);
    if (overlayRef.current && cleanupModule?.spineBox) {
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const b = cleanupModule.spineBox;
        spineDragStartRef.current = {
          relX: (e.clientX - rect.left) / rect.width,
          relY: (e.clientY - rect.top) / rect.height,
          box: {
            x1: Math.min(b.x1, b.x2),
            y1: Math.min(b.y1, b.y2),
            x2: Math.max(b.x1, b.x2),
            y2: Math.max(b.y1, b.y2),
          },
        };
      }
    }
  };

  useEffect(() => {
    if (!activeSpineDrag) return;
    const onMove = (e: PointerEvent) => {
      if (!overlayRef.current || !setCleanupModule || !spineDragStartRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const { relX: sx, relY: sy, box: b } = spineDragStartRef.current;
      const minX = Math.min(b.x1, b.x2);
      const maxX = Math.max(b.x1, b.x2);
      const minY = Math.min(b.y1, b.y2);
      const maxY = Math.max(b.y1, b.y2);

      if (activeSpineDrag === "move") {
        const w = maxX - minX;
        const h = maxY - minY;
        const nx1 = Math.max(0, Math.min(1 - w, minX + relX - sx));
        const ny1 = Math.max(0, Math.min(1 - h, minY + relY - sy));
        setCleanupModule((prev) => {
          if (!prev.spineBox) return prev;
          return {
            ...prev,
            spineBox: {
              x1: Math.round(nx1 * 1000) / 1000,
              y1: Math.round(ny1 * 1000) / 1000,
              x2: Math.round((nx1 + w) * 1000) / 1000,
              y2: Math.round((ny1 + h) * 1000) / 1000,
            },
          };
        });
        return;
      }

      let x1 = minX, x2 = maxX, y1 = minY, y2 = maxY;
      if (activeSpineDrag.includes("w")) x1 = Math.max(0, Math.min(relX, x2 - 0.02));
      if (activeSpineDrag.includes("e")) x2 = Math.min(1, Math.max(relX, x1 + 0.02));
      if (activeSpineDrag.includes("n")) y1 = Math.max(0, Math.min(relY, y2 - 0.02));
      if (activeSpineDrag.includes("s")) y2 = Math.min(1, Math.max(relY, y1 + 0.02));

      setCleanupModule((prev) => ({
        ...prev,
        spineBox: {
          x1: Math.round(Math.min(x1, x2) * 1000) / 1000,
          y1: Math.round(Math.min(y1, y2) * 1000) / 1000,
          x2: Math.round(Math.max(x1, x2) * 1000) / 1000,
          y2: Math.round(Math.max(y1, y2) * 1000) / 1000,
        },
      }));
    };
    const onUp = () => {
      setActiveSpineDrag(null);
      spineDragStartRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [activeSpineDrag, setCleanupModule]);

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
      <div className="h-full bg-[#14171F] flex flex-col select-none">
        <WorkspaceToolbar
          isPanMode={isPanMode}
          onTogglePanMode={() => setIsPanMode((p) => !p)}
          isDeckOpen={isDeckOpen}
          onToggleDeck={onToggleDeck}
          totalPages={0}
          onUndo={onUndo}
          canUndo={canUndo}
          onRedo={onRedo}
          canRedo={canRedo}
          shortcutLabels={shortcutLabels}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#181C26] flex items-center justify-center mb-3 text-slate-300">
            <IconBookStudio size={24} />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Book Studio Ready</h3>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Open the Page Deck or Intake tool to upload a book PDF, crop, split spreads, deskew, and prepare print-ready pages.
          </p>
          {onToggleDeck && !isDeckOpen && (
            <button
              type="button"
              onClick={onToggleDeck}
              className="mt-4 px-3.5 py-1.5 rounded-md bg-[#252B3B] hover:bg-[#2F374B] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Open Intake & Deck
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="h-full bg-[#14171F] flex items-center justify-center text-slate-400 text-xs">
        Select a page from the deck to preview.
      </div>
    );
  }

  return (
    <div ref={viewportRef} className={`flex flex-col h-full bg-[#14171F] overflow-hidden select-none relative ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      <WorkspaceToolbar
        isPanMode={isPanMode}
        onTogglePanMode={() => setIsPanMode((p) => !p)}
        isSplitCurtain={isSplitCurtain}
        onToggleSplitCurtain={() => setIsSplitCurtain((p) => !p)}
        isDeckOpen={isDeckOpen}
        onToggleDeck={onToggleDeck}
        totalPages={pages.length}
        onUndo={onUndo}
        canUndo={canUndo}
        onRedo={onRedo}
        canRedo={canRedo}
        shortcutLabels={shortcutLabels}
      />

        <PageCanvas
          containerRef={containerRef}
          overlayRef={overlayRef}
          imageSrc={getThumbnailUrl(selectedPage.id, !isViewingOriginal, 150)}
          rawImageSrc={getThumbnailUrl(selectedPage.id, false, 150)}
          secondaryImageSrc={secondaryPage ? getThumbnailUrl(secondaryPage.id, !isViewingOriginal, 150) : null}
          secondaryImageAlt={secondaryPage ? `Page ${pairStartIdx + 2}` : undefined}
          onSelectPrimaryPage={() => {
            if (isDualPage && secondaryPage && selectedPage && cropModule?.target.base === "current") {
              const isDualLinked = (cropModule.target.dualSides?.length ?? 2) >= 2;
              if (!isDualLinked && cropModule.target.dualSides?.[0] !== "left") {
                focusCropPage?.(selectedPage.id, [selectedPage.id, secondaryPage.id]);
                const priDraft = pageCrops?.[selectedPage.id];
                setCropModule?.((prev) => ({
                  ...prev,
                  cropBox: priDraft?.cropBox ?? prev.cropBox,
                  splitLines: priDraft?.splitLines ? priDraft.splitLines.map((l) => ({ ...l })) : prev.splitLines,
                  splitPos: priDraft?.splitPos ?? prev.splitPos,
                  target: { ...prev.target, dualSides: ["left"] },
                }));
              }
            }
          }}
          onSelectSecondaryPage={
            secondaryPage
              ? () => {
                  if (isDualPage && selectedPage && cropModule?.target.base === "current") {
                    const isDualLinked = (cropModule.target.dualSides?.length ?? 2) >= 2;
                    if (!isDualLinked && cropModule.target.dualSides?.[0] !== "right") {
                      focusCropPage?.(secondaryPage.id, [selectedPage.id, secondaryPage.id]);
                      const secDraft = pageCrops?.[secondaryPage.id];
                      setCropModule?.((prev) => ({
                        ...prev,
                        cropBox: secDraft?.cropBox ?? prev.cropBox,
                        splitLines: secDraft?.splitLines ? secDraft.splitLines.map((l) => ({ ...l })) : prev.splitLines,
                        splitPos: secDraft?.splitPos ?? prev.splitPos,
                        target: { ...prev.target, dualSides: ["right"] },
                      }));
                    }
                  }
                }
              : undefined
          }
          secondaryCropBox={secondaryCropBox}
          isSplitCurtain={isSplitCurtain}
          curtainPos={curtainPos}
          onCurtainChange={setCurtainPos}
          imageAlt={`Page ${pairStartIdx + 1}`}
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
          pageMasks={isViewingOriginal ? [] : visiblePageMasks}
          onApplyMaskBox={onApplyMaskBox}
          onRemoveMaskBox={onRemoveMaskBox}
          cropModule={cropModule}
          bleedModule={bleedModule}
          cleanupModule={cleanupModule}
          onMaskPointerDown={handleMaskPointerDown}
          onSpinePointerDown={handleSpinePointerDown}
          splitLines={primarySplitLines}
          secondarySplitLines={secondarySplitLines}
          isSplitMode={focusedModule === "split"}
          pageBaseWidthMm={pageBaseWidthMm}
          pageBaseHeightMm={pageBaseHeightMm}
          currentCropHeightMm={currentCropHeightMm}
          currentCropWidthMm={currentCropWidthMm}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onImageLoad={handleImageLoad}
          onCropPointerDown={handleCropPointerDown}
          activeDrag={activeCropDrag}
        />

      {/* Floating Bottom Navigation & Zoom Pill HUD Bar */}
      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-[#161922]/95 backdrop-blur-md border border-[#262B38] shadow-2xl text-xs">
        {/* Page Navigation: |< < [ 1 ] / N > >| */}
        <button
          type="button"
          disabled={pairStartIdx <= 0}
          onClick={() => pages.length > 0 && setSelectedPageId(pages[0].id)}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          disabled={pairStartIdx <= 0}
          onClick={goToPrevPage}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title={`Previous ${isDualPage ? "Spread" : "Page"} (${shortcutLabels.prev_page || "["})`}
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center space-x-1">
          {isDualPage && secondaryPage ? (
            <div className="px-2 py-0.5 bg-[#1E2330] border border-[#2E3646] rounded text-white font-mono text-xs whitespace-nowrap">
              {pairStartIdx + 1}–{pairStartIdx + 2}
            </div>
          ) : (
            <input
              type="number"
              min={1}
              max={pages.length}
              value={pairStartIdx + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= pages.length) {
                  setSelectedPageId(pages[val - 1].id);
                }
              }}
              className="w-9 bg-[#1E2330] border border-[#2E3646] rounded text-center text-white font-mono text-xs py-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
          <span className="text-slate-400 font-mono text-xs whitespace-nowrap">/ {pages.length}</span>
        </div>

        <button
          type="button"
          disabled={isDualPage ? (pairStartIdx + 2 >= pages.length) : (pairStartIdx >= pages.length - 1)}
          onClick={goToNextPage}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title={`Next ${isDualPage ? "Spread" : "Page"} (${shortcutLabels.next_page || "]"})`}
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          disabled={isDualPage ? (pairStartIdx + 2 >= pages.length) : (pairStartIdx >= pages.length - 1)}
          onClick={() => {
            if (pages.length === 0) return;
            const targetIdx = isDualPage ? Math.floor((pages.length - 1) / 2) * 2 : pages.length - 1;
            setSelectedPageId(pages[targetIdx].id);
          }}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>

        <div className="h-3.5 w-px bg-[#262B38]" />

        {/* Dual Page Mode (2 pages side-by-side vs 1 page) */}
        <button
          type="button"
          onClick={toggleDualPage}
          className={`p-1 rounded transition-colors cursor-pointer ${
            isDualPage
              ? "bg-[#252B3B] text-white"
              : "text-slate-400 hover:text-white"
          }`}
          title={isDualPage ? "Dual Page Mode Active (Click to revert to 1 page)" : "Dual Page Mode: Show two pages side-by-side"}
        >
          <BookOpen size={14} />
        </button>

        <div className="h-3.5 w-px bg-[#262B38]" />

        {/* Zoom Out, Slider, Zoom In, Percentage */}
        <button
          type="button"
          onClick={zoomOut}
          className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={`Zoom Out (${shortcutLabels.zoom_out || "-"})`}
        >
          <ZoomOut size={14} />
        </button>

        <input
          type="range"
          min={40}
          max={400}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="w-20 h-1 bg-[#262B38] rounded-lg cursor-pointer accent-blue-500 hidden sm:block"
          title="Zoom Level"
        />

        <button
          type="button"
          onClick={zoomIn}
          className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={`Zoom In (${shortcutLabels.zoom_in || "="})`}
        >
          <ZoomIn size={14} />
        </button>

        <button
          type="button"
          onClick={zoomReset}
          className="text-xs font-mono text-slate-300 hover:text-white min-w-[38px] text-center cursor-pointer"
          title={`Reset Zoom to 100% (${shortcutLabels.zoom_reset || "Ctrl+0"})`}
        >
          {Math.round(zoom * 100)}%
        </button>

        <div className="h-3.5 w-px bg-[#262B38]" />

        {/* Fit Width & Fit Page */}
        <button
          type="button"
          onClick={fitWidth}
          className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fit Width"
        >
          <MoveHorizontal size={14} />
        </button>

        <button
          type="button"
          onClick={zoomReset}
          className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fit Page"
        >
          <File size={14} />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className={`p-1 rounded transition-colors cursor-pointer ${
            isFullscreen
              ? "bg-[#252B3B] text-white"
              : "text-slate-400 hover:text-white"
          }`}
          title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}
