import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useDebounce } from "@/lib/useDebounce";
import {
  BookStudioPage,
  BookProcessSettings,
  DeskewModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  SplitLine,
} from "@/types/book_studio";
import { useBookSplitOps } from "./useBookSplitOps";

/** Typed args for the module-config hook (wired by the composer from session state). */
export interface UseBookModulesArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
}

/**
 * Module configs (crop/deskew/bleed/restoration) + debounced slider values
 * + consolidated settings memo + split/revert/crop/export ops for Book Studio.
 */
export function useBookModules({
  sessionId,
  pages,
  setPages,
  selectedPageId,
  setSelectedPageId,
}: UseBookModulesArgs) {
  // Processing settings
  const [previewCleaned, setPreviewCleaned] = useState<boolean>(true);

  // Modular Processing Framework: All modules off by default.
  // Crop starts with NO cut lines (plain crop); the operator adds lines as needed.
  const [cropModule, setCropModule] = useState<CropModuleConfig>({
    enabled: false,
    splitLines: [],
    cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
    splitPos: 0.50,
    target: { base: "all", customRange: "", parity: "both" },
  });

  // Track page-specific overrides per active page
  const [pageCrops, setPageCrops] = useState<Record<string, { cropBox: CropBox; splitPos: number; splitLines: SplitLine[] }>>({});
  const pageCropsRef = useRef(pageCrops);
  pageCropsRef.current = pageCrops;

  // Sync cropModule state when user navigates between pages
  useEffect(() => {
    if (!selectedPageId) return;
    // Per-page override applies when targeting "current" page
    const isCurrentTarget = cropModule.target.base === "current";
    const existing = isCurrentTarget ? pageCropsRef.current[selectedPageId] : undefined;
    if (existing) {
      setCropModule((prev) => ({
        ...prev,
        cropBox: existing.cropBox,
        splitPos: existing.splitPos,
        splitLines: existing.splitLines,
      }));
      return;
    }

    const currentPage = pages.find((p) => p.id === selectedPageId);
    if (!currentPage) return;

    const isSplit = Boolean(
      currentPage.half === "left" || currentPage.half === "right" ||
      currentPage.slice_box != null || currentPage.parent_page_id != null ||
      (currentPage.half && (currentPage.half.startsWith("col_") || currentPage.half.startsWith("row_")))
    );

    const hasCommittedCrop = Boolean(
      currentPage.crop_box || currentPage.spread_crop_box || currentPage.page_crop_box
    );
    const savedLines = currentPage.split_lines;
    const savedDir = currentPage.split_direction ?? "vertical";

    if (isSplit) {
      // Split page: already sliced into a single page, so no cut lines.
      // Overlay is full bed unless the operator explicitly adjusts it.
      setCropModule((prev) => ({
        ...prev,
        cropBox: { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
        splitLines: [],
      }));
    } else if (hasCommittedCrop) {
      // Uncut spread with an already committed crop: rendered view is already cropped.
      // Overlay resets to full bed so any subsequent operation refines it.
      setCropModule((prev) => ({
        ...prev,
        cropBox: { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
        splitPos: currentPage.split_pos ?? savedLines?.[0] ?? prev.splitPos,
        splitLines: savedLines && savedLines.length > 0
          ? savedLines.map((pos) => ({ pos, direction: savedDir }))
          : prev.splitLines,
      }));
    } else if (savedLines && savedLines.length > 0) {
      setCropModule((prev) => ({
        ...prev,
        splitPos: currentPage.split_pos ?? savedLines[0] ?? prev.splitPos,
        splitLines: savedLines.map((pos) => ({ pos, direction: savedDir })),
      }));
    }
    // If uncut spread and not yet committed, we KEEP cropModule as is (working template inheritance across spreads)!
  }, [selectedPageId, pages, cropModule.target.base]);

  // When user updates cropModule, save it specifically for the active page if targeting "current".
  // In "all" or "range" modes, cropModule is the shared document template across all spreads!
  const updateCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>> = useCallback((action) => {
    setCropModule((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      const synced: CropModuleConfig = {
        ...next,
        splitPos: next.splitLines.length > 0 ? next.splitLines[0].pos : next.splitPos,
      };
      if (selectedPageId && synced.target.base === "current") {
        setPageCrops((existing) => ({
          ...existing,
          [selectedPageId]: {
            cropBox: synced.cropBox,
            splitPos: synced.splitPos,
            splitLines: synced.splitLines.map((l) => ({ ...l })),
          },
        }));
      }
      return synced;
    });
  }, [selectedPageId]);

  const [deskewModule, setDeskewModule] = useState<DeskewModuleConfig>({
    enabled: false,
    mode: "auto",
    angle: 0.0,
    maxAngle: 10.0,
    ignoreBorders: true,
    showGrid: false,
    scope: { mode: "all", customRange: "" },
  });

  const [bleedModule, setBleedModule] = useState<BleedModuleConfig>({
    enabled: false,
    bleedMm: 3.0,
    showCropMarks: true,
    exportDpi: 200,
    scope: { mode: "all", customRange: "" },
  });

  const [restorationModule, setRestorationModule] = useState<RestorationModuleConfig>({
    enabled: false,
    cleanBorders: true,
    borderMarginPx: 15,
    borderThreshold: 210,
    enhanceColors: true,
    saturation: 1.30,
    contrast: 1.10,
    sharpen: true,
    scope: { mode: "all", customRange: "" },
  });

  // Export lives in useBookExport (wired by the composer with live module configs)

  // Golden Rule: Debounce reactive slider controls (350ms)
  const debouncedMargin = useDebounce(restorationModule.borderMarginPx, 350);
  const debouncedSaturation = useDebounce(restorationModule.saturation, 350);
  const debouncedContrast = useDebounce(restorationModule.contrast, 350);
  const debouncedBleed = useDebounce(bleedModule.bleedMm, 350);
  const debouncedDeskewAngle = useDebounce(deskewModule.angle, 350);

  // Consolidated settings
  const settings: BookProcessSettings = useMemo(() => ({
    bleedMm: bleedModule.bleedMm,
    showCropMarks: bleedModule.showCropMarks,
    exportDpi: bleedModule.exportDpi,
    cleanBorders: restorationModule.cleanBorders,
    borderMarginPx: restorationModule.borderMarginPx,
    borderThreshold: restorationModule.borderThreshold,
    enhanceColors: restorationModule.enhanceColors,
    saturation: restorationModule.saturation,
    contrast: restorationModule.contrast,
    deskew: false,
    sharpen: restorationModule.sharpen,
    deskewModule,
    bleedModule,
    restorationModule,
  }), [
    bleedModule,
    restorationModule,
    deskewModule,
  ]);

  // Reset module configs to defaults
  const resetModules = useCallback(() => {
    setCropModule({
      enabled: false,
      splitLines: [],
      cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
      splitPos: 0.50,
      target: { base: "all", customRange: "", parity: "both" },
    });
    setPageCrops({});
    setDeskewModule({
      enabled: false,
      mode: "auto",
      angle: 0.0,
      maxAngle: 10.0,
      ignoreBorders: true,
      showGrid: false,
      scope: { mode: "all", customRange: "" },
    });
    setBleedModule({
      enabled: false,
      bleedMm: 3.0,
      showCropMarks: true,
      exportDpi: 200,
      scope: { mode: "all", customRange: "" },
    });
    setRestorationModule({
      enabled: false,
      cleanBorders: true,
      borderMarginPx: 15,
      borderThreshold: 210,
      enhanceColors: true,
      saturation: 1.30,
      contrast: 1.10,
      sharpen: true,
      scope: { mode: "all", customRange: "" },
    });
  }, []);

  const clearPageCrops = useCallback((ids?: string[]) => {
    if (!ids) {
      setPageCrops({});
    } else {
      setPageCrops((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  }, []);

  // Split / revert / crop ops (own file to respect the 300-line cap).
  // Post-commit overlay resets go through updateCropModule so per-page memory stays in sync.
  const { splitSpread, revertSpread, applyCrop } = useBookSplitOps({
    sessionId,
    pages,
    setPages,
    selectedPageId,
    setSelectedPageId,
    cropModule,
    setCropModule: updateCropModule,
    clearPageCrops,
  });

  return {
    previewCleaned, setPreviewCleaned,
    cropModule, setCropModule: updateCropModule,
    deskewModule, setDeskewModule,
    bleedModule, setBleedModule,
    restorationModule, setRestorationModule,
    debouncedBleed,
    debouncedMargin,
    debouncedSaturation,
    debouncedContrast,
    debouncedDeskewAngle,
    settings,
    resetModules,
    splitSpread,
    revertSpread,
    applyCrop,
  };
}
