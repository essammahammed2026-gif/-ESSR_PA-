import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch, downloadBlob } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { groupSplitLines } from "@/lib/splitLines";
import { resolveCropTarget, resolveMaskTargetIds } from "@/lib/pageScope";
import {
  BookIntakeMode,
  BookStudioPage,
  BookProcessSettings,
  DeskewModuleConfig,
  CleanupModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  MaskBox,
  CleanupColorMode,
  ExportOptions,
  SplitLine,
  ExportJobProgress,
  ModuleTaskProgress,
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
const IDLE_PROGRESS: ModuleTaskProgress = { active: false, progress: 0, label: "" };

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
  const [cropActionProgress, setCropActionProgress] = useState<ModuleTaskProgress>(IDLE_PROGRESS);
  const [exportProgress, setExportProgress] = useState<ExportJobProgress>({
    jobId: null,
    status: "idle",
    progress: 0,
    stage: "idle",
    message: "",
    totalPages: 0,
    currentPage: 0,
    fileSizeBytes: null,
    error: null,
  });
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Modular Processing Framework: All modules off by default.
  // Crop starts with NO cut lines (plain crop); the operator adds lines as needed.
  const [cropModule, setCropModule] = useState<CropModuleConfig>({
    enabled: false,
    splitLines: [],
    cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
    splitPos: 0.50,
    target: { base: "all", customRange: "", parity: "both" },
    detectMode: "paper",
    appliedEntries: [],
  });

  // Track page-specific draft overrides per page (populated by batch Auto-Detect or manual per-page tweaks)
  const [pageCrops, setPageCrops] = useState<Record<string, { cropBox: CropBox; splitPos: number; splitLines: SplitLine[] }>>({});
  const pageCropsRef = useRef(pageCrops);
  pageCropsRef.current = pageCrops;

  // Sync cropModule state when user navigates between pages
  useEffect(() => {
    if (!selectedPageId) return;
    // Always restore a page's specific draft crop if one exists (e.g. from Auto-Detect All or manual adjustment)
    const existing = pageCropsRef.current[selectedPageId];
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
  }, [selectedPageId, pages]);

  // When user updates cropModule, save it specifically for the active page so browsing back & forth
  // never loses per-page adjustments.
  const updateCropModule: Dispatch<SetStateAction<CropModuleConfig>> = useCallback((action) => {
    setCropModule((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      const synced: CropModuleConfig = {
        ...next,
        splitPos: next.splitLines.length > 0 ? next.splitLines[0].pos : next.splitPos,
      };
      const geomChanged = (
        synced.cropBox.x1 !== prev.cropBox.x1 ||
        synced.cropBox.y1 !== prev.cropBox.y1 ||
        synced.cropBox.x2 !== prev.cropBox.x2 ||
        synced.cropBox.y2 !== prev.cropBox.y2 ||
        synced.splitPos !== prev.splitPos ||
        synced.splitLines.length !== prev.splitLines.length
      );
      if (selectedPageId && (synced.target.base === "current" || geomChanged || pageCropsRef.current[selectedPageId])) {
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

  const setBatchPageCrops = useCallback((
    cropsMap: Record<string, { crop_box: CropBox; split_pos: number }>,
    seedCutLine: boolean = false
  ) => {
    setPageCrops((prev) => {
      const next = { ...prev };
      for (const [pid, item] of Object.entries(cropsMap)) {
        const prevLines = prev[pid]?.splitLines ?? [];
        next[pid] = {
          cropBox: item.crop_box,
          splitPos: item.split_pos,
          splitLines: seedCutLine && prevLines.length === 0
            ? [{ pos: item.split_pos, direction: "vertical" }]
            : prevLines,
        };
      }
      return next;
    });
    if (selectedPageId && cropsMap[selectedPageId]) {
      const activeItem = cropsMap[selectedPageId];
      setCropModule((prev) => ({
        ...prev,
        enabled: true,
        cropBox: activeItem.crop_box,
        splitPos: activeItem.split_pos,
      }));
    }
  }, [selectedPageId]);

  const [deskewModule, setDeskewModule] = useState<DeskewModuleConfig>({
    enabled: false,
    mode: "auto",
    angle: 0.0,
    maxAngle: 10.0,
    ignoreBorders: true,
    showGrid: false,
    gridColor: "#06b6d4",
    scope: { mode: "all", customRange: "" },
    appliedEntries: [],
  });

  const [bleedModule, setBleedModule] = useState<BleedModuleConfig>({
    enabled: false,
    bleedMm: 3.0,
    mode: "mirror",
    solidColor: "#ffffff",
    placement: "outside",
    showCropMarks: true,
    exportDpi: 200,
    scope: { mode: "all", customRange: "" },
    appliedBleeds: [],
  });

  const [cleanupModule, setCleanupModule] = useState<CleanupModuleConfig>({
    enabled: false,
    maskScopeMode: "current",
    maskCustomRange: "",
    maskColor: "#ffffff",
    flattenIllumination: false,
    despeckleLevel: 0,
    scope: { mode: "current", customRange: "" },
    appliedEntries: [],
  });

  const [cleanupActionProgress, setCleanupActionProgress] = useState<ModuleTaskProgress>(IDLE_PROGRESS);

  const [restorationModule, setRestorationModule] = useState<RestorationModuleConfig>({
    enabled: false,
    cleanBorders: false,
    borderMarginPx: 15,
    borderThreshold: 210,
    enhanceColors: true,
    saturation: 1.30,
    contrast: 1.10,
    colorMode: "auto",
    bwThreshold: 180,
    whitenBg: false,
    sharpen: true,
    scope: { mode: "all", customRange: "" },
    appliedEntries: [],
  });

  // Responsive slider controls (50ms for live dragging preview)
  const debouncedMargin = useDebounce(restorationModule.borderMarginPx, 50);
  const debouncedSaturation = useDebounce(restorationModule.saturation, 50);
  const debouncedContrast = useDebounce(restorationModule.contrast, 50);
  const debouncedBwThreshold = useDebounce(restorationModule.bwThreshold, 50);
  const debouncedBleed = useDebounce(bleedModule.bleedMm, 50);
  const debouncedBleedColor = useDebounce(bleedModule.solidColor, 50);
  const debouncedDeskewAngle = useDebounce(deskewModule.angle, 150);

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
    cleanupModule,
    bleedModule,
    restorationModule,
  }), [bleedModule, restorationModule, deskewModule, cleanupModule]);

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
      detectMode: "paper",
      appliedEntries: [],
    });
    setPageCrops({});
    setDeskewModule({
      enabled: false,
      mode: "auto",
      angle: 0.0,
      maxAngle: 10.0,
      ignoreBorders: true,
      showGrid: false,
      gridColor: "#06b6d4",
      scope: { mode: "all", customRange: "" },
      appliedEntries: [],
    });
    setBleedModule({
      enabled: false,
      bleedMm: 3.0,
      mode: "mirror",
      solidColor: "#ffffff",
      placement: "outside",
      showCropMarks: true,
      exportDpi: 200,
      scope: { mode: "all", customRange: "" },
      appliedBleeds: [],
    });
    setCleanupModule({
      enabled: false,
      maskScopeMode: "current",
      maskCustomRange: "",
      maskColor: "#ffffff",
      flattenIllumination: false,
      despeckleLevel: 0,
      scope: { mode: "current", customRange: "" },
      appliedEntries: [],
    });
    setRestorationModule({
      enabled: false,
      cleanBorders: false,
      borderMarginPx: 15,
      borderThreshold: 210,
      enhanceColors: true,
      saturation: 1.30,
      contrast: 1.10,
      colorMode: "auto",
      bwThreshold: 180,
      whitenBg: false,
      sharpen: true,
      scope: { mode: "all", customRange: "" },
      appliedEntries: [],
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

  const formatCropScopeLabel = useCallback(() => {
    const t = cropModule.target;
    if (t.base === "current") return "Current";
    if (t.base === "range") return t.customRange?.trim() ? `Pages ${t.customRange.trim()}` : "Range";
    if (t.parity === "odds") return "Odds";
    if (t.parity === "evens") return "Evens";
    return "All";
  }, [cropModule.target]);

  // Cut along the configured cut lines across the crop target (empty = plain crop)
  const splitSpread = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    const { vertical, horizontal } = groupSplitLines(cropModule.splitLines);
    if (vertical.length === 0 && horizontal.length === 0) return;
    const prevSnapshot: BookStudioPage[] = JSON.parse(JSON.stringify(pages));
    const cutCount = vertical.length + horizontal.length;
    const scopeLbl = formatCropScopeLabel();
    setCropActionProgress({ active: true, progress: 25, label: "Splitting pages..." });
    try {
      const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
      let applyToAll = resolved.applyToAll;
      let targetPageIds = resolved.ids;
      let parentIds = targetPageIds ?? pages.map((p) => p.id);

      let current = pages;
      let newSelectedId: string | null = null;
      // Phase 1: vertical cuts
      if (vertical.length > 0) {
        setCropActionProgress({ active: true, progress: 45, label: "Applying vertical cuts..." });
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
        setCropActionProgress({ active: true, progress: 75, label: "Applying horizontal cuts..." });
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
        appliedEntries: [
          ...(prev.appliedEntries || []),
          {
            id: `split_${Date.now()}`,
            label: `Split (${cutCount} cut${cutCount > 1 ? "s" : ""})`,
            scopeLabel: scopeLbl,
            prevPagesSnapshot: prevSnapshot,
          },
        ],
      }));
      setCropActionProgress({ active: true, progress: 100, label: "Split complete" });
      recordStep?.("Split Sheet", current, newSelectedId ?? selectedPageId);
    } catch (err) {
      console.error("Split spread failed:", err);
    } finally {
      setTimeout(() => setCropActionProgress(IDLE_PROGRESS), 250);
    }
  }, [sessionId, selectedPageId, cropModule, pages, setPages, setSelectedPageId, updateCropModule, runSplitPhase, clearPageCrops, recordStep, formatCropScopeLabel]);

  // Recombine split slices back into the uncut spread
  const revertSpread = useCallback(async (mode: "current" | "all" = "current", pageId?: string) => {
    const targetId = pageId || selectedPageId;
    if (!sessionId) return;
    if (mode === "current" && !targetId) return;
    setCropActionProgress({ active: true, progress: 40, label: "Reverting split..." });
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
        setCropActionProgress({ active: true, progress: 100, label: "Revert complete" });
      }
    } catch (err) {
      console.error("Revert spread failed:", err);
    } finally {
      setTimeout(() => setCropActionProgress(IDLE_PROGRESS), 250);
    }
  }, [sessionId, selectedPageId, setPages, setSelectedPageId, updateCropModule, clearPageCrops]);

  // Commit the crop box across the crop target (final: overlay resets to full bed)
  const applyCrop = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    const prevSnapshot: BookStudioPage[] = JSON.parse(JSON.stringify(pages));
    const scopeLbl = formatCropScopeLabel();
    const modeLabel = (cropModule.detectMode || "paper") === "content" ? "Content" : "Paper";
    const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
    const targetIdSet = resolved.applyToAll
      ? new Set(pages.map((p) => p.id))
      : new Set(resolved.ids ?? [selectedPageId]);
    setCropActionProgress({
      active: true,
      progress: 45,
      label: `Applying crop to ${targetIdSet.size} page${targetIdSet.size === 1 ? "" : "s"}...`,
    });
    try {
      const perPageCropsPayload: Record<string, CropBox> = {};
      for (const [pid, draft] of Object.entries(pageCropsRef.current)) {
        if (targetIdSet.has(pid)) {
          perPageCropsPayload[pid] = draft.cropBox;
        }
      }

      const res = await apiFetch(`/api/book-scan/crop-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId,
          crop_box: cropModule.cropBox,
          apply_to_all: resolved.applyToAll,
          target_page_ids: resolved.ids,
          per_page_crops: Object.keys(perPageCropsPayload).length > 0 ? perPageCropsPayload : undefined,
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
          appliedEntries: [
            ...(prev.appliedEntries || []),
            {
              id: `crop_${Date.now()}`,
              label: `Crop (${modeLabel})`,
              scopeLabel: scopeLbl,
              prevPagesSnapshot: prevSnapshot,
            },
          ],
        }));
        setCropActionProgress({ active: true, progress: 100, label: `Cropped ${targetIdSet.size} page${targetIdSet.size === 1 ? "" : "s"}` });
        recordStep?.("Crop Page", data.pages, selectedPageId);
      }
    } catch (err) {
      console.error("Apply crop failed:", err);
    } finally {
      setTimeout(() => setCropActionProgress(IDLE_PROGRESS), 250);
    }
  }, [sessionId, selectedPageId, cropModule.cropBox, cropModule.target, cropModule.detectMode, pages, setPages, updateCropModule, clearPageCrops, recordStep, formatCropScopeLabel]);

  // Reverse an applied crop/split entry by restoring its saved page snapshot
  const removeAppliedCrop = useCallback(async (entryId: string) => {
    const entry = (cropModule.appliedEntries || []).find((e) => e.id === entryId);
    setCropModule((prev) => ({
      ...prev,
      appliedEntries: (prev.appliedEntries || []).filter((e) => e.id !== entryId),
    }));
    if (!entry?.prevPagesSnapshot || !sessionId) return;
    const snapshot = entry.prevPagesSnapshot.map((p) => ({
      ...p,
      rev: (p.rev ?? 0) + 1,
    }));
    setPages(snapshot);
    clearPageCrops();
    try {
      const res = await apiFetch(`/api/book-scan/restore-pages/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: snapshot }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
          recordStep?.("Undo Crop", data.pages, selectedPageId);
        }
      }
    } catch (err) {
      console.error("Failed to reverse applied crop:", err);
    }
  }, [cropModule.appliedEntries, sessionId, setPages, clearPageCrops, recordStep, selectedPageId]);

  const dismissExportProgress = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setExportProgress((prev) => ({ ...prev, status: "idle" }));
    setIsExporting(false);
  }, []);

  // Add a spot mask box across the unified cleanupModule.scope (Current, All, Odds, Evens, Range)
  const applyMaskBox = useCallback(async (box: CropBox, selectedPageIds: string[] = []) => {
    if (!sessionId || !selectedPageId) return;
    const scopeMode = cleanupModule.scope?.mode || "current";
    const scopeRange = cleanupModule.scope?.customRange || "";
    const { ids: targetIds, label: targetLabel } = resolveMaskTargetIds(
      pages,
      selectedPageId,
      selectedPageIds,
      scopeMode,
      scopeRange
    );
    if (targetIds.length === 0) return;

    const maskBox: MaskBox = {
      id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      x1: Math.round(box.x1 * 10000) / 10000,
      y1: Math.round(box.y1 * 10000) / 10000,
      x2: Math.round(box.x2 * 10000) / 10000,
      y2: Math.round(box.y2 * 10000) / 10000,
      color: cleanupModule.maskColor || "#ffffff",
    };

    // Optimistic 0ms update so the erase box appears immediately on canvas
    const targetIdSet = new Set(targetIds);
    setPages((prev) =>
      prev.map((p) =>
        targetIdSet.has(p.id)
          ? { ...p, masks: [...(p.masks || []), maskBox], rev: (p.rev ?? 0) + 1 }
          : p
      )
    );

    setCleanupActionProgress({
      active: true,
      progress: 45,
      label: `Applying erase box (${targetLabel})...`,
    });

    try {
      const res = await apiFetch(`/api/book-scan/mask-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          page_id: selectedPageId,
          mask: maskBox,
          mask_box: maskBox,
          target_page_ids: targetIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
          recordStep?.(`Erase Box (${targetLabel})`, data.pages, selectedPageId);
        }
        setCleanupActionProgress({
          active: true,
          progress: 100,
          label: `Added box (${targetIds.length}p)`,
        });
      }
    } catch (err) {
      console.error("Failed to apply mask box:", err);
    } finally {
      setTimeout(() => setCleanupActionProgress(IDLE_PROGRESS), 250);
    }
  }, [sessionId, selectedPageId, pages, cleanupModule.scope, cleanupModule.maskColor, setPages, recordStep]);

  // Remove a single mask box by its ID (across all pages where that shared mask ID exists)
  const removeMaskBox = useCallback(async (maskId: string) => {
    if (!sessionId) return;
    // Optimistic immediate removal
    setPages((prev) =>
      prev.map((p) => {
        if (!p.masks || !p.masks.some((m) => m.id === maskId)) return p;
        return {
          ...p,
          masks: p.masks.filter((m) => m.id !== maskId),
          rev: (p.rev ?? 0) + 1,
        };
      })
    );
    setCleanupActionProgress({ active: true, progress: 50, label: "Removing box..." });
    try {
      const res = await apiFetch(`/api/book-scan/mask-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          mask_id: maskId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
          recordStep?.("Remove Erase Box", data.pages, selectedPageId);
        }
        setCleanupActionProgress({ active: true, progress: 100, label: "Box removed" });
      }
    } catch (err) {
      console.error("Failed to remove mask:", err);
    } finally {
      setTimeout(() => setCleanupActionProgress(IDLE_PROGRESS), 200);
    }
  }, [sessionId, selectedPageId, setPages, recordStep]);

  // Clear all masks on the current page (or explicit page IDs)
  const clearPageMasks = useCallback(async (targetIds?: string[]) => {
    if (!sessionId) return;
    const ids = targetIds && targetIds.length > 0 ? targetIds : (selectedPageId ? [selectedPageId] : []);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setPages((prev) =>
      prev.map((p) =>
        idSet.has(p.id) ? { ...p, masks: [], rev: (p.rev ?? 0) + 1 } : p
      )
    );
    setCleanupActionProgress({ active: true, progress: 50, label: "Clearing page boxes..." });
    try {
      const res = await apiFetch(`/api/book-scan/mask-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_page",
          page_id: selectedPageId ?? undefined,
          target_page_ids: ids,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
          recordStep?.("Clear Page Boxes", data.pages, selectedPageId);
        }
        setCleanupActionProgress({ active: true, progress: 100, label: "Cleared page boxes" });
      }
    } catch (err) {
      console.error("Failed to clear page masks:", err);
    } finally {
      setTimeout(() => setCleanupActionProgress(IDLE_PROGRESS), 200);
    }
  }, [sessionId, selectedPageId, setPages, recordStep]);

  // Clear every spot mask across the entire book
  const clearAllMasks = useCallback(async () => {
    if (!sessionId) return;
    setPages((prev) =>
      prev.map((p) => (p.masks && p.masks.length > 0 ? { ...p, masks: [], rev: (p.rev ?? 0) + 1 } : p))
    );
    setCleanupActionProgress({ active: true, progress: 50, label: "Clearing all boxes..." });
    try {
      const res = await apiFetch(`/api/book-scan/mask-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
          recordStep?.("Clear All Boxes", data.pages, selectedPageId);
        }
        setCleanupActionProgress({ active: true, progress: 100, label: "All boxes cleared" });
      }
    } catch (err) {
      console.error("Failed to clear all masks:", err);
    } finally {
      setTimeout(() => setCleanupActionProgress(IDLE_PROGRESS), 250);
    }
  }, [sessionId, selectedPageId, setPages, recordStep]);

  // Set or clear per-page color mode override ("auto" | "color" | "grayscale" | "bw" | null)
  const setPageColorMode = useCallback(async (
    colorMode: CleanupColorMode | null,
    targetIds?: string[],
    clearAll: boolean = false
  ) => {
    if (!sessionId) return;
    const ids = targetIds && targetIds.length > 0 ? targetIds : (selectedPageId ? [selectedPageId] : []);
    if (!clearAll && ids.length === 0) return;

    // Optimistic update
    const idSet = new Set(ids);
    setPages((prev) =>
      prev.map((p) => {
        if (clearAll) {
          if (!p.color_mode) return p;
          const next = { ...p, rev: (p.rev ?? 0) + 1 };
          delete next.color_mode;
          return next;
        }
        if (idSet.has(p.id)) {
          const next = { ...p, rev: (p.rev ?? 0) + 1 };
          if (colorMode) next.color_mode = colorMode;
          else delete next.color_mode;
          return next;
        }
        return p;
      })
    );
    if (colorMode) {
      setRestorationModule((prev) => ({ ...prev, enabled: true }));
    }

    try {
      await apiFetch(`/api/book-scan/color-mode-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId ?? undefined,
          color_mode: colorMode ?? "",
          target_page_ids: clearAll ? undefined : ids,
          clear_all: clearAll,
        }),
      });
    } catch (err) {
      console.error("Failed to persist per-page color mode:", err);
    }
  }, [sessionId, selectedPageId, setPages]);

  // Export print-ready PDF or multi-format ZIP archive with real-time job progress tracking
  const exportPdf = useCallback(async (
    intakeMode: BookIntakeMode = "single_page",
    options?: ExportOptions
  ) => {
    if (!sessionId) return;
    setIsExporting(true);
    setExportError(null);

    const exportFormat = options?.format || "pdf";
    const exportDpi = options?.dpi || bleedModule.exportDpi || 200;
    const exportQuality = options?.quality ?? 88;
    const tiffCompression = options?.tiffCompression || "lzw";

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setExportProgress({
      jobId: null,
      status: "pending",
      progress: 0,
      stage: "queued",
      message: "Submitting export job...",
      totalPages: pages.length,
      currentPage: 0,
      fileSizeBytes: null,
      error: null,
    });

    // Collect any per-page uncommitted draft crops, deskew angles, and color modes so export never overrides user edits
    const draftCropsMap: Record<string, CropBox> = {};
    for (const [pid, draft] of Object.entries(pageCropsRef.current)) {
      draftCropsMap[pid] = draft.cropBox;
    }
    const perPageAnglesMap: Record<string, number> = {};
    const perPageColorsMap: Record<string, string> = {};
    for (const p of pages) {
      if (p.deskew_angle !== undefined && p.deskew_angle !== null) {
        perPageAnglesMap[p.id] = Number(p.deskew_angle);
      }
      if (p.color_mode) {
        perPageColorsMap[p.id] = p.color_mode;
      }
    }

    const activeIdx = selectedPageId ? pages.findIndex((p) => p.id === selectedPageId) : -1;
    const activePageNum = activeIdx >= 0 ? activeIdx + 1 : 1;
    const resolveExportScope = (sc: { mode: string; customRange: string }) => {
      if (sc.mode === "current") {
        return { mode: "range", customRange: String(activePageNum) };
      }
      return sc;
    };

    const exportPayload = {
      export_format: exportFormat,
      tiff_compression: tiffCompression,
      bleed_mm: bleedModule.bleedMm,
      bleed_mode: bleedModule.mode,
      bleed_color: bleedModule.solidColor,
      bleed_placement: bleedModule.placement,
      show_crop_marks: bleedModule.showCropMarks,
      dpi: exportDpi,
      quality: exportQuality,
      optimize_compression: true,
      clean_borders: restorationModule.cleanBorders,
      border_margin_px: restorationModule.borderMarginPx,
      border_threshold: restorationModule.borderThreshold,
      enhance_colors: restorationModule.enhanceColors,
      saturation: restorationModule.saturation,
      contrast: restorationModule.contrast,
      color_mode: restorationModule.colorMode,
      bw_threshold: restorationModule.bwThreshold,
      whiten_bg: restorationModule.whitenBg,
      deskew: false,
      sharpen: restorationModule.sharpen,

      // Modular configurations & page scopes
      deskew_module_enabled: deskewModule.enabled,
      deskew_mode: deskewModule.mode,
      deskew_angle: deskewModule.angle,
      deskew_max_angle: deskewModule.maxAngle,
      deskew_ignore_borders: deskewModule.ignoreBorders,
      deskew_scope_mode: resolveExportScope(deskewModule.scope).mode,
      deskew_custom_range: resolveExportScope(deskewModule.scope).customRange,
      per_page_deskew_angles: Object.keys(perPageAnglesMap).length > 0 ? perPageAnglesMap : undefined,
      per_page_crops: cropModule.enabled && Object.keys(draftCropsMap).length > 0 ? draftCropsMap : undefined,
      per_page_color_modes: Object.keys(perPageColorsMap).length > 0 ? perPageColorsMap : undefined,

      cleanup_module_enabled: cleanupModule.enabled,
      flatten_illumination: cleanupModule.flattenIllumination,
      despeckle_level: cleanupModule.despeckleLevel,
      cleanup_scope_mode: resolveExportScope(cleanupModule.scope).mode,
      cleanup_custom_range: resolveExportScope(cleanupModule.scope).customRange,

      bleed_module_enabled: bleedModule.enabled,
      bleed_scope_mode: resolveExportScope(bleedModule.scope).mode,
      bleed_custom_range: resolveExportScope(bleedModule.scope).customRange,

      restoration_module_enabled: restorationModule.enabled,
      restoration_scope_mode: resolveExportScope(restorationModule.scope).mode,
      restoration_custom_range: resolveExportScope(restorationModule.scope).customRange,
    };

    try {
      const startRes = await apiFetch(`/api/book-scan/export-job/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload),
      });

      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start export job.");
      }

      const { job_id, total_pages } = await startRes.json();
      setExportProgress((prev) => ({
        ...prev,
        jobId: job_id,
        status: "processing",
        progress: 2,
        stage: "processing_pages",
        message: `Processing 1 of ${total_pages || pages.length}...`,
        totalPages: total_pages || pages.length,
      }));

      // Poll every 350ms for smooth progress animation
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await apiFetch(`/api/book-scan/export-job/${job_id}`);
          if (!pollRes.ok) return;
          const data = await pollRes.json();

          setExportProgress({
            jobId: job_id,
            status: data.status,
            progress: data.progress ?? 0,
            stage: data.stage ?? "processing",
            message: data.message ?? "",
            totalPages: data.total_pages ?? pages.length,
            currentPage: data.current_page ?? 0,
            fileSizeBytes: data.file_size_bytes ?? null,
            error: data.error ?? null,
          });

          if (data.status === "success") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsExporting(false);

            const isArchive = exportFormat !== "pdf";
            const targetFilename = isArchive
              ? `book_${intakeMode}_${exportFormat}_${exportDpi}dpi.zip`
              : `book_${intakeMode}_${bleedModule.bleedMm}mm_bleed.pdf`;
            const downloadUrl = data.download_url || `/api/book-scan/export-download/${job_id}`;
            downloadBlob(downloadUrl, targetFilename).catch((e) => {
              console.error("Auto download failed:", e);
            });
          } else if (data.status === "failed") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsExporting(false);
            setExportError(data.error || "Export failed.");
          }
        } catch (pollErr) {
          console.warn("Export polling hiccup:", pollErr);
        }
      }, 350);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
      setExportProgress((prev) => ({
        ...prev,
        status: "failed",
        error: msg,
        message: `Failed: ${msg}`,
      }));
      setIsExporting(false);
    }
  }, [sessionId, pages, selectedPageId, cropModule.enabled, bleedModule, cleanupModule, restorationModule, deskewModule]);

  return {
    pageCrops,
    setBatchPageCrops,
    clearPageCrops,
    previewCleaned, setPreviewCleaned,
    cropModule, setCropModule: updateCropModule,
    deskewModule, setDeskewModule,
    cleanupModule, setCleanupModule,
    bleedModule, setBleedModule,
    restorationModule, setRestorationModule,
    debouncedBleed,
    debouncedBleedColor,
    debouncedMargin,
    debouncedSaturation,
    debouncedContrast,
    debouncedBwThreshold,
    debouncedDeskewAngle,
    settings,
    resetModules,
    splitSpread,
    revertSpread,
    applyCrop,
    removeAppliedCrop,
    applyMaskBox,
    removeMaskBox,
    clearPageMasks,
    clearAllMasks,
    setPageColorMode,
    cropActionProgress,
    cleanupActionProgress,
    isExporting,
    exportError,
    setExportError,
    exportPdf,
    exportProgress,
    dismissExportProgress,
  };
}
