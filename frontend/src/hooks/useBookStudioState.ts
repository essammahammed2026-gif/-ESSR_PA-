import { useState, useEffect, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import { type LengthUnit, getStoredUnit, setStoredUnit } from "@/lib/units";
import { resolveCropTarget } from "@/lib/pageScope";
import { getNextCutLine } from "@/lib/splitLines";
import { useBookSession } from "./useBookSession";
import { useBookModules } from "./useBookModules";
import { useBookPageOps } from "./useBookPageOps";
import { useBookHistory, type ModulesSnapshot } from "./useBookHistory";
import { useBookShortcuts, DEFAULT_BOOK_SHORTCUTS } from "./useBookShortcuts";
import type { CropBox, MaskBox, DetectCropResult, FocusedModuleId, ExportOptions } from "@/types/book_studio";

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

  const onStepRestoredRef = useRef<() => void>(() => {});
  const getModulesSnapshotRef = useRef<(() => ModulesSnapshot) | undefined>(undefined);
  const onRestoreModulesRef = useRef<((snap: ModulesSnapshot) => void) | undefined>(undefined);

  const history = useBookHistory({
    sessionId: session.sessionId,
    pages: session.pages,
    setPages: session.setPages,
    selectedPageId: session.selectedPageId,
    setSelectedPageId: session.setSelectedPageId,
    getModulesSnapshot: () => getModulesSnapshotRef.current!(),
    onRestoreModules: (snap) => onRestoreModulesRef.current?.(snap),
    onStepRestored: () => onStepRestoredRef.current(),
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

  getModulesSnapshotRef.current = modules.buildModulesSnapshot;
  onRestoreModulesRef.current = modules.restoreModulesSnapshot;

  useEffect(() => {
    onStepRestoredRef.current = () => {
      modules.clearPageCrops();
      modules.setCropModule((prev) => ({
        ...prev,
        cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
        splitLines: [],
      }));
      modules.setCleanupModule((prev) => ({
        ...prev,
        draftMaskBox: null,
        editingMaskId: null,
      }));
    };
  }, [modules]);

  const jumpToStep = useCallback(async (index: number) => {
    await history.jumpToStep(index);
  }, [history]);

  const undo = useCallback(() => {
    history.undo();
  }, [history]);

  const redo = useCallback(() => {
    history.redo();
  }, [history]);

  const revertToOriginal = useCallback(() => {
    modules.clearPageCrops();
    modules.resetModules();
    history.revertToOriginal();
  }, [modules, history]);

  // Initialize history when session loads pages
  const initSession = useCallback(async (arg?: string | File[], customOriginalFilename?: string) => {
    const data = await session.initSession(arg, customOriginalFilename);
    if (data?.pages && data.pages.length > 0) {
      history.initHistory(data.pages, data.pages[0]?.id ?? null, modules.buildModulesSnapshot());
      setSelectedPageIds([data.pages[0].id]);
    }
    return data;
  }, [session, history, modules]);

  // Load existing session and initialize history
  const loadSession = useCallback(async (targetSessionId: string) => {
    const data = await session.loadSession(targetSessionId);
    if (data?.pages && data.pages.length > 0) {
      history.initHistory(data.pages, data.pages[0]?.id ?? null, modules.buildModulesSnapshot());
      setSelectedPageIds([data.pages[0].id]);
    }
    return data;
  }, [session, history, modules]);

  useEffect(() => {
    if (session.sessionId && session.pages.length > 0 && history.history.length === 0) {
      history.initHistory(session.pages, session.selectedPageId, modules.buildModulesSnapshot());
    }
  }, [session.sessionId, session.pages, session.selectedPageId, history, modules]);

  // Detect deskew angle using the live deskew-module tolerances
  const detectPageAngle = useCallback(async (pageId?: string): Promise<number | null> => {
    const nextDeskew = { ...modules.deskewModule, enabled: true };
    modules.setDeskewModule(nextDeskew);
    const angle = await session.detectPageAngle(pageId, {
      maxAngle: modules.deskewModule.maxAngle,
      ignoreBorders: modules.deskewModule.ignoreBorders,
    });
    if (angle !== null) {
      const targetId = pageId || session.selectedPageId;
      const updatedPages = session.pages.map((p) =>
        p.id === targetId ? { ...p, deskew_angle: angle, rev: (p.rev ?? 0) + 1 } : p
      );
      const snap = modules.buildModulesSnapshot({ deskewModule: { ...nextDeskew, angle } });
      history.recordStep(
        `Detect Tilt (${angle > 0 ? "+" : ""}${angle.toFixed(2)}°)`,
        updatedPages,
        session.selectedPageId,
        snap
      );
    }
    return angle;
  }, [session, modules, history]);

  const detectAllPageAngles = useCallback(async (targetPageIds?: string[]): Promise<Record<string, number> | null> => {
    const nextDeskew = { ...modules.deskewModule, enabled: true };
    modules.setDeskewModule(nextDeskew);
    const anglesMap = await session.detectAllPageAngles(
      {
        maxAngle: modules.deskewModule.maxAngle,
        ignoreBorders: modules.deskewModule.ignoreBorders,
      },
      targetPageIds
    );
    if (anglesMap && Object.keys(anglesMap).length > 0) {
      const updatedPages = session.pages.map((p) =>
        p.id in anglesMap ? { ...p, deskew_angle: Number(anglesMap[p.id]), rev: (p.rev ?? 0) + 1 } : p
      );
      const snap = modules.buildModulesSnapshot({ deskewModule: nextDeskew });
      history.recordStep(
        `Detect All Tilt (${Object.keys(anglesMap).length}p)`,
        updatedPages,
        session.selectedPageId,
        snap
      );
    }
    return anglesMap;
  }, [session, modules, history]);

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
    const updatedPages = session.pages.map((p) =>
      p.id === pageId ? { ...p, deskew_angle: rounded, rev: (p.rev ?? 0) + 1 } : p
    );
    // Optimistically update local page deskew_angle + rev so canvas updates immediately
    session.setPages(updatedPages);
    const nextDeskew = {
      ...modules.deskewModule,
      enabled: true,
      angle: rounded,
    };
    modules.setDeskewModule(nextDeskew);

    // Debounce network persistence + history commit (~350ms) to prevent server/history flooding while dragging slider
    if (deskewSyncTimeoutRef.current) {
      clearTimeout(deskewSyncTimeoutRef.current);
    }
    const currentSessionId = session.sessionId;
    const snap = modules.buildModulesSnapshot({ deskewModule: nextDeskew });
    deskewSyncTimeoutRef.current = setTimeout(async () => {
      history.recordStep(
        `Deskew Angle (${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}°)`,
        updatedPages,
        session.selectedPageId,
        snap
      );
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
  }, [session, modules, history]);

  // Detect crop boundary, then apply the result to the crop module
  const detectCrop = useCallback(async (
    pageId?: string
  ): Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null> => {
    const mode = modules.cropModule.detectMode || "paper";
    const data: DetectCropResult | null = await session.detectCrop(pageId, mode);
    if (data) {
      const nextCrop = {
        ...modules.cropModule,
        enabled: true,
        cropBox: data.crop_box,
        splitPos: data.split_pos,
      };
      modules.setCropModule(nextCrop);
      const targetId = pageId || session.selectedPageId;
      const nextPageCrops = { ...modules.pageCrops };
      if (targetId) {
        nextPageCrops[targetId] = {
          cropBox: data.crop_box,
          splitPos: data.split_pos,
          splitLines: modules.cropModule.splitLines,
        };
      }
      const snap = modules.buildModulesSnapshot({ cropModule: nextCrop, pageCrops: nextPageCrops });
      history.recordStep(`Auto-Detect Crop (${mode})`, session.pages, session.selectedPageId, snap);
    }
    return data;
  }, [session, modules, history]);

  const detectAllCrops = useCallback(async (): Promise<void> => {
    const mode = modules.cropModule.detectMode || "paper";
    const resolved = resolveCropTarget(session.pages, session.selectedPageId, modules.cropModule.target);
    const cropsMap = await session.detectAllCrops(mode, resolved.ids);
    if (cropsMap) {
      modules.setBatchPageCrops(cropsMap, false);
      const nextPageCrops = { ...modules.pageCrops };
      for (const [pid, item] of Object.entries(cropsMap)) {
        nextPageCrops[pid] = {
          cropBox: item.crop_box,
          splitPos: item.split_pos,
          splitLines: nextPageCrops[pid]?.splitLines ?? [],
        };
      }
      const activeItem = session.selectedPageId ? cropsMap[session.selectedPageId] : undefined;
      const nextCrop = activeItem
        ? {
            ...modules.cropModule,
            enabled: true,
            cropBox: activeItem.crop_box,
            splitPos: activeItem.split_pos,
          }
        : modules.cropModule;
      const snap = modules.buildModulesSnapshot({ cropModule: nextCrop, pageCrops: nextPageCrops });
      history.recordStep(
        `Auto-Detect All Crops (${Object.keys(cropsMap).length}p)`,
        session.pages,
        session.selectedPageId,
        snap
      );
    }
  }, [session, modules, history]);

  const clearAllDeskewAngles = useCallback(async () => {
    await modules.resetDeskew();
  }, [modules]);

  const recordHistoryStep = useCallback((label: string, snapshotOverride?: ModulesSnapshot) => {
    history.recordStep(label, session.pages, session.selectedPageId, snapshotOverride);
  }, [history, session.pages, session.selectedPageId]);

  const openModule = useCallback((mod: FocusedModuleId | null) => {
    setFocusedModule(mod);
    // Toggle crop guide overlay when in the Crop or Split module
    modules.setCropModule((prev) => {
      const nextEnabled = mod === "crop" || mod === "split";
      if (mod === "split" && prev.splitLines.length === 0) {
        return {
          ...prev,
          enabled: true,
          splitLines: [{ pos: 0.5, direction: "vertical" }],
          splitPos: 0.5,
        };
      }
      return { ...prev, enabled: nextEnabled };
    });
    if (mod === null) {
      setStraightenActive(false);
      setMaskToolActive(false);
      setEyedropperActive(false);
      return;
    }
    // We do NOT auto-enable deskew, cleanup, restore, or bleed on enter.
    // They are only enabled when the user modifies controls or clicks "Apply" in each module.
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
        openModule("split");
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
        if (focusedModule === "split") {
          void modules.splitSpread();
        } else if (focusedModule === "crop" || modules.cropModule.enabled) {
          void modules.applyCrop();
        }
      },
      focusModule: (idx: number) => {
        const order: FocusedModuleId[] = ["crop", "split", "deskew", "cleanup", "restore"];
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

  // Stable thumbnail builder for Deck Cards in the Left Panel.
  // Represents strictly the committed page state without depending on selectedPageId or draft sliders.
  const getDeckThumbnailUrl = useCallback((pageId: string, isCleanOrDpi?: boolean | number, dpi?: number): string => {
    const resolvedDpi = typeof isCleanOrDpi === "number" ? isCleanOrDpi : (dpi ?? 80);
    return session.buildDeckThumbnailUrl(pageId, resolvedDpi);
  }, [session]);

  // Thumbnail URL builder wired with debounced module values (for Center Canvas Preview)
  const getThumbnailUrl = useCallback((pageId: string, isClean: boolean, dpi: number = 100): string => {
    const hiddenMaskIds: string[] = [];
    const editingMaskId = modules.cleanupModule.pageDraftMasks?.[pageId]?.id || modules.cleanupModule.draftMaskBox?.id;
    if (editingMaskId) {
      hiddenMaskIds.push(editingMaskId);
    }
    const pageIdx = session.pages.findIndex((p) => p.id === pageId);
    const pageNum = pageIdx >= 0 ? pageIdx + 1 : 1;

    for (const e of modules.cleanupModule.appliedEntries || []) {
      if (e.visible === false) {
        const isMask = Boolean(e.params?.isMaskEntry || e.id.startsWith("mask_"));
        if (isMask) {
          const appliesToPage =
            (!e.excludedPages || !e.excludedPages.includes(pageNum)) &&
            ((!e.targetPageIds || e.targetPageIds.length === 0 || e.targetPageIds.includes(pageId)) &&
             (!e.targetPages || e.targetPages.length === 0 || e.targetPages.includes(pageNum)));
          if (appliesToPage) {
            const maskId = e.params?.maskBox?.id || (e.id.startsWith("mask_") ? e.id.slice(5) : null);
            if (maskId) {
              hiddenMaskIds.push(maskId);
            }
          }
        }
      }
    }

    const pageSpecificSpineBox = modules.cleanupModule.pageSpineBoxes?.[pageId] ?? modules.cleanupModule.spineBox;

    return session.buildThumbnailUrl(pageId, isClean, dpi, {
      deskewEnabled: modules.deskewModule.enabled,
      deskewScope: modules.deskewModule.scope,
      deskewMode: modules.deskewModule.mode,
      deskewAngle: modules.debouncedDeskewAngle,
      deskewMaxAngle: modules.deskewModule.maxAngle,
      deskewIgnoreBorders: modules.deskewModule.ignoreBorders,
      cleanupEnabled: modules.cleanupModule.enabled || modules.cleanupModule.flattenIllumination || modules.cleanupModule.despeckleLevel > 0 || Boolean(pageSpecificSpineBox),
      cleanupScope: modules.cleanupModule.scope,
      flattenIllumination: modules.cleanupModule.flattenIllumination,
      spineStrength: modules.debouncedSpineStrength ?? modules.cleanupModule.spineStrength ?? 1.0,
      spineBox: pageSpecificSpineBox,
      despeckleLevel: modules.debouncedDespeckle ?? modules.cleanupModule.despeckleLevel,
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
      excludeMaskIds: hiddenMaskIds.length > 0 ? hiddenMaskIds : undefined,
    });
  }, [session, modules]);

  // Export wired with the live intake mode and optional multi-format export options
  const exportPdf = useCallback(async (options?: ExportOptions): Promise<{ fileId: string; filename: string } | null> => {
    return await modules.exportPdf(session.intakeMode, options);
  }, [session, modules]);

  const applyMaskBox = useCallback(async (
    box: CropBox,
    targetPageIds?: string[],
    customColor?: string,
    existingMaskId?: string
  ): Promise<MaskBox | undefined> => {
    return await modules.applyMaskBox(
      box,
      targetPageIds && targetPageIds.length > 0 ? targetPageIds : selectedPageIds,
      customColor,
      existingMaskId
    );
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
    focusCropPage: modules.focusCropPage,
    clearPageCrops: modules.clearPageCrops,
    isDetectingCrop: session.isDetectingCrop,
    detectCrop,
    detectAllCrops,
    splitSpread: modules.splitSpread,
    revertSpread: modules.revertSpread,
    revertSplitLevel: modules.revertSplitLevel,
    applyCrop: modules.applyCrop,
    revertCropLevel: modules.revertCropLevel,
    resetCrop: modules.resetCrop,
    resetDeskew: modules.resetDeskew,
    resetCleanup: modules.resetCleanup,
    resetRestoration: modules.resetRestoration,
    resetBleed: modules.resetBleed,
    removeAppliedCrop: modules.removeAppliedCrop,
    removeAllAppliedCrops: modules.removeAllAppliedCrops,
    clearAllDeskewAngles,
    applyMaskBox,
    removeMaskBox: modules.removeMaskBox,
    clearPageMasks: modules.clearPageMasks,
    clearAllMasks: modules.clearAllMasks,
    applyCleanupFilters: modules.applyCleanupFilters,
    setPageColorMode: modules.setPageColorMode,
    isDetectingAngle: session.isDetectingAngle, detectedAngle: session.detectedAngle,
    detectPageAngle,
    detectAllPageAngles,
    setPageDeskewAngle,
    settings: modules.settings,
    resetJob,
    initSession,
    loadSession,
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
    getDeckThumbnailUrl,
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
    recordHistoryStep,
    buildModulesSnapshot: modules.buildModulesSnapshot,
    shortcuts,
    shortcutLabels,
  };
}
