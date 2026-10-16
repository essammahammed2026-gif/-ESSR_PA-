import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { groupSplitLines } from "@/lib/splitLines";
import { resolveCropTarget } from "@/lib/pageScope";
import {
  BookIntakeMode,
  BookStudioPage,
  BookProcessSettings,
  DeskewModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  SplitLine,
} from "@/types/book_studio";

/** Typed args for the unified module-config, split/crop, and export hook. */
export interface UseBookModulesArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
  recordStep?: (label: string, nextPages: BookStudioPage[], nextSelectedId?: string | null) => void;
}

interface PhaseResult {
  pages: BookStudioPage[];
  newIds: string[];
  newSelectedId: string | null;
}

const FULL_BED: CropBox = { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 };

/**
 * Unified Book Studio processing hook:
 * - Module configs (crop/deskew/bleed/restoration) & per-page crop cache
 * - Debounced slider values & consolidated settings memo
 * - Multi-phase split, revert, and crop operations
 * - Print-ready PDF export state & execution
 */
export function useBookModules({
  sessionId,
  pages,
  setPages,
  selectedPageId,
  setSelectedPageId,
  recordStep,
}: UseBookModulesArgs) {
  // Processing settings & export state
  const [previewCleaned, setPreviewCleaned] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
        cropBox: { ...FULL_BED },
        splitLines: [],
      }));
    } else if (hasCommittedCrop) {
      // Uncut spread with an already committed crop: rendered view is already cropped.
      // Overlay resets to full bed so any subsequent operation refines it.
      setCropModule((prev) => ({
        ...prev,
        cropBox: { ...FULL_BED },
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
  const updateCropModule: Dispatch<SetStateAction<CropModuleConfig>> = useCallback((action) => {
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
  }), [bleedModule, restorationModule, deskewModule]);

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
    setExportError(null);
  }, []);

  // One backend split pass along a single axis. Returns fresh pages + new slice ids.
  const runSplitPhase = useCallback(async (
    currentPages: BookStudioPage[],
    positions: number[],
    direction: "vertical" | "horizontal",
    parentIds: string[],
    applyToAll: boolean,
    targetPageIds: string[] | undefined,
  ): Promise<PhaseResult | null> => {
    if (!sessionId) return null;
    const anchorId = targetPageIds?.[0] ?? parentIds[0] ?? currentPages[0]?.id ?? selectedPageId ?? "";
    if (!anchorId && !applyToAll) return null;
    const res = await apiFetch(`/api/book-scan/split-spread/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: anchorId,
        crop_box: cropModule.cropBox,
        split_pos: positions[0] ?? 0.5,
        split_lines: positions,
        split_direction: direction,
        apply_to_all: applyToAll,
        target_page_ids: targetPageIds,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const nextPages: BookStudioPage[] = data.pages ?? currentPages;
    const beforeIds = new Set(currentPages.map((p) => p.id));
    const parentSet = new Set(parentIds);
    const newIds = nextPages
      .filter((p) => {
        if (beforeIds.has(p.id)) return false;
        if (applyToAll || parentIds.length === 0) return true;
        const parentMatch = p.parent_page_id && parentSet.has(p.parent_page_id);
        const immMatch = p.immediate_parent_id && parentSet.has(p.immediate_parent_id);
        return Boolean(parentMatch || immMatch);
      })
      .map((p) => p.id);
    return { pages: nextPages, newIds, newSelectedId: data.new_selected_id ?? null };
  }, [sessionId, cropModule.cropBox, selectedPageId]);

  // Cut along the configured cut lines across the crop target (empty = plain crop)
  const splitSpread = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    const { vertical, horizontal } = groupSplitLines(cropModule.splitLines);
    if (vertical.length === 0 && horizontal.length === 0) return;
    try {
      const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
      let applyToAll = resolved.applyToAll;
      let targetPageIds = resolved.ids;
      let parentIds = targetPageIds ?? pages.map((p) => p.id);

      let current = pages;
      let newSelectedId: string | null = null;
      // Phase 1: vertical cuts
      if (vertical.length > 0) {
        const phase = await runSplitPhase(current, vertical, "vertical", parentIds, applyToAll, targetPageIds);
        if (!phase) return;
        current = phase.pages;
        newSelectedId = phase.newSelectedId;
        // Phase 2 targets the slices just created (y-range is unchanged by vertical cuts)
        const newIdSet = new Set(phase.newIds);
        parentIds = phase.newIds.length > 0
          ? Array.from(new Set(
              phase.pages
                .filter((p) => newIdSet.has(p.id))
                .map((p) => p.immediate_parent_id || p.parent_page_id)
                .filter((id): id is string => Boolean(id))
            ))
          : parentIds;
        targetPageIds = phase.newIds.length > 0 ? phase.newIds : targetPageIds;
        applyToAll = false;
      }
      // Phase 2 (or single pass): horizontal cuts
      if (horizontal.length > 0) {
        const phase = await runSplitPhase(current, horizontal, "horizontal", parentIds, applyToAll, targetPageIds);
        if (!phase) return;
        current = phase.pages;
        newSelectedId = phase.newSelectedId ?? newSelectedId;
      }
      setPages(current);
      if (newSelectedId) {
        setSelectedPageId(newSelectedId);
      } else if (!current.some((p) => p.id === selectedPageId) && current[0]) {
        setSelectedPageId(current[0].id);
      }
      // Committed: overlay back to full bed over the new slices and clear cut lines
      clearPageCrops();
      updateCropModule((prev) => ({
        ...prev,
        cropBox: { ...FULL_BED },
        splitLines: [],
      }));
      recordStep?.("Split Sheet", current, newSelectedId ?? selectedPageId);
    } catch (err) {
      console.error("Split spread failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule, pages, setPages, setSelectedPageId, updateCropModule, runSplitPhase, clearPageCrops, recordStep]);

  // Recombine split slices back into the uncut spread
  const revertSpread = useCallback(async (mode: "current" | "all" = "current", pageId?: string) => {
    const targetId = pageId || selectedPageId;
    if (!sessionId) return;
    if (mode === "current" && !targetId) return;
    try {
      const res = await apiFetch(`/api/book-scan/revert-spread/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: mode === "current" ? targetId : undefined,
          revert_all: mode === "all",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
        clearPageCrops();
        updateCropModule((prev) => ({
          ...prev,
          cropBox: { ...FULL_BED },
          splitLines: [],
        }));
        if (data.new_selected_id) {
          setSelectedPageId(data.new_selected_id);
        }
      }
    } catch (err) {
      console.error("Revert spread failed:", err);
    }
  }, [sessionId, selectedPageId, setPages, setSelectedPageId, updateCropModule, clearPageCrops]);

  // Commit the crop box across the crop target (final: overlay resets to full bed)
  const applyCrop = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    try {
      const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
      const res = await apiFetch(`/api/book-scan/crop-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId,
          crop_box: cropModule.cropBox,
          apply_to_all: resolved.applyToAll,
          target_page_ids: resolved.ids,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
        if (resolved.applyToAll) {
          clearPageCrops();
        } else if (resolved.ids) {
          clearPageCrops(resolved.ids);
        } else if (selectedPageId) {
          clearPageCrops([selectedPageId]);
        }
        // Committed: the view now shows the cropped region, so the overlay
        // resets to full bed — repeat crops refine the visible region.
        updateCropModule((prev) => ({
          ...prev,
          cropBox: { ...FULL_BED },
          splitLines: [],
        }));
        recordStep?.("Crop Page", data.pages, selectedPageId);
      }
    } catch (err) {
      console.error("Apply crop failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule.cropBox, cropModule.target, pages, setPages, updateCropModule, clearPageCrops, recordStep]);

  // Export print-ready PDF (intakeMode supplied by the composer for the filename)
  const exportPdf = useCallback(async (intakeMode: BookIntakeMode = "single_page") => {
    if (!sessionId) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await apiFetch(`/api/book-scan/export/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bleed_mm: bleedModule.bleedMm,
          show_crop_marks: bleedModule.showCropMarks,
          dpi: bleedModule.exportDpi,
          clean_borders: restorationModule.cleanBorders,
          border_margin_px: restorationModule.borderMarginPx,
          border_threshold: restorationModule.borderThreshold,
          enhance_colors: restorationModule.enhanceColors,
          saturation: restorationModule.saturation,
          contrast: restorationModule.contrast,
          deskew: false,
          sharpen: restorationModule.sharpen,

          // Modular configurations & page scopes
          deskew_module_enabled: deskewModule.enabled,
          deskew_mode: deskewModule.mode,
          deskew_angle: deskewModule.angle,
          deskew_max_angle: deskewModule.maxAngle,
          deskew_ignore_borders: deskewModule.ignoreBorders,
          deskew_scope_mode: deskewModule.scope.mode,
          deskew_custom_range: deskewModule.scope.customRange,

          bleed_module_enabled: bleedModule.enabled,
          bleed_scope_mode: bleedModule.scope.mode,
          bleed_custom_range: bleedModule.scope.customRange,

          restoration_module_enabled: restorationModule.enabled,
          restoration_scope_mode: restorationModule.scope.mode,
          restoration_custom_range: restorationModule.scope.customRange,
        }),
      });

      if (!res.ok) {
        throw new Error("Export PDF failed on server.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `book_${intakeMode}_${bleedModule.bleedMm}mm_bleed.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  }, [sessionId, bleedModule, restorationModule, deskewModule]);

  return {
    clearPageCrops,
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
    isExporting,
    exportError,
    setExportError,
    exportPdf,
  };
}
