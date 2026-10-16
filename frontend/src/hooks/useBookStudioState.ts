import { useState, useEffect, useRef, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import { useBookSession } from "./useBookSession";
import { useBookModules } from "./useBookModules";
import { useBookExport } from "./useBookExport";
import { useBookPageOps } from "./useBookPageOps";
import { useBookHistory } from "./useBookHistory";
import { useBookShortcuts } from "./useBookShortcuts";
import type { CropBox, DetectCropResult } from "@/types/book_studio";

/**
 * Composer for Book Studio state.
 * Combines useBookSession (session lifecycle + page CRUD) with
 * useBookModules (module configs + processing ops), preserving the exact
 * return API consumed by book-studio/page.tsx (zero consumer changes).
 */
export function useBookStudioState() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({
    undo: "ctrl+z",
    redo: "ctrl+y",
    restore_original: "ctrl+shift+r",
    prev_page: "[",
    next_page: "]",
    toggle_original: "o",
    rotate: "r",
  });
  const [historyLimit, setHistoryLimit] = useState<number>(50);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.book_studio) {
          if (data.book_studio.history_limit) setHistoryLimit(data.book_studio.history_limit);
          if (data.book_studio.shortcuts) setShortcuts(data.book_studio.shortcuts);
        }
      })
      .catch(() => {});
  }, []);

  const session = useBookSession();
  const clearCropsRef = useRef<((ids?: string[]) => void) | undefined>(undefined);

  const history = useBookHistory({
    sessionId: session.sessionId,
    pages: session.pages,
    setPages: session.setPages,
    selectedPageId: session.selectedPageId,
    setSelectedPageId: session.setSelectedPageId,
    clearPageCrops: (ids) => clearCropsRef.current?.(ids),
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
  clearCropsRef.current = modules.clearPageCrops;

  // Initialize history when session loads pages
  const initSession = useCallback(async (arg?: string | File[]) => {
    const data = await session.initSession(arg);
    if (data?.pages && data.pages.length > 0) {
      history.initHistory(data.pages, data.pages[0]?.id ?? null);
    }
    return data;
  }, [session, history]);

  useEffect(() => {
    if (session.sessionId && session.pages.length > 0 && history.history.length === 0) {
      history.initHistory(session.pages, session.selectedPageId);
    }
  }, [session.sessionId, session.pages, session.selectedPageId, history]);

  const { formatCombo } = useBookShortcuts({
    handlers: {
      undo: history.undo,
      redo: history.redo,
      restoreOriginal: history.revertToOriginal,
      rotateCW: () => {
        if (session.selectedPageId) pageOps.rotatePage(session.selectedPageId, 90);
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
  }), [formatCombo]);
  const exporter = useBookExport({
    sessionId: session.sessionId,
    bleedModule: modules.bleedModule,
    deskewModule: modules.deskewModule,
    restorationModule: modules.restorationModule,
  });

  // Merged error state (session init errors + export errors)
  const error: string | null = session.error ?? exporter.exportError ?? null;
  const setError: Dispatch<SetStateAction<string | null>> = useCallback((value) => {
    const resolved = typeof value === "function"
      ? (value as (prev: string | null) => string | null)(session.error ?? exporter.exportError ?? null)
      : value;
    session.setError(resolved);
    exporter.setExportError(resolved);
  }, [session, exporter]);

  // Detect deskew angle using the live deskew-module tolerances
  const detectPageAngle = useCallback(async (pageId?: string): Promise<number | null> => {
    return session.detectPageAngle(pageId, {
      maxAngle: modules.deskewModule.maxAngle,
      ignoreBorders: modules.deskewModule.ignoreBorders,
    });
  }, [session, modules.deskewModule.maxAngle, modules.deskewModule.ignoreBorders]);

  // Detect crop boundary, then apply the result to the crop module
  const detectCrop = useCallback(async (
    pageId?: string
  ): Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null> => {
    const data: DetectCropResult | null = await session.detectCrop(pageId);
    if (data) {
      // Detection runs inside the current view: box applies directly.
      // Only seed a cut line when the operator has none yet.
      modules.setCropModule((prev) => ({
        ...prev,
        cropBox: data.crop_box,
        splitPos: data.split_pos,
        splitLines: prev.splitLines.length > 0 ? prev.splitLines : [{ pos: data.split_pos, direction: "vertical" }],
      }));
    }
    return data;
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
      restorationEnabled: modules.restorationModule.enabled,
      restorationScope: modules.restorationModule.scope,
      cleanBorders: modules.restorationModule.cleanBorders,
      borderMarginPx: modules.debouncedMargin,
      borderThreshold: modules.restorationModule.borderThreshold,
      enhanceColors: modules.restorationModule.enhanceColors,
      saturation: modules.debouncedSaturation,
      contrast: modules.debouncedContrast,
    });
  }, [session, modules]);

  // Export wired with the live intake mode for the download filename
  const exportPdf = useCallback(async (): Promise<void> => {
    await exporter.exportPdf(session.intakeMode);
  }, [session, exporter]);

  // Reset session + module configs + history
  const resetJob = useCallback(() => {
    session.resetSession();
    modules.resetModules();
    history.resetHistory();
    exporter.setExportError(null);
  }, [session, modules, history, exporter]);

  return {
    intakeMode: session.intakeMode, setIntakeMode: session.setIntakeMode,
    fileSingle: session.fileSingle, setFileSingle: session.setFileSingle,
    fileOdds: session.fileOdds, setFileOdds: session.setFileOdds,
    fileEvens: session.fileEvens, setFileEvens: session.setFileEvens,
    oddsOrder: session.oddsOrder, setOddsOrder: session.setOddsOrder,
    evensOrder: session.evensOrder, setEvensOrder: session.setEvensOrder,
    splitPos: session.splitPos, setSplitPos: session.setSplitPos,
    sessionId: session.sessionId,
    pages: session.pages,
    selectedPageId: session.selectedPageId, setSelectedPageId: session.setSelectedPageId,
    activeTab: session.activeTab, setActiveTab: session.setActiveTab,
    isInitializing: session.isInitializing,
    isExporting: exporter.isExporting,
    error, setError,
    previewCleaned: modules.previewCleaned, setPreviewCleaned: modules.setPreviewCleaned,
    debouncedBleed: modules.debouncedBleed,
    debouncedMargin: modules.debouncedMargin,
    debouncedSaturation: modules.debouncedSaturation,
    debouncedContrast: modules.debouncedContrast,
    deskewModule: modules.deskewModule, setDeskewModule: modules.setDeskewModule,
    bleedModule: modules.bleedModule, setBleedModule: modules.setBleedModule,
    restorationModule: modules.restorationModule, setRestorationModule: modules.setRestorationModule,
    cropModule: modules.cropModule, setCropModule: modules.setCropModule,
    isDetectingCrop: session.isDetectingCrop,
    detectCrop,
    splitSpread: modules.splitSpread,
    revertSpread: modules.revertSpread,
    applyCrop: modules.applyCrop,
    isDetectingAngle: session.isDetectingAngle, detectedAngle: session.detectedAngle,
    detectPageAngle,
    settings: modules.settings,
    resetJob,
    initSession,
    rotatePage: pageOps.rotatePage,
    deletePage: pageOps.deletePage,
    reorderPages: pageOps.reorderPages,
    duplicatePage: pageOps.duplicatePage,
    insertBlankPage: pageOps.insertBlankPage,
    copyPage: pageOps.copyPage,
    pastePage: pageOps.pastePage,
    canPaste: pageOps.canPaste,
    extractPage: pageOps.extractPage,
    exportPdf,
    getThumbnailUrl,
    // History & Safety Journal API
    history: history.history,
    currentHistoryIndex: history.currentIndex,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    jumpToStep: history.jumpToStep,
    revertToOriginal: history.revertToOriginal,
    shortcutLabels,
  };
}
