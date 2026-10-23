import { useState, useEffect, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import { type LengthUnit, getStoredUnit, setStoredUnit } from "@/lib/units";
import { resolveCropTarget } from "@/lib/pageScope";
import { getNextCutLine } from "@/lib/splitLines";
import { useBookSession } from "./useBookSession";
import { useBookModules } from "./useBookModules";
import { useBookPageOps } from "./useBookPageOps";
import { useBookHistory } from "./useBookHistory";
import { useBookShortcuts, DEFAULT_BOOK_SHORTCUTS } from "./useBookShortcuts";
import type { CropBox, DetectCropResult, FocusedModuleId, ExportOptions } from "@/types/book_studio";

/**
 * Composer for Book Studio state.
 * Combines useBookSession (session lifecycle + page CRUD) with
 * useBookModules (module configs + processing & export ops), preserving the exact
 * return API consumed by book-studio/page.tsx.
 */
export function useBookStudioState() {
  const [unit, setUnitState] = useState<LengthUnit>("mm");
  const setUnit = useCallback((next: LengthUnit) => {
    setUnitState(next);
    setStoredUnit(next);
  }, []);

  useEffect(() => {
    setUnitState(getStoredUnit("mm"));
  }, []);

  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [eyedropperActive, setEyedropperActive] = useState<boolean>(false);
  const [straightenActive, setStraightenActive] = useState<boolean>(false);
  const [maskToolActive, setMaskToolActive] = useState<boolean>(false);
  const [focusedModule, setFocusedModule] = useState<FocusedModuleId | null>(null);

  const [shortcuts, setShortcuts] = useState<Record<string, string>>({
    ...DEFAULT_BOOK_SHORTCUTS,
  });
  const [historyLimit, setHistoryLimit] = useState<number>(50);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.book_studio) {
          if (data.book_studio.history_limit) setHistoryLimit(data.book_studio.history_limit);
          if (data.book_studio.shortcuts) {
            setShortcuts((prev) => ({ ...prev, ...data.book_studio.shortcuts }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const session = useBookSession();

  // Keep selectedPageIds valid when pages list changes or selectedPageId initializes
  useEffect(() => {
    const validIds = new Set(session.pages.map((p) => p.id));
    setSelectedPageIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length > 0) return filtered;
      return session.selectedPageId && validIds.has(session.selectedPageId)
        ? [session.selectedPageId]
        : [];
    });
  }, [session.pages, session.selectedPageId]);

  const history = useBookHistory({
    sessionId: session.sessionId,
    pages: session.pages,
    setPages: session.setPages,
    selectedPageId: session.selectedPageId,
    setSelectedPageId: session.setSelectedPageId,
    maxLimit: historyLimit,
  });

  const pageOps = useBookPageOps({
    sessionId: session.sessionId,
    pages: session.pages,
    setPages: session.setPages,
    selectedPageId: session.selectedPageId,
    setSelectedPageId: session.setSelectedPageId,
    recordStep: history.recordStep,
  });

  const modules = useBookModules({
    sessionId: session.sessionId,
    pages: session.pages,
    setPages: session.setPages,
    selectedPageId: session.selectedPageId,
    setSelectedPageId: session.setSelectedPageId,
    recordStep: history.recordStep,
  });

  const jumpToStep = useCallback(async (index: number) => {
    modules.clearPageCrops();
    await history.jumpToStep(index);
  }, [modules, history]);

  const undo = useCallback(() => {
    modules.clearPageCrops();
    history.undo();
  }, [modules, history]);

  const redo = useCallback(() => {
    modules.clearPageCrops();
    history.redo();
  }, [modules, history]);

  const revertToOriginal = useCallback(() => {
    modules.clearPageCrops();
    history.revertToOriginal();
  }, [modules, history]);

  // Initialize history when session loads pages
  const initSession = useCallback(async (arg?: string | File[]) => {
    const data = await session.initSession(arg);
    if (data?.pages && data.pages.length > 0) {
      history.initHistory(data.pages, data.pages[0]?.id ?? null);
      setSelectedPageIds([data.pages[0].id]);
    }
    return data;
  }, [session, history]);

  useEffect(() => {
    if (session.sessionId && session.pages.length > 0 && history.history.length === 0) {
      history.initHistory(session.pages, session.selectedPageId);
    }
  }, [session.sessionId, session.pages, session.selectedPageId, history]);

  // Detect deskew angle using the live deskew-module tolerances
  const detectPageAngle = useCallback(async (pageId?: string): Promise<number | null> => {
    modules.setDeskewModule((prev) => ({ ...prev, enabled: true }));
    return session.detectPageAngle(pageId, {
      maxAngle: modules.deskewModule.maxAngle,
      ignoreBorders: modules.deskewModule.ignoreBorders,
    });
  }, [session, modules]);

  const detectAllPageAngles = useCallback(async (targetPageIds?: string[]): Promise<Record<string, number> | null> => {
    modules.setDeskewModule((prev) => ({ ...prev, enabled: true }));
    return session.detectAllPageAngles(
      {
        maxAngle: modules.deskewModule.maxAngle,
        ignoreBorders: modules.deskewModule.ignoreBorders,
      },
      targetPageIds
    );
  }, [session, modules]);

  const deskewSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (deskewSyncTimeoutRef.current) {
        clearTimeout(deskewSyncTimeoutRef.current);
      }
    };
  }, []);

  const setPageDeskewAngle = useCallback((pageId: string, angle: number) => {
    if (!session.sessionId) return;
    const rounded = Math.round(angle * 100) / 100;
    // Optimistically update local page deskew_angle + rev so canvas updates immediately
    session.setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, deskew_angle: rounded, rev: (p.rev ?? 0) + 1 } : p))
    );
    modules.setDeskewModule((prev) => ({
      ...prev,
      enabled: true,
      angle: rounded,
    }));

    // Debounce network persistence (~350ms) to prevent server flooding while dragging slider
    if (deskewSyncTimeoutRef.current) {
      clearTimeout(deskewSyncTimeoutRef.current);
    }
    const currentSessionId = session.sessionId;
    deskewSyncTimeoutRef.current = setTimeout(async () => {
      try {
        await apiFetch(`/api/book-scan/deskew-page/${currentSessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: pageId, angle: rounded }),
        });
      } catch (err) {
        console.error("Failed to persist per-page deskew angle:", err);
      }
    }, 350);
  }, [session, modules]);

  // Detect crop boundary, then apply the result to the crop module
  const detectCrop = useCallback(async (
    pageId?: string
  ): Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null> => {
    const mode = modules.cropModule.detectMode || "paper";
    const data: DetectCropResult | null = await session.detectCrop(pageId, mode);
    if (data) {
      modules.setCropModule((prev) => ({
        ...prev,
        enabled: true,
        cropBox: data.crop_box,
        splitPos: data.split_pos,
      }));
    }
    return data;
  }, [session, modules]);

  const detectAllCrops = useCallback(async (): Promise<void> => {
    const mode = modules.cropModule.detectMode || "paper";
    const resolved = resolveCropTarget(session.pages, session.selectedPageId, modules.cropModule.target);
    const cropsMap = await session.detectAllCrops(mode, resolved.ids);
    if (cropsMap) {
      modules.setBatchPageCrops(cropsMap, false);
    }
  }, [session, modules]);

  const clearAllDeskewAngles = useCallback(async () => {
    if (!session.sessionId) return;
    session.setPages((prev) =>
      prev.map((p) => {
        if (p.deskew_angle === undefined && p.deskew_angle === null) return p;
        const next = { ...p, rev: (p.rev ?? 0) + 1 };
        delete next.deskew_angle;
        return next;
      })
    );
    modules.setDeskewModule((prev) => ({
      ...prev,
      enabled: false,
      angle: 0,
      appliedEntries: [],
    }));
    try {
      await apiFetch(`/api/book-scan/deskew-page/${session.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear_all: true }),
      });
    } catch (err) {
      console.error("Failed to clear all deskew angles:", err);
    }
  }, [session, modules]);

  const openModule = useCallback((mod: FocusedModuleId | null) => {
    setFocusedModule(mod);
    // Explicitly toggle crop guide overlay ONLY when in the Crop module
    modules.setCropModule((prev) => ({ ...prev, enabled: mod === "crop" }));
    if (mod === null) {
      setStraightenActive(false);
      setMaskToolActive(false);
      setEyedropperActive(false);
      return;
    }
    // We do NOT auto-enable deskew, cleanup, restore, or bleed on enter.
    // They are only enabled when the user explicitly clicks "Apply" in each module.
  }, [modules]);

  const { formatCombo } = useBookShortcuts({
    handlers: {
      undo,
      redo,
      restoreOriginal: revertToOriginal,
      rotateCW: () => {
        if (selectedPageIds.length > 1) {
          pageOps.rotatePages(selectedPageIds, 90);
        } else if (session.selectedPageId) {
          pageOps.rotatePage(session.selectedPageId, 90);
        }
      },
      toggleStraighten: () => {
        openModule("deskew");
        setMaskToolActive(false);
        setEyedropperActive(false);
        setStraightenActive((prev) => !prev);
      },
      toggleMaskTool: () => {
        openModule("cleanup");
        setStraightenActive(false);
        setEyedropperActive(false);
        setMaskToolActive((prev) => !prev);
      },
      toggleCropTool: () => {
        setFocusedModule("crop");
        modules.setCropModule((prev) => ({ ...prev, enabled: !prev.enabled }));
      },
      addCutLine: () => {
        openModule("crop");
        modules.setCropModule((prev) => {
          const nextLine = getNextCutLine(prev.splitLines);
          return {
            ...prev,
            enabled: true,
            splitLines: [...prev.splitLines, nextLine],
          };
        });
      },
      toggleGrid: () => {
        modules.setDeskewModule((prev) => ({ ...prev, enabled: true, showGrid: !prev.showGrid }));
      },
      toggleEyedropper: () => {
        openModule("bleed");
        modules.setBleedModule((prev) => ({ ...prev, enabled: true, mode: "solid" }));
        setStraightenActive(false);
        setMaskToolActive(false);
        setEyedropperActive((prev) => !prev);
      },
      detectPage: () => {
        if (focusedModule === "deskew") {
          void detectPageAngle();
        } else {
          openModule("crop");
          void detectCrop();
        }
      },
      detectAll: () => {
        if (focusedModule === "deskew") {
          void detectAllPageAngles();
        } else {
          openModule("crop");
          void detectAllCrops();
        }
      },
      applyAction: () => {
        if (focusedModule === "crop" || modules.cropModule.enabled) {
          if (modules.cropModule.splitLines.length > 0) {
            void modules.splitSpread();
          } else {
            void modules.applyCrop();
          }
        }
      },
      focusModule: (idx: number) => {
        const order: FocusedModuleId[] = ["crop", "deskew", "cleanup", "restore", "bleed"];
        const picked = order[idx - 1];
        if (picked) openModule(picked);
      },
      exitModule: () => {
        if (straightenActive || maskToolActive || eyedropperActive) {
          setStraightenActive(false);
          setMaskToolActive(false);
          setEyedropperActive(false);
        } else if (focusedModule !== null) {
          setFocusedModule(null);
        }
      },
    },
    shortcuts,
    enabled: Boolean(session.sessionId),
  });

  const shortcutLabels = useMemo(() => ({
    undo: formatCombo("undo"),
    redo: formatCombo("redo"),
    restore_original: formatCombo("restore_original"),
    prev_page: formatCombo("prev_page"),
    next_page: formatCombo("next_page"),
    toggle_original: formatCombo("toggle_original"),
    rotate: formatCombo("rotate"),
    zoom_in: formatCombo("zoom_in"),
    zoom_out: formatCombo("zoom_out"),
    zoom_reset: formatCombo("zoom_reset"),
    pan: formatCombo("pan"),
    straighten_tool: formatCombo("straighten_tool"),
    mask_tool: formatCombo("mask_tool"),
    crop_toggle: formatCombo("crop_toggle"),
    add_cut: formatCombo("add_cut"),
    grid_toggle: formatCombo("grid_toggle"),
    eyedropper: formatCombo("eyedropper"),
    detect_page: formatCombo("detect_page"),
    detect_all: formatCombo("detect_all"),
    apply_action: formatCombo("apply_action"),
    module_crop: formatCombo("module_crop") || "1",
    module_deskew: formatCombo("module_deskew") || "2",
    module_cleanup: formatCombo("module_cleanup") || "3",
    module_restore: formatCombo("module_restore") || "4",
    module_bleed: formatCombo("module_bleed") || "5",
    exit_module: formatCombo("exit_module") || "Esc",
  }), [formatCombo]);

  // Merged error state (session init errors + export errors)
  const error: string | null = session.error ?? modules.exportError ?? null;
  const setError: Dispatch<SetStateAction<string | null>> = useCallback((value) => {
    const resolved = typeof value === "function"
      ? (value as (prev: string | null) => string | null)(session.error ?? modules.exportError ?? null)
      : value;
    session.setError(resolved);
    modules.setExportError(resolved);
  }, [session, modules]);

  // Thumbnail URL builder wired with debounced module values
  const getThumbnailUrl = useCallback((pageId: string, isClean: boolean, dpi: number = 100): string => {
    return session.buildThumbnailUrl(pageId, isClean, dpi, {
      deskewEnabled: modules.deskewModule.enabled,
      deskewScope: modules.deskewModule.scope,
      deskewMode: modules.deskewModule.mode,
      deskewAngle: modules.debouncedDeskewAngle,
      deskewMaxAngle: modules.deskewModule.maxAngle,
      deskewIgnoreBorders: modules.deskewModule.ignoreBorders,
      cleanupEnabled: modules.cleanupModule.enabled,
      cleanupScope: modules.cleanupModule.scope,
      flattenIllumination: modules.cleanupModule.flattenIllumination,
      despeckleLevel: modules.cleanupModule.despeckleLevel,
      restorationEnabled: modules.restorationModule.enabled,
      restorationScope: modules.restorationModule.scope,
      cleanBorders: modules.restorationModule.cleanBorders,
      borderMarginPx: modules.debouncedMargin,
      borderThreshold: modules.restorationModule.borderThreshold,
      enhanceColors: modules.restorationModule.enhanceColors,
      saturation: modules.debouncedSaturation,
      contrast: modules.debouncedContrast,
      colorMode: modules.restorationModule.colorMode,
      bwThreshold: modules.debouncedBwThreshold,
      whitenBg: modules.restorationModule.whitenBg,
      bleedEnabled: modules.bleedModule.enabled,
      bleedScope: modules.bleedModule.scope,
      bleedMm: modules.debouncedBleed,
      bleedMode: modules.bleedModule.mode,
      bleedColor: modules.debouncedBleedColor,
      bleedPlacement: modules.bleedModule.placement,
      showCropMarks: modules.bleedModule.showCropMarks,
      deskewAppliedEntries: modules.deskewModule.appliedEntries,
      cleanupAppliedEntries: modules.cleanupModule.appliedEntries,
      restorationAppliedEntries: modules.restorationModule.appliedEntries,
      bleedAppliedEntries: modules.bleedModule.appliedBleeds,
    });
  }, [session, modules]);

  // Export wired with the live intake mode and optional multi-format export options
  const exportPdf = useCallback(async (options?: ExportOptions): Promise<void> => {
    await modules.exportPdf(session.intakeMode, options);
  }, [session, modules]);

  const applyMaskBox = useCallback(async (box: CropBox): Promise<void> => {
    await modules.applyMaskBox(box, selectedPageIds);
  }, [modules, selectedPageIds]);

  // Reset session + module configs + history
  const resetJob = useCallback(() => {
    session.resetSession();
    modules.resetModules();
    history.resetHistory();
    setSelectedPageIds([]);
    setEyedropperActive(false);
    setStraightenActive(false);
    setMaskToolActive(false);
    setFocusedModule(null);
  }, [session, modules, history]);

  const cropProgress = useMemo(() => {
    if (session.cropDetectProgress.active) return session.cropDetectProgress;
    if (modules.cropActionProgress.active) return modules.cropActionProgress;
    return { active: false, progress: 0, label: "" };
  }, [session.cropDetectProgress, modules.cropActionProgress]);

  const deskewProgress = useMemo(() => {
    return session.deskewTaskProgress;
  }, [session.deskewTaskProgress]);

  const cleanupProgress = useMemo(() => {
    return modules.cleanupActionProgress;
  }, [modules.cleanupActionProgress]);

  const bleedProgress = useMemo(() => {
    if (modules.bleedModule.enabled && (modules.bleedModule.bleedMm !== modules.debouncedBleed || modules.bleedModule.solidColor !== modules.debouncedBleedColor)) {
      return { active: true, progress: 65, label: "Updating bleed preview..." };
    }
    return { active: false, progress: 0, label: "" };
  }, [modules.bleedModule.enabled, modules.bleedModule.bleedMm, modules.debouncedBleed, modules.bleedModule.solidColor, modules.debouncedBleedColor]);

  const restoreProgress = useMemo(() => {
    if (
      modules.restorationModule.enabled &&
      (modules.restorationModule.saturation !== modules.debouncedSaturation ||
        modules.restorationModule.contrast !== modules.debouncedContrast ||
        modules.restorationModule.bwThreshold !== modules.debouncedBwThreshold)
    ) {
      return { active: true, progress: 65, label: "Rendering color & background..." };
    }
    return { active: false, progress: 0, label: "" };
  }, [
    modules.restorationModule.enabled,
    modules.restorationModule.saturation,
    modules.debouncedSaturation,
    modules.restorationModule.contrast,
    modules.debouncedContrast,
    modules.restorationModule.bwThreshold,
    modules.debouncedBwThreshold,
  ]);

  return {
    unit, setUnit,
    cropProgress,
    deskewProgress,
    cleanupProgress,
    bleedProgress,
    restoreProgress,
    selectedPageIds, setSelectedPageIds,
    eyedropperActive, setEyedropperActive,
    straightenActive, setStraightenActive,
    maskToolActive, setMaskToolActive,
    focusedModule, setFocusedModule,
    openModule,
    intakeMode: session.intakeMode, setIntakeMode: session.setIntakeMode,
    fileSingle: session.fileSingle, setFileSingle: session.setFileSingle,
    fileOdds: session.fileOdds, setFileOdds: session.setFileOdds,
    fileEvens: session.fileEvens, setFileEvens: session.setFileEvens,
    oddsOrder: session.oddsOrder, setOddsOrder: session.setOddsOrder,
    evensOrder: session.evensOrder, setEvensOrder: session.setEvensOrder,
    startWith: session.startWith, setStartWith: session.setStartWith,
    multiFileStrategy: session.multiFileStrategy, setMultiFileStrategy: session.setMultiFileStrategy,
    reverseFileIndices: session.reverseFileIndices, setReverseFileIndices: session.setReverseFileIndices,
    swapOddsEvens: session.swapOddsEvens,
    files: session.files, setFiles: session.setFiles,
    addFiles: session.addFiles,
    removeFile: session.removeFile,
    moveFile: session.moveFile,
    toggleReverseFile: session.toggleReverseFile,
    clearFiles: session.clearFiles,
    splitPos: session.splitPos, setSplitPos: session.setSplitPos,
    sessionId: session.sessionId,
    pages: session.pages,
    selectedPageId: session.selectedPageId, setSelectedPageId: session.setSelectedPageId,
    activeTab: session.activeTab, setActiveTab: session.setActiveTab,
    isInitializing: session.isInitializing,
    isExporting: modules.isExporting,
    error, setError,
    previewCleaned: modules.previewCleaned, setPreviewCleaned: modules.setPreviewCleaned,
    debouncedBleed: modules.debouncedBleed,
    debouncedMargin: modules.debouncedMargin,
    debouncedSaturation: modules.debouncedSaturation,
    debouncedContrast: modules.debouncedContrast,
    deskewModule: modules.deskewModule, setDeskewModule: modules.setDeskewModule,
    cleanupModule: modules.cleanupModule, setCleanupModule: modules.setCleanupModule,
    bleedModule: modules.bleedModule, setBleedModule: modules.setBleedModule,
    restorationModule: modules.restorationModule, setRestorationModule: modules.setRestorationModule,
    cropModule: modules.cropModule, setCropModule: modules.setCropModule,
    pageCrops: modules.pageCrops,
    clearPageCrops: modules.clearPageCrops,
    isDetectingCrop: session.isDetectingCrop,
    detectCrop,
    detectAllCrops,
    splitSpread: modules.splitSpread,
    revertSpread: modules.revertSpread,
    applyCrop: modules.applyCrop,
    removeAppliedCrop: modules.removeAppliedCrop,
    removeAllAppliedCrops: modules.removeAllAppliedCrops,
    clearAllDeskewAngles,
    applyMaskBox,
    removeMaskBox: modules.removeMaskBox,
    clearPageMasks: modules.clearPageMasks,
    clearAllMasks: modules.clearAllMasks,
    setPageColorMode: modules.setPageColorMode,
    isDetectingAngle: session.isDetectingAngle, detectedAngle: session.detectedAngle,
    detectPageAngle,
    detectAllPageAngles,
    setPageDeskewAngle,
    settings: modules.settings,
    resetJob,
    initSession,
    rotatePage: pageOps.rotatePage,
    rotatePages: pageOps.rotatePages,
    deletePage: pageOps.deletePage,
    deletePages: pageOps.deletePages,
    reorderPages: pageOps.reorderPages,
    duplicatePage: pageOps.duplicatePage,
    duplicatePages: pageOps.duplicatePages,
    insertBlankPage: pageOps.insertBlankPage,
    copyPage: pageOps.copyPage,
    pastePage: pageOps.pastePage,
    canPaste: pageOps.canPaste,
    extractPage: pageOps.extractPage,
    exportPdf,
    exportProgress: modules.exportProgress,
    dismissExportProgress: modules.dismissExportProgress,
    getThumbnailUrl,
    // History & Safety Journal API
    history: history.history,
    currentHistoryIndex: history.currentIndex,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    jumpToStep,
    revertToOriginal,
    shortcuts,
    shortcutLabels,
  };
}
