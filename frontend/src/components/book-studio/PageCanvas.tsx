"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import {
  BleedModuleConfig,
  CleanupModuleConfig,
  CropBox,
  CropModuleConfig,
  MaskBox,
  SplitLine,
  RestorationModuleConfig,
  CleanupColorMode,
} from "@/types/book_studio";
import { clampCut } from "@/lib/splitLines";

import { type LengthUnit, mmToUnit, UNIT_OPTIONS } from "@/lib/units";
import { IconDimensionRuler } from "@/components/shared/StudioIcons";

const ACCENT = "var(--app-accent, #f59e0b)";

export interface SplitLineOverlayProps {
  line: SplitLine;
  index: number;
  active: boolean;
  onPointerDown: (handle: string, e: React.PointerEvent) => void;
  onHoverChange?: (hovering: boolean) => void;
  sizeBeforeMm: number;
  sizeAfterMm: number;
  crossSizeMm: number;
  unit: LengthUnit;
  unitShort: string;
  showTags: boolean;
}

/** Computes the adjacent millimeter sizes sliced by a specific cut line. */
function getCutLineSegments(
  line: SplitLine,
  lines: SplitLine[],
  cropWidthMm: number,
  cropHeightMm: number
) {
  const isH = line.direction === "horizontal";
  const sameDirPositions = lines
    .filter((l) => l.direction === line.direction)
    .map((l) => clampCut(l.pos))
    .sort((a, b) => a - b);

  const uniquePositions = Array.from(new Set(sameDirPositions));
  const currentPos = clampCut(line.pos);
  const idx = uniquePositions.indexOf(currentPos);

  const prevCut = idx > 0 ? uniquePositions[idx - 1] : 0;
  const nextCut = idx >= 0 && idx < uniquePositions.length - 1 ? uniquePositions[idx + 1] : 1;

  if (isH) {
    const sizeBeforeMm = Math.round(cropHeightMm * (currentPos - prevCut) * 10) / 10;
    const sizeAfterMm = Math.round(cropHeightMm * (nextCut - currentPos) * 10) / 10;
    return {
      sizeBeforeMm,
      sizeAfterMm,
      crossSizeMm: cropWidthMm,
      isVertical: false,
    };
  } else {
    const sizeBeforeMm = Math.round(cropWidthMm * (currentPos - prevCut) * 10) / 10;
    const sizeAfterMm = Math.round(cropWidthMm * (nextCut - currentPos) * 10) / 10;
    return {
      sizeBeforeMm,
      sizeAfterMm,
      crossSizeMm: cropHeightMm,
      isVertical: true,
    };
  }
}

/** A cut line drawn inside the crop box with line-specific size tags on hover/drag. */
function SplitLineOverlay({
  line,
  index,
  active,
  onPointerDown,
  onHoverChange,
  sizeBeforeMm,
  sizeAfterMm,
  crossSizeMm,
  unit,
  unitShort,
  showTags,
}: SplitLineOverlayProps) {
  const isH = line.direction === "horizontal";
  const pct = `${line.pos * 100}%`;
  const start = (e: React.PointerEvent) => onPointerDown(`spine-${index}`, e);

  return (
    <div
      onPointerDown={start}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      className={`group absolute z-40 touch-none ${
        isH
          ? "left-0 right-0 h-5 -translate-y-1/2 cursor-ns-resize"
          : "top-0 bottom-0 w-5 -translate-x-1/2 cursor-ew-resize"
      }`}
      style={isH ? { top: pct } : { left: pct }}
      title={`Drag to move ${line.direction} cut line ${index + 1} (${(line.pos * 100).toFixed(1)}%)`}
    >
      {/* Visible line */}
      <div
        className={`absolute pointer-events-none transition-all ${
          isH
            ? "left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed"
            : "top-0 bottom-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed"
        } ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
        style={{ borderColor: ACCENT, filter: "drop-shadow(0 0 2px rgba(0,0,0,0.9))" }}
      />
      {/* Hover / active glow */}
      <div
        className={`absolute pointer-events-none rounded-full transition-opacity ${
          isH
            ? "left-0 right-0 top-1/2 -translate-y-1/2 h-1.5"
            : "top-0 bottom-0 left-1/2 -translate-x-1/2 w-1.5"
        } ${active ? "opacity-40" : "opacity-0 group-hover:opacity-25"}`}
        style={{ backgroundColor: ACCENT }}
      />
      {/* Position pill */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full font-mono font-semibold text-[9px] shadow-md ring-1 ring-black/60 pointer-events-none whitespace-nowrap transition-transform ${
          active ? "scale-110" : "group-hover:scale-105"
        }`}
        style={{ backgroundColor: ACCENT, color: "var(--app-accent-fg, #0f172a)" }}
      >
        {(line.pos * 100).toFixed(1)}%
      </div>

      {/* Resulting split sizes for THIS cut line only */}
      <div
        className={`transition-opacity duration-150 pointer-events-none ${
          showTags ? "opacity-100" : "opacity-0"
        }`}
      >
        {isH ? (
          <>
            {/* Top slice size */}
            <div
              className="absolute left-6 bottom-[calc(50%+8px)] bg-[#0B0E14]/90 backdrop-blur-xs border border-white/20 text-slate-100 rounded text-[9px] font-mono font-semibold shadow-md whitespace-nowrap px-1.5 py-0.5"
              title={`Top slice: ${mmToUnit(crossSizeMm, unit)} × ${mmToUnit(sizeBeforeMm, unit)} ${unitShort}`}
            >
              {mmToUnit(crossSizeMm, unit)} × {mmToUnit(sizeBeforeMm, unit)}{" "}
              <span className="text-slate-400 font-normal">{unitShort}</span>
            </div>

            {/* Bottom slice size */}
            <div
              className="absolute left-6 top-[calc(50%+8px)] bg-[#0B0E14]/90 backdrop-blur-xs border border-white/20 text-slate-100 rounded text-[9px] font-mono font-semibold shadow-md whitespace-nowrap px-1.5 py-0.5"
              title={`Bottom slice: ${mmToUnit(crossSizeMm, unit)} × ${mmToUnit(sizeAfterMm, unit)} ${unitShort}`}
            >
              {mmToUnit(crossSizeMm, unit)} × {mmToUnit(sizeAfterMm, unit)}{" "}
              <span className="text-slate-400 font-normal">{unitShort}</span>
            </div>
          </>
        ) : (
          <>
            {/* Left slice size */}
            <div
              className="absolute top-4 right-[calc(50%+8px)] bg-[#0B0E14]/90 backdrop-blur-xs border border-white/20 text-slate-100 rounded text-[9px] font-mono font-semibold shadow-md whitespace-nowrap [writing-mode:vertical-rl] rotate-180 py-1.5 px-0.5"
              title={`Left slice: ${mmToUnit(sizeBeforeMm, unit)} × ${mmToUnit(crossSizeMm, unit)} ${unitShort}`}
            >
              {mmToUnit(sizeBeforeMm, unit)} × {mmToUnit(crossSizeMm, unit)}{" "}
              <span className="text-slate-400 font-normal">{unitShort}</span>
            </div>

            {/* Right slice size */}
            <div
              className="absolute top-4 left-[calc(50%+8px)] bg-[#0B0E14]/90 backdrop-blur-xs border border-white/20 text-slate-100 rounded text-[9px] font-mono font-semibold shadow-md whitespace-nowrap [writing-mode:vertical-rl] rotate-180 py-1.5 px-0.5"
              title={`Right slice: ${mmToUnit(sizeAfterMm, unit)} × ${mmToUnit(crossSizeMm, unit)} ${unitShort}`}
            >
              {mmToUnit(sizeAfterMm, unit)} × {mmToUnit(crossSizeMm, unit)}{" "}
              <span className="text-slate-400 font-normal">{unitShort}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export interface PageCanvasProps {
  containerRef: { current: HTMLDivElement | null };
  overlayRef: { current: HTMLDivElement | null };
  imageSrc: string;
  rawImageSrc?: string;
  secondaryImageSrc?: string | null;
  secondaryImageAlt?: string;
  onSelectPrimaryPage?: () => void;
  onSelectSecondaryPage?: () => void;
  secondaryCropBox?: CropBox;
  isSplitCurtain?: boolean;
  curtainPos?: number;
  onCurtainChange?: (pos: number) => void;
  imageAlt: string;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  isPanMode?: boolean;
  unit?: LengthUnit;
  showGrid: boolean;
  gridColor?: string;
  showSplitSizes?: boolean;
  eyedropperActive?: boolean;
  onPickColor?: (hex: string) => void;
  straightenActive?: boolean;
  onApplyStraightenAngle?: (deltaAngle: number) => void;
  maskToolActive?: boolean;
  pageMasks?: MaskBox[];
  secondaryPageMasks?: MaskBox[];
  primaryDraftMaskBox?: MaskBox | null;
  secondaryDraftMaskBox?: MaskBox | null;
  primarySpineBox?: CropBox | null;
  secondarySpineBox?: CropBox | null;
  onApplyMaskBox?: (box: CropBox, side?: "primary" | "secondary") => void;
  onRemoveMaskBox?: (maskId: string) => void;
  cropModule?: CropModuleConfig;
  bleedModule?: BleedModuleConfig;
  cleanupModule?: CleanupModuleConfig;
  restorationModule?: RestorationModuleConfig;
  pageColorMode?: CleanupColorMode | null;
  secondaryPageColorMode?: CleanupColorMode | null;
  onMaskPointerDown?: (handle: string, e: React.PointerEvent) => void;
  onSpinePointerDown?: (handle: string, e: React.PointerEvent) => void;
  splitLines: SplitLine[];
  secondarySplitLines?: SplitLine[];
  isSplitMode?: boolean;
  pageBaseWidthMm: number;
  pageBaseHeightMm: number;
  currentCropHeightMm: number;
  currentCropWidthMm: number;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onImageLoad: (w: number, h: number) => void;
  onCropPointerDown: (handle: string, e: React.PointerEvent) => void;
  activeDrag?: string | null;
}

export function PageCanvas({
  containerRef,
  overlayRef,
  imageSrc,
  rawImageSrc,
  secondaryImageSrc = null,
  secondaryImageAlt = "Next Page",
  onSelectPrimaryPage,
  onSelectSecondaryPage,
  secondaryCropBox,
  isSplitCurtain = false,
  curtainPos = 0.5,
  onCurtainChange,
  imageAlt,
  zoom,
  pan,
  isPanning,
  isPanMode = false,
  unit = "mm",
  showGrid,
  gridColor = "#06b6d4",
  showSplitSizes = true,
  eyedropperActive = false,
  onPickColor,
  straightenActive = false,
  onApplyStraightenAngle,
  maskToolActive = false,
  pageMasks = [],
  secondaryPageMasks = [],
  primaryDraftMaskBox,
  secondaryDraftMaskBox,
  primarySpineBox,
  secondarySpineBox,
  onApplyMaskBox,
  onRemoveMaskBox,
  cropModule,
  bleedModule,
  cleanupModule,
  restorationModule,
  pageColorMode = null,
  secondaryPageColorMode = null,
  onMaskPointerDown,
  onSpinePointerDown,
  splitLines,
  secondarySplitLines = [],
  isSplitMode = false,
  pageBaseWidthMm,
  pageBaseHeightMm,
  currentCropHeightMm,
  currentCropWidthMm,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onImageLoad,
  onCropPointerDown,
  activeDrag = null,
}: PageCanvasProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; color: string } | null>(null);
  const [rulerDrag, setRulerDrag] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    deltaAngle: number;
    side: "primary" | "secondary";
  } | null>(null);
  const [maskDrag, setMaskDrag] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    side: "primary" | "secondary";
  } | null>(null);
  const [isDraggingCurtain, setIsDraggingCurtain] = useState<boolean>(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [showLoadingPill, setShowLoadingPill] = useState<boolean>(false);
  const prevSrcRef = useRef<string>(imageSrc);

  useEffect(() => {
    if (prevSrcRef.current !== imageSrc) {
      prevSrcRef.current = imageSrc;
      setIsImageLoading(true);
      const timer = setTimeout(() => {
        setShowLoadingPill(true);
      }, 75);
      return () => clearTimeout(timer);
    }
  }, [imageSrc]);

  const [retryKey, setRetryKey] = useState<number>(0);

  // If image is already in memory cache upon mount/switch, immediately resolve ready state
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsImageLoading(false);
      setShowLoadingPill(false);
      onImageLoad(imgRef.current.naturalWidth, imgRef.current.naturalHeight);
    }
  }, [imageSrc, onImageLoad]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsImageLoading(false);
    setShowLoadingPill(false);
    setRetryKey(0);
    onImageLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    setShowLoadingPill(false);
    if (retryKey < 2) {
      setTimeout(() => {
        setRetryKey((k) => k + 1);
      }, 300);
    }
  };

  // Real-time CSS visual filters for Colors & Tone WYSIWYG preview
  const computeCanvasImageFilter = (colorOverride?: CleanupColorMode | null) => {
    if (!restorationModule?.enabled && !colorOverride) return "none";
    const filters: string[] = [];
    const mode = colorOverride || (restorationModule?.enabled ? restorationModule.colorMode : "auto") || "auto";

    if (mode === "grayscale") {
      filters.push("grayscale(100%)");
    } else if (mode === "bw") {
      const thresh = restorationModule?.bwThreshold ?? 128;
      const contrastVal = Math.max(250, 250 + (128 - thresh) * 2);
      filters.push("grayscale(100%)", `contrast(${contrastVal}%)`);
    }

    if (restorationModule?.enabled) {
      if (restorationModule.contrast !== undefined && restorationModule.contrast !== 1.0) {
        filters.push(`contrast(${Math.round(restorationModule.contrast * 100)}%)`);
      }
      if (restorationModule.saturation !== undefined && restorationModule.saturation !== 1.0) {
        filters.push(`saturate(${Math.round(restorationModule.saturation * 100)}%)`);
      }
      if (restorationModule.whitenBg) {
        filters.push("brightness(108%)", "contrast(105%)");
      }
    }

    return filters.length > 0 ? filters.join(" ") : "none";
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canvasImageFilter = useMemo(() => computeCanvasImageFilter(pageColorMode), [restorationModule, pageColorMode]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const secondaryCanvasImageFilter = useMemo(() => computeCanvasImageFilter(secondaryPageColorMode), [restorationModule, secondaryPageColorMode]);

  // Auto-fading tool hint pill so it never permanently blocks the preview canvas
  useEffect(() => {
    let msg: string | null = null;
    if (eyedropperActive) {
      msg = "Click anywhere on the page to sample color";
    } else if (straightenActive) {
      msg = "Drag along any horizontal text line or vertical border to straighten page";
    } else if (maskToolActive) {
      msg = "Drag a rectangle on the page to erase marks";
    } else if (isSplitMode) {
      msg = "Drag cut lines to adjust split positions";
    } else if (cropModule?.enabled) {
      msg = "Drag crop handles to adjust trim boundaries";
    }

    if (!msg) {
      setHintVisible(false);
      return;
    }

    setHintText(msg);
    setHintVisible(true);
    const fadeTimer = setTimeout(() => {
      setHintVisible(false);
    }, 1800);
    return () => clearTimeout(fadeTimer);
  }, [eyedropperActive, straightenActive, maskToolActive, isSplitMode, cropModule?.enabled]);

  const computeStraightenDelta = (x1: number, y1: number, x2: number, y2: number, w: number, h: number): number => {
    const dx = (x2 - x1) * w;
    const dy = (y2 - y1) * h;
    if (Math.hypot(dx, dy) < 6) return 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal reference line: ensure left-to-right vector
      const vx = dx >= 0 ? dx : -dx;
      const vy = dx >= 0 ? dy : -dy;
      const tiltDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
      return Math.round(tiltDeg * 100) / 100;
    } else {
      // Vertical reference line: ensure top-to-bottom vector
      const vx = dy >= 0 ? dx : -dx;
      const vy = dy >= 0 ? dy : -dy;
      const tiltFromVertDeg = (Math.atan2(vx, vy) * 180) / Math.PI;
      return Math.round(-tiltFromVertDeg * 100) / 100;
    }
  };

  const handleRulerPointerDown = (side: "primary" | "secondary", e: React.PointerEvent<HTMLDivElement>) => {
    if (!straightenActive) return;
    e.stopPropagation();
    e.preventDefault();
    if (side === "secondary") onSelectSecondaryPage?.();
    else onSelectPrimaryPage?.();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    e.currentTarget.setPointerCapture(e.pointerId);
    setRulerDrag({ x1: x, y1: y, x2: x, y2: y, deltaAngle: 0, side });
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!straightenActive || !rulerDrag) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x2 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y2 = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const deltaAngle = computeStraightenDelta(rulerDrag.x1, rulerDrag.y1, x2, y2, rect.width, rect.height);
    setRulerDrag((prev) => (prev ? { ...prev, x2, y2, deltaAngle } : null));
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!straightenActive || !rulerDrag) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const dxPx = (rulerDrag.x2 - rulerDrag.x1) * rect.width;
    const dyPx = (rulerDrag.y2 - rulerDrag.y1) * rect.height;
    const dist = Math.hypot(dxPx, dyPx);
    const delta = rulerDrag.deltaAngle;
    setRulerDrag(null);
    if (dist >= 12 && onApplyStraightenAngle) {
      onApplyStraightenAngle(delta);
    }
  };

  const handleMaskPointerDown = (side: "primary" | "secondary", e: React.PointerEvent<HTMLDivElement>) => {
    if (!maskToolActive) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    e.currentTarget.setPointerCapture(e.pointerId);
    setMaskDrag({ x1: x, y1: y, x2: x, y2: y, side });
  };

  const handleMaskPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!maskToolActive || !maskDrag) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x2 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y2 = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setMaskDrag((prev) => (prev ? { ...prev, x2, y2 } : null));
  };

  const handleMaskPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!maskToolActive || !maskDrag) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x1 = Math.min(maskDrag.x1, maskDrag.x2);
    const y1 = Math.min(maskDrag.y1, maskDrag.y2);
    const x2 = Math.max(maskDrag.x1, maskDrag.x2);
    const y2 = Math.max(maskDrag.y1, maskDrag.y2);
    const side = maskDrag.side;
    const wPx = (x2 - x1) * rect.width;
    const hPx = (y2 - y1) * rect.height;
    setMaskDrag(null);
    if (wPx >= 6 && hPx >= 6 && onApplyMaskBox) {
      onApplyMaskBox({
        x1: Math.round(x1 * 1000) / 1000,
        y1: Math.round(y1 * 1000) / 1000,
        x2: Math.round(x2 * 1000) / 1000,
        y2: Math.round(y2 * 1000) / 1000,
      }, side);
    }
  };

  const handleCurtainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCurtain(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCurtainPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCurtain) return;
    e.stopPropagation();
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const relX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    onCurtainChange?.(Math.round(relX * 1000) / 1000);
  };

  const handleCurtainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCurtain) return;
    e.stopPropagation();
    setIsDraggingCurtain(false);
  };

  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short || "mm";
  const displayWidthMm = (cropModule?.enabled && !isSplitMode) ? currentCropWidthMm : pageBaseWidthMm;
  const displayHeightMm = (cropModule?.enabled && !isSplitMode) ? currentCropHeightMm : pageBaseHeightMm;

  let effectiveWidthMm = displayWidthMm;
  let effectiveHeightMm = displayHeightMm;
  const isBleedActive = Boolean(bleedModule?.enabled && bleedModule.bleedMm > 0);
  if (isBleedActive && bleedModule) {
    if ((bleedModule.placement || "outside") === "outside") {
      effectiveWidthMm = Math.round((displayWidthMm + bleedModule.bleedMm * 2) * 10) / 10;
      effectiveHeightMm = Math.round((displayHeightMm + bleedModule.bleedMm * 2) * 10) / 10;
    } else {
      effectiveWidthMm = Math.max(1, Math.round((displayWidthMm - bleedModule.bleedMm * 2) * 10) / 10);
      effectiveHeightMm = Math.max(1, Math.round((displayHeightMm - bleedModule.bleedMm * 2) * 10) / 10);
    }
  }

  const samplePixelColor = (e: React.MouseEvent<HTMLImageElement>): string | null => {
    const img = e.currentTarget || imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;

    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const px = Math.min(img.naturalWidth - 1, Math.floor(relX * img.naturalWidth));
    const py = Math.min(img.naturalHeight - 1, Math.floor(relY * img.naturalHeight));

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const r = data[0] ?? 0;
      const g = data[1] ?? 0;
      const b = data[2] ?? 0;
      return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    } catch (err) {
      console.error("Pixel sample failed:", err);
      return null;
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!eyedropperActive || !onPickColor) return;
    e.stopPropagation();
    e.preventDefault();
    const hex = samplePixelColor(e);
    if (hex) {
      onPickColor(hex);
      setLoupe(null);
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!eyedropperActive) return;
    const hex = samplePixelColor(e);
    if (hex) {
      setLoupe({ x: e.clientX, y: e.clientY, color: hex });
    }
  };

  const handleImageMouseLeave = () => {
    if (eyedropperActive) {
      setLoupe(null);
    }
  };

  // Reusable 8-handle interactive box (used for Crop Box, Draft Mask Box, and Spine Selection Box)
  const renderResizableBox = (opts: {
    box: CropBox;
    onPointerDown: (handle: string, e: React.PointerEvent) => void;
    borderColor: string;
    backgroundColor?: string;
    boxShadow?: string;
    borderStyle?: "solid" | "dashed";
    handleColor: string;
    edgeHoverClass?: string;
    moveTitle: string;
    zIndexClass?: string;
    disabled?: boolean;
  }) => {
    const x1 = Math.min(opts.box.x1, opts.box.x2);
    const y1 = Math.min(opts.box.y1, opts.box.y2);
    const w = Math.max(0.005, Math.abs(opts.box.x2 - opts.box.x1));
    const h = Math.max(0.005, Math.abs(opts.box.y2 - opts.box.y1));

    return (
      <div
        className={`absolute border-2 ${opts.borderStyle === "dashed" ? "border-dashed" : "border-solid shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_24px_rgba(0,0,0,0.35)]"} select-none touch-none ${opts.zIndexClass || ""} ${
          opts.disabled ? "pointer-events-none" : "pointer-events-auto"
        }`}
        style={{
          borderColor: opts.borderColor,
          backgroundColor: opts.backgroundColor,
          boxShadow: opts.boxShadow,
          top: `${y1 * 100}%`,
          left: `${x1 * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
        }}
      >
        <div
          onPointerDown={(e) => opts.onPointerDown("move", e)}
          className="absolute inset-2 cursor-move z-10"
          title={opts.moveTitle}
        />
        <div
          onPointerDown={(e) => opts.onPointerDown("n", e)}
          className={`absolute -top-2 left-2 right-2 h-4 cursor-ns-resize z-20 ${opts.edgeHoverClass || "hover:bg-white/10"} transition-colors pointer-events-auto`}
          title="Drag top edge to resize height"
        />
        <div
          onPointerDown={(e) => opts.onPointerDown("s", e)}
          className={`absolute -bottom-2 left-2 right-2 h-4 cursor-ns-resize z-20 ${opts.edgeHoverClass || "hover:bg-white/10"} transition-colors pointer-events-auto`}
          title="Drag bottom edge to resize height"
        />
        <div
          onPointerDown={(e) => opts.onPointerDown("w", e)}
          className={`absolute top-2 bottom-2 -left-2 w-4 cursor-ew-resize z-20 ${opts.edgeHoverClass || "hover:bg-white/10"} transition-colors pointer-events-auto`}
          title="Drag left edge to resize width"
        />
        <div
          onPointerDown={(e) => opts.onPointerDown("e", e)}
          className={`absolute top-2 bottom-2 -right-2 w-4 cursor-ew-resize z-20 ${opts.edgeHoverClass || "hover:bg-white/10"} transition-colors pointer-events-auto`}
          title="Drag right edge to resize width"
        />
        {(["nw", "ne", "sw", "se"] as const).map((corner) => {
          const posClass =
            corner === "nw" ? "-top-2.5 -left-2.5 cursor-nwse-resize" :
            corner === "ne" ? "-top-2.5 -right-2.5 cursor-nesw-resize" :
            corner === "sw" ? "-bottom-2.5 -left-2.5 cursor-nesw-resize" :
            "-bottom-2.5 -right-2.5 cursor-nwse-resize";
          return (
            <div
              key={corner}
              onPointerDown={(e) => opts.onPointerDown(corner, e)}
              className={`absolute ${posClass} w-5 h-5 flex items-center justify-center z-30 group pointer-events-auto`}
              title="Drag corner to resize"
            >
              <div
                className="w-3 h-3 rounded-full ring-2 ring-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform"
                style={{ backgroundColor: opts.handleColor }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Crop box overlay, rendered over every visible page (primary + dual-mode secondary) when in Crop tool.
  const renderCropOverlay = (box?: CropBox, side: "primary" | "secondary" = "primary") => {
    if (isSplitMode || !cropModule?.enabled || !box) return null;
    const disabled = isPanMode || eyedropperActive || straightenActive || maskToolActive;
    return (
      <div
        data-crop-overlay={side}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 select-none ${disabled ? "pointer-events-none" : "pointer-events-auto"}`}
      >
        {renderResizableBox({
          box,
          onPointerDown: onCropPointerDown,
          borderColor: ACCENT,
          handleColor: ACCENT,
          moveTitle: "Drag interior to move crop box",
          disabled,
        })}
      </div>
    );
  };

  const renderDraftMaskOverlay = (draftBox?: MaskBox | null, side: "primary" | "secondary" = "primary") => {
    if (!draftBox || !onMaskPointerDown) return null;
    const disabled = isPanMode || eyedropperActive || straightenActive;
    return (
      <div
        data-page-overlay={side}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 pointer-events-none select-none z-[55]"
      >
        {renderResizableBox({
          box: draftBox,
          onPointerDown: onMaskPointerDown,
          borderColor: "#f59e0b",
          backgroundColor: draftBox.color || cleanupModule?.maskColor || "#ffffff",
          handleColor: "#f59e0b",
          edgeHoverClass: "hover:bg-amber-400/20",
          moveTitle: "Drag interior to move erase box",
          disabled,
        })}
      </div>
    );
  };

  const renderSpineBoxOverlay = (spineBox?: CropBox | null, side: "primary" | "secondary" = "primary") => {
    if (!cleanupModule?.enabled || !cleanupModule.spineSelectionActive || !spineBox || !onSpinePointerDown) return null;
    const disabled = isPanMode || eyedropperActive || straightenActive || maskToolActive;
    return (
      <div
        data-page-overlay={side}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 pointer-events-none select-none z-[50]"
      >
        {renderResizableBox({
          box: spineBox,
          onPointerDown: onSpinePointerDown,
          borderColor: "var(--app-accent, #06b6d4)",
          backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
          boxShadow: "0 0 14px var(--app-accent-glow, rgba(6, 182, 212, 0.45))",
          borderStyle: "dashed",
          handleColor: "var(--app-accent, #06b6d4)",
          edgeHoverClass: "hover:opacity-80",
          moveTitle: "Drag interior to reposition spine shadow region",
          disabled,
        })}
      </div>
    );
  };

  const renderSavedMasksOverlay = (masks: MaskBox[]) => {
    if (masks.length === 0) return null;
    return (
      <div className="absolute inset-0 z-40 pointer-events-none select-none">
        {masks.map((m, idx) => {
          const x1 = Math.min(m.x1, m.x2);
          const y1 = Math.min(m.y1, m.y2);
          const w = Math.max(0.01, Math.abs(m.x2 - m.x1));
          const h = Math.max(0.01, Math.abs(m.y2 - m.y1));
          const fillColor = m.color || "#ffffff";
          return (
            <div
              key={m.id || idx}
              className="group/mask absolute border border-dashed border-transparent hover:border-amber-500/80 transition-all pointer-events-auto rounded-[1px]"
              style={{
                left: `${x1 * 100}%`,
                top: `${y1 * 100}%`,
                width: `${w * 100}%`,
                height: `${h * 100}%`,
                backgroundColor: fillColor,
              }}
              title="Erase Box (hover and click × to delete)"
            >
              {onRemoveMaskBox && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMaskBox(m.id);
                  }}
                  className="opacity-0 group-hover/mask:opacity-100 absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-md transition-opacity cursor-pointer z-[60] pointer-events-auto"
                  title="Delete this erase box"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderRulerSurface = (side: "primary" | "secondary") => {
    if (!straightenActive) return null;
    return (
      <div
        onPointerDown={(e) => handleRulerPointerDown(side, e)}
        onPointerMove={handleRulerPointerMove}
        onPointerUp={handleRulerPointerUp}
        className="absolute inset-0 z-50 cursor-crosshair select-none touch-none"
      >
        {rulerDrag && rulerDrag.side === side && (
          <>
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <line
                x1={`${rulerDrag.x1 * 100}%`}
                y1={`${rulerDrag.y1 * 100}%`}
                x2={`${rulerDrag.x2 * 100}%`}
                y2={`${rulerDrag.y2 * 100}%`}
                stroke="#000000"
                strokeWidth={4}
                strokeOpacity={0.75}
              />
              <line
                x1={`${rulerDrag.x1 * 100}%`}
                y1={`${rulerDrag.y1 * 100}%`}
                x2={`${rulerDrag.x2 * 100}%`}
                y2={`${rulerDrag.y2 * 100}%`}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
              <circle cx={`${rulerDrag.x1 * 100}%`} cy={`${rulerDrag.y1 * 100}%`} r={4} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
              <circle cx={`${rulerDrag.x2 * 100}%`} cy={`${rulerDrag.y2 * 100}%`} r={4} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
            </svg>
            <div
              className={`absolute pointer-events-none whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-950/85 backdrop-blur-sm border border-amber-500/40 text-amber-300 font-mono text-[9px] font-semibold shadow-md transition-opacity duration-150 ${
                rulerDrag.x2 > 0.8 ? "-translate-x-full -ml-3" : "translate-x-3"
              } ${
                rulerDrag.y2 < 0.1 ? "translate-y-3" : "-translate-y-5"
              }`}
              style={{ left: `${rulerDrag.x2 * 100}%`, top: `${rulerDrag.y2 * 100}%` }}
            >
              {rulerDrag.deltaAngle > 0 ? "+" : ""}{rulerDrag.deltaAngle.toFixed(2)}°
            </div>
          </>
        )}
      </div>
    );
  };

  const renderMaskDrawSurface = (side: "primary" | "secondary") => {
    if (!maskToolActive) return null;
    return (
      <div
        onPointerDown={(e) => handleMaskPointerDown(side, e)}
        onPointerMove={handleMaskPointerMove}
        onPointerUp={handleMaskPointerUp}
        className="absolute inset-0 z-50 cursor-crosshair select-none touch-none"
      >
        {maskDrag && maskDrag.side === side && (
          <div
            className="absolute border-2 border-dashed border-amber-400 bg-white/65 backdrop-blur-[1px] shadow-md pointer-events-none"
            style={{
              left: `${Math.min(maskDrag.x1, maskDrag.x2) * 100}%`,
              top: `${Math.min(maskDrag.y1, maskDrag.y2) * 100}%`,
              width: `${Math.abs(maskDrag.x2 - maskDrag.x1) * 100}%`,
              height: `${Math.abs(maskDrag.y2 - maskDrag.y1) * 100}%`,
            }}
          />
        )}
      </div>
    );
  };

  // Dedicated Split overlay: spans across full page without any crop box border or resize handles
  const renderSplitOverlay = (side: "primary" | "secondary" = "primary") => {
    if (!isSplitMode) return null;
    const curLines = side === "secondary" ? secondarySplitLines : splitLines;
    if (!curLines || curLines.length === 0) return null;

    return (
      <div
        data-crop-overlay={side}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 select-none ${isPanMode || eyedropperActive || straightenActive || maskToolActive ? "pointer-events-none" : "pointer-events-auto"}`}
      >
        {curLines.map((line, i) => {
          const segs = getCutLineSegments(
            line,
            curLines,
            pageBaseWidthMm,
            pageBaseHeightMm
          );
          const isLineActive = activeDrag === `spine-${i}`;
          const isLineHovered = hoveredLineIndex === i;
          const showTags =
            Boolean(showSplitSizes) &&
            (curLines.length <= 1 || isLineActive || isLineHovered);

          return (
            <SplitLineOverlay
              key={i}
              line={line}
              index={i}
              active={isLineActive}
              onPointerDown={onCropPointerDown}
              onHoverChange={(hovering) => {
                if (hovering) {
                  setHoveredLineIndex(i);
                } else {
                  setHoveredLineIndex((prev) => (prev === i ? null : prev));
                }
              }}
              sizeBeforeMm={segs.sizeBeforeMm}
              sizeAfterMm={segs.sizeAfterMm}
              crossSizeMm={segs.crossSizeMm}
              unit={unit}
              unitShort={unitShort}
              showTags={showTags}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        onMouseUp();
        handleImageMouseLeave();
      }}

      style={{ backgroundImage: "radial-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      className={`flex-1 overflow-hidden bg-[var(--surface-canvas,#0A0D14)] flex items-center justify-center p-8 relative ${
        eyedropperActive || straightenActive || maskToolActive
          ? "cursor-crosshair"
          : isPanMode || zoom > 1.0
            ? (isPanning ? "cursor-grabbing" : "cursor-grab")
            : "cursor-default"
      }`}
    >
      {/* Top-Center Dimension Notch under the preview bar (z-20 so toolbar popovers z-40+ sit on top) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-b-lg bg-[#131720]/95 backdrop-blur-md border-x border-b border-[#242A38] shadow-md flex items-center space-x-2 text-[11px] font-mono text-slate-200 pointer-events-none"
      >
        <IconDimensionRuler size={12} style={{ color: ACCENT }} />
        <span className="font-semibold tracking-tight">
          {mmToUnit(effectiveWidthMm, unit)} × {mmToUnit(effectiveHeightMm, unit)}{" "}
          <span className="text-slate-400 font-normal">{unitShort}</span>
        </span>
        {isBleedActive && bleedModule && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {(bleedModule.placement || "outside") === "inside" ? "-" : "+"}{bleedModule.bleedMm}mm bleed
          </span>
        )}
      </div>

      {/* Auto-fading active tool hint pill (fades out after 1.8s so it never blocks the preview) */}
      {hintText && (
        <div
          className={`absolute top-8 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold shadow-lg pointer-events-none transition-all duration-500 ${
            hintVisible ? "opacity-95 translate-y-0" : "opacity-0 -translate-y-1.5"
          }`}
        >
          {hintText}
        </div>
      )}

      {/* Floating Loupe / Color Sample Magnifier */}
      {eyedropperActive && loupe && (
        <div
          className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-[135%] flex flex-col items-center gap-1 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
          style={{ left: loupe.x, top: loupe.y }}
        >
          <div
            className="w-11 h-11 rounded-full border-2 border-white shadow-inner flex items-center justify-center ring-2 ring-black/40"
            style={{ backgroundColor: loupe.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow ring-1 ring-black/50" />
          </div>
          <div className="px-2 py-0.5 rounded-md bg-slate-950/95 border border-white/20 text-white font-mono text-[10px] font-bold tracking-wider">
            {loupe.color.toUpperCase()}
          </div>
        </div>
      )}

      <div
        className={`relative transition-transform duration-75 ease-out flex items-center justify-center gap-4 max-h-full ${secondaryImageSrc ? "w-full" : "max-w-full"}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
      >
        {/* Column slot: in dual mode each page gets half the width so the image (and its crop overlay) never gets squeezed out of alignment. */}
        <div
          onClick={() => onSelectPrimaryPage?.()}
          className={`flex items-center justify-center max-h-full ${secondaryImageSrc ? "flex-1 min-w-0" : "max-w-full"}`}
        >
        <div className="relative flex items-center justify-center max-w-full max-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          crossOrigin="anonymous"
          src={retryKey > 0 ? (imageSrc.includes("?") ? `${imageSrc}&_r=${retryKey}` : `${imageSrc}?_r=${retryKey}`) : imageSrc}
          alt={imageAlt}
          onClick={handleImageClick}
          onMouseMove={handleImageMouseMove}
          onMouseLeave={handleImageMouseLeave}
          onLoad={handleImageLoad}
          onError={handleImageError}
          fetchPriority="high"
          decoding="async"
          className={`max-h-[calc(100vh-14rem)] max-w-full object-contain rounded-sm shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/5 transition-opacity duration-150 ${
            isImageLoading ? "opacity-60" : "opacity-100"
          } ${
            eyedropperActive ? "cursor-crosshair" : ""
          }`}
          style={{
            filter: canvasImageFilter !== "none" ? canvasImageFilter : undefined,
          }}
          draggable={false}
        />
        {/* Loading Spinner / Notification Pill */}
        {isImageLoading && showLoadingPill && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-35">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-[#2E3648] text-white shadow-xl flex items-center space-x-2 backdrop-blur-md">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <span className="text-[11px] font-medium text-slate-200">
                Loading {imageAlt}...
              </span>
            </div>
          </div>
        )}
        {/* Universal geometry overlay ref container covering the image bounds */}
        <div
          ref={overlayRef}
          data-page-overlay="primary"
          className="absolute inset-0 pointer-events-none select-none"
        />

        {/* Split Curtain Mode Layer: Raw scan clipped on the left side + interactive divider handle */}
        {isSplitCurtain && rawImageSrc && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rawImageSrc}
              alt="Raw Scan Original"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none rounded-sm z-25"
              style={{
                clipPath: `inset(0 ${(1 - (curtainPos ?? 0.5)) * 100}% 0 0)`,
              }}
              draggable={false}
            />

            {/* Split Curtain Mode Badges */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 text-slate-300 text-[10px] font-mono font-bold pointer-events-none shadow-lg z-35 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Original Scan</span>
            </div>
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold pointer-events-none shadow-lg z-35 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Processed</span>
            </div>

            {/* Draggable Vertical Curtain Divider Line & Handle */}
            <div
              onPointerDown={handleCurtainPointerDown}
              onPointerMove={handleCurtainPointerMove}
              onPointerUp={handleCurtainPointerUp}
              onPointerCancel={handleCurtainPointerUp}
              className="absolute top-0 bottom-0 w-8 -translate-x-1/2 z-40 touch-none cursor-ew-resize flex items-center justify-center group select-none"
              style={{ left: `${(curtainPos ?? 0.5) * 100}%` }}
              title="Drag horizontally to compare Original Scan vs. Processed Result"
            >
              {/* Vertical divider line */}
              <div className="w-0.5 h-full bg-amber-400 group-hover:bg-amber-300 shadow-[0_0_8px_rgba(0,0,0,0.85)] transition-colors pointer-events-none" />

              {/* Central drag circular handle */}
              <div className="absolute w-7 h-7 rounded-full bg-slate-950 border-2 border-amber-400 text-amber-300 shadow-[0_2px_14px_rgba(0,0,0,0.95)] flex items-center justify-center pointer-events-none group-hover:scale-110 group-active:scale-95 transition-transform">
                <span className="text-[11px] font-mono font-bold leading-none select-none tracking-tighter">‹›</span>
              </div>
            </div>
          </>
        )}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none rounded border overflow-hidden shadow-inner"
            style={{
              borderColor: `${gridColor}88`,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 26px, ${gridColor}99 26px, ${gridColor}99 28px), repeating-linear-gradient(to right, transparent, transparent 54px, ${gridColor}55 54px, ${gridColor}55 56px)`,
              backgroundSize: "56px 28px",
            }}
          />
        )}
        {isSplitMode ? renderSplitOverlay("primary") : renderCropOverlay(cropModule?.cropBox, "primary")}
        {renderRulerSurface("primary")}
        {renderDraftMaskOverlay(primaryDraftMaskBox ?? cleanupModule?.draftMaskBox, "primary")}
        {renderSpineBoxOverlay(primarySpineBox ?? cleanupModule?.spineBox, "primary")}
        {renderSavedMasksOverlay(pageMasks)}
        {renderMaskDrawSurface("primary")}
        </div>
        </div>

        {/* Dual Page Mode: Adjacent Second Page Preview */}
        {secondaryImageSrc && (
          <div className="flex-1 min-w-0 flex items-center justify-center max-h-full">
          <div
            onClick={() => onSelectSecondaryPage?.()}
            className="relative flex items-center justify-center max-w-full max-h-full cursor-pointer group/sec"
            title={`Click to select ${secondaryImageAlt}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              crossOrigin="anonymous"
              src={secondaryImageSrc}
              alt={secondaryImageAlt}
              onClick={handleImageClick}
              onMouseMove={handleImageMouseMove}
              onMouseLeave={handleImageMouseLeave}
              decoding="async"
              className={`max-h-[calc(100vh-14rem)] max-w-full object-contain rounded-sm shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 group-hover/sec:ring-blue-500/60 transition-all ${
                eyedropperActive ? "cursor-crosshair" : ""
              }`}
              style={{
                filter: secondaryCanvasImageFilter !== "none" ? secondaryCanvasImageFilter : undefined,
              }}
              draggable={false}
            />
            {isSplitMode
              ? renderSplitOverlay("secondary")
              : renderCropOverlay(secondaryCropBox ?? cropModule?.cropBox, "secondary")}
            {renderRulerSurface("secondary")}
            {renderDraftMaskOverlay(secondaryDraftMaskBox, "secondary")}
            {renderSpineBoxOverlay(secondarySpineBox, "secondary")}
            {renderSavedMasksOverlay(secondaryPageMasks)}
            {renderMaskDrawSurface("secondary")}

            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 border border-white/10 text-[10px] font-mono text-slate-300 pointer-events-none">
              {secondaryImageAlt}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
