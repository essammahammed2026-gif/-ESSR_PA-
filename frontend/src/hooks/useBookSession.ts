import { useState, useCallback, useEffect } from "react";
import { apiFetch, getApiUrl } from "@/lib/api";
import { isPageInScope, isPageInAppliedEntries } from "@/lib/pageScope";
import {
  BookIntakeMode,
  MultiFileStrategy,
  BookStudioPage,
  DetectAngleOpts,
  DetectCropResult,
  ThumbnailRenderOpts,
  ModuleTaskProgress,
} from "@/types/book_studio";

const DEFAULT_DETECT_ANGLE_OPTS: DetectAngleOpts = {
  maxAngle: 10.0,
  ignoreBorders: true,
};

const IDLE_PROGRESS: ModuleTaskProgress = {
  active: false,
  progress: 0,
  label: "",
};

/**
 * Session lifecycle + page CRUD for Book Studio.
 * Owns intake state, the active backend session, page deck state,
 * per-page detection endpoints, and the debounced thumbnail URL builder.
 * Takes no args; module-specific values are supplied per-call by the composer
 * so this hook stays decoupled from the module-config hooks.
 */
export function useBookSession() {
  // Intake configuration
  const [files, setFiles] = useState<File[]>([]);
  const [intakeMode, setIntakeMode] = useState<BookIntakeMode>("single_page");
  const [multiFileStrategy, setMultiFileStrategy] = useState<MultiFileStrategy>("duplex");
  const [fileSingle, setFileSingle] = useState<File | null>(null);
  const [fileOdds, setFileOdds] = useState<File | null>(null);
  const [fileEvens, setFileEvens] = useState<File | null>(null);
  const [oddsOrder, setOddsOrder] = useState<"forward" | "reverse">("forward");
  const [evensOrder, setEvensOrder] = useState<"reverse" | "forward">("reverse");
  const [startWith, setStartWith] = useState<"odds" | "evens">("odds");
  const [reverseFileIndices, setReverseFileIndices] = useState<number[]>([]);
  const [splitPos, setSplitPos] = useState<number>(0.5);

  // Active session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<BookStudioPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "inspector">("grid");

  // Loading states & errors
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Per-page detection states & progress bars
  const [isDetectingAngle, setIsDetectingAngle] = useState<boolean>(false);
  const [detectedAngle, setDetectedAngle] = useState<number | null>(null);
  const [deskewTaskProgress, setDeskewTaskProgress] = useState<ModuleTaskProgress>(IDLE_PROGRESS);
  const [isDetectingCrop, setIsDetectingCrop] = useState<boolean>(false);
  const [cropDetectProgress, setCropDetectProgress] = useState<ModuleTaskProgress>(IDLE_PROGRESS);

  // Reset page-specific detected angle when selecting a different page
  useEffect(() => {
    setDetectedAngle(null);
  }, [selectedPageId]);

  const swapOddsEvens = useCallback(() => {
    setFileOdds((prevOdds) => {
      setFileEvens(prevOdds);
      return fileEvens;
    });
  }, [fileEvens]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setReverseFileIndices((prev) =>
      prev
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i))
    );
  }, []);

  const moveFile = useCallback((fromIdx: number, toIdx: number) => {
    setFiles((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, item);
      return copy;
    });
    setReverseFileIndices((prev) => {
      const isFromReversed = prev.includes(fromIdx);
      const isToReversed = prev.includes(toIdx);
      const next = prev.filter((i) => i !== fromIdx && i !== toIdx);
      if (isFromReversed) next.push(toIdx);
      if (isToReversed) next.push(fromIdx);
      return next.sort((a, b) => a - b);
    });
  }, []);

  const toggleReverseFile = useCallback((index: number) => {
    setReverseFileIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setReverseFileIndices([]);
  }, []);

  // Reset current session (module configs are reset by useBookModules)
  const resetSession = useCallback(() => {
    setSessionId(null);
    setPages([]);
    setSelectedPageId(null);
    setFiles([]);
    setFileSingle(null);
    setFileOdds(null);
    setFileEvens(null);
    setReverseFileIndices([]);
    setStartWith("odds");
    setMultiFileStrategy("duplex");
    setError(null);
    setActiveTab("grid");
    setIsDetectingCrop(false);
    setDetectedAngle(null);
  }, []);

  // Initialize session with backend
  const initSession = useCallback(async (arg?: string | File[]) => {
    setIsInitializing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("is_spread", "false");

      if (typeof arg === "string") {
        formData.append("mode", "single");
        formData.append("existing_file_path", arg);
      } else if (Array.isArray(arg)) {
        if (arg.length === 0) {
          throw new Error("Please select or drop at least one file to begin.");
        }
        if (arg.length === 1) {
          formData.append("mode", "single");
          formData.append("file_single", arg[0]);
        } else {
          formData.append("mode", "multi_merge");
          arg.forEach((f) => formData.append("files", f));
        }
      } else if (intakeMode === "dual_pass") {
        if (multiFileStrategy === "duplex") {
          if (!fileOdds || !fileEvens) {
            throw new Error("Please select both Odds and Evens PDF files to begin.");
          }
          formData.append("mode", "dual");
          formData.append("file_odds", fileOdds);
          formData.append("file_evens", fileEvens);
          formData.append("odds_order", oddsOrder);
          formData.append("evens_order", evensOrder);
          formData.append("start_with", startWith);
        } else {
          // sequential merge
          if (files.length === 0) {
            throw new Error("Please add at least one file to merge.");
          }
          formData.append("mode", "multi_merge");
          files.forEach((f) => formData.append("files", f));
          if (reverseFileIndices.length > 0) {
            formData.append("reverse_file_indices", reverseFileIndices.join(","));
          }
        }
      } else {
        // intakeMode === "single_page"
        if (!fileSingle) {
          if (files.length > 0) {
            formData.append("mode", "multi_merge");
            files.forEach((f) => formData.append("files", f));
          } else {
            throw new Error("Please select a book PDF file to begin.");
          }
        } else {
          formData.append("mode", "single");
          formData.append("file_single", fileSingle);
        }
      }

      const res = await apiFetch(`/api/book-scan/init-session`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to initialize Book Studio session.");
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setPages(data.pages || []);
      if (data.pages && data.pages.length > 0) {
        setSelectedPageId(data.pages[0].id);
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [
    intakeMode,
    multiFileStrategy,
    fileSingle,
    fileOdds,
    fileEvens,
    oddsOrder,
    evensOrder,
    startWith,
    files,
    reverseFileIndices,
  ]);

  // Detect deskew angle via backend analysis
  const detectPageAngle = useCallback(async (
    pageId?: string,
    opts: DetectAngleOpts = DEFAULT_DETECT_ANGLE_OPTS
  ): Promise<number | null> => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingAngle(true);
    setDeskewTaskProgress({ active: true, progress: 35, label: "Analyzing page tilt..." });
    try {
      const res = await apiFetch(
        `/api/book-scan/detect-angle/${sessionId}/${targetId}?max_angle=${opts.maxAngle}&ignore_borders=${opts.ignoreBorders}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        const angle = Number(data.detected_angle);
        setDetectedAngle(angle);
        if (data.pages) {
          setPages(data.pages);
        }
        setDeskewTaskProgress({ active: true, progress: 100, label: `Detected ${angle > 0 ? "+" : ""}${angle.toFixed(2)}°` });
        return angle;
      }
    } catch (err) {
      console.error("Detect angle failed:", err);
    } finally {
      setIsDetectingAngle(false);
      setTimeout(() => setDeskewTaskProgress(IDLE_PROGRESS), 250);
    }
    return null;
  }, [sessionId, selectedPageId]);

  // Batch detect deskew angles across targeted or all pages with chunked real-time progress
  const detectAllPageAngles = useCallback(async (
    opts: DetectAngleOpts = DEFAULT_DETECT_ANGLE_OPTS,
    targetPageIds?: string[]
  ): Promise<Record<string, number> | null> => {
    if (!sessionId) return null;
    const allIds = targetPageIds && targetPageIds.length > 0
      ? targetPageIds
      : pages.map((p) => p.id);
    if (allIds.length === 0) return null;

    setIsDetectingAngle(true);
    const total = allIds.length;
    const chunkSize = Math.max(4, Math.min(12, Math.ceil(total / 12)));
    const combinedAngles: Record<string, number> = {};
    let latestPages: BookStudioPage[] | null = null;

    try {
      for (let i = 0; i < total; i += chunkSize) {
        const chunkIds = allIds.slice(i, i + chunkSize);
        const currentDone = Math.min(total, i + chunkIds.length);
        const pct = Math.max(5, Math.round((i / total) * 100));
        setDeskewTaskProgress({
          active: true,
          progress: pct,
          label: `Detecting tilt (${i + 1}–${currentDone} of ${total})...`,
        });

        const res = await apiFetch(`/api/book-scan/detect-angle-batch/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            max_angle: opts.maxAngle,
            ignore_borders: opts.ignoreBorders,
            target_page_ids: chunkIds,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.angles) {
            Object.assign(combinedAngles, data.angles);
          }
          if (data.pages) {
            latestPages = data.pages;
          }
          const donePct = Math.round((currentDone / total) * 100);
          setDeskewTaskProgress({
            active: true,
            progress: donePct,
            label: `Detected ${currentDone} of ${total} pages (${donePct}%)`,
          });
        }
      }
      if (latestPages) {
        setPages(latestPages);
      }
      if (selectedPageId && selectedPageId in combinedAngles) {
        setDetectedAngle(Number(combinedAngles[selectedPageId]));
      }
      return combinedAngles;
    } catch (err) {
      console.error("Batch detect angle failed:", err);
    } finally {
      setIsDetectingAngle(false);
      setTimeout(() => setDeskewTaskProgress(IDLE_PROGRESS), 300);
    }
    return null;
  }, [sessionId, selectedPageId, pages]);

  // Detect open book boundary and central spine fold.
  // Pure w.r.t. module state: the composer applies the result to cropModule.
  const detectCrop = useCallback(async (
    pageId?: string,
    mode: "paper" | "content" = "paper"
  ): Promise<DetectCropResult | null> => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingCrop(true);
    setCropDetectProgress({ active: true, progress: 35, label: "Detecting page crop..." });
    try {
      const res = await apiFetch(
        `/api/book-scan/detect-crop/${sessionId}/${targetId}?mode=${mode}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        setCropDetectProgress({ active: true, progress: 100, label: "Crop detected" });
        return data as DetectCropResult;
      }
    } catch (err) {
      console.error("Detect crop failed:", err);
    } finally {
      setIsDetectingCrop(false);
      setTimeout(() => setCropDetectProgress(IDLE_PROGRESS), 250);
    }
    return null;
  }, [sessionId, selectedPageId]);

  // Batch detect crop boxes across targeted or all pages with chunked real-time progress
  const detectAllCrops = useCallback(async (
    mode: "paper" | "content" = "paper",
    targetPageIds?: string[]
  ): Promise<Record<string, { crop_box: { x1: number; y1: number; x2: number; y2: number }; split_pos: number }> | null> => {
    if (!sessionId) return null;
    const allIds = targetPageIds && targetPageIds.length > 0
      ? targetPageIds
      : pages.map((p) => p.id);
    if (allIds.length === 0) return null;

    setIsDetectingCrop(true);
    const total = allIds.length;
    const chunkSize = Math.max(4, Math.min(12, Math.ceil(total / 12)));
    const combinedCrops: Record<string, { crop_box: { x1: number; y1: number; x2: number; y2: number }; split_pos: number }> = {};

    try {
      for (let i = 0; i < total; i += chunkSize) {
        const chunkIds = allIds.slice(i, i + chunkSize);
        const currentDone = Math.min(total, i + chunkIds.length);
        const pct = Math.max(5, Math.round((i / total) * 100));
        setCropDetectProgress({
          active: true,
          progress: pct,
          label: `Detecting crop (${i + 1}–${currentDone} of ${total})...`,
        });

        const res = await apiFetch(`/api/book-scan/detect-crop-batch/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            target_page_ids: chunkIds,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.crops) {
            Object.assign(combinedCrops, data.crops);
          }
          const donePct = Math.round((currentDone / total) * 100);
          setCropDetectProgress({
            active: true,
            progress: donePct,
            label: `Detected ${currentDone} of ${total} pages (${donePct}%)`,
          });
        }
      }
      return combinedCrops;
    } catch (err) {
      console.error("Batch detect crop failed:", err);
    } finally {
      setIsDetectingCrop(false);
      setTimeout(() => setCropDetectProgress(IDLE_PROGRESS), 300);
    }
    return null;
  }, [sessionId, pages]);

  // Debounced URL generator for thumbnails & high-res inspector.
  // Module-derived render values arrive via opts so this builder stays pure.
  const buildThumbnailUrl = useCallback((
    pageId: string,
    isClean: boolean,
    dpi: number,
    opts: ThumbnailRenderOpts
  ): string => {
    if (!sessionId) return "";
    const pageIdx = pages.findIndex((p) => p.id === pageId);
    const pageNum = pageIdx >= 0 ? pageIdx + 1 : 1;
    const page = pageIdx >= 0 ? pages[pageIdx] : undefined;
    const activeIdx = selectedPageId ? pages.findIndex((p) => p.id === selectedPageId) : -1;
    const activePageNum = activeIdx >= 0 ? activeIdx + 1 : pageNum;

    // Check scope applicability for this specific page (prioritize committed applied entries over dynamic draft scope)
    const inDeskewScope = opts.deskewAppliedEntries && opts.deskewAppliedEntries.length > 0
      ? isPageInAppliedEntries(pageNum, pageId, opts.deskewAppliedEntries)
      : isPageInScope(pageNum, opts.deskewScope, activePageNum);
    const hasPageAngle = page?.deskew_angle !== undefined && page?.deskew_angle !== null;
    const applyDeskew = inDeskewScope && (opts.deskewEnabled || hasPageAngle);
    const effectiveDeskewMode = hasPageAngle ? "manual" : opts.deskewMode;
    const effectiveDeskewAngle = hasPageAngle ? Number(page.deskew_angle) : opts.deskewAngle;

    const inCleanupScope = opts.cleanupAppliedEntries && opts.cleanupAppliedEntries.length > 0
      ? isPageInAppliedEntries(pageNum, pageId, opts.cleanupAppliedEntries)
      : isPageInScope(pageNum, opts.cleanupScope, activePageNum);
    const applyCleanup = isClean && opts.cleanupEnabled && inCleanupScope;

    const inRestorationScope = opts.restorationAppliedEntries && opts.restorationAppliedEntries.length > 0
      ? isPageInAppliedEntries(pageNum, pageId, opts.restorationAppliedEntries)
      : isPageInScope(pageNum, opts.restorationScope, activePageNum);
    const applyRestoration = isClean && opts.restorationEnabled && inRestorationScope;
    const hasPageColorOverride = isClean && Boolean(page?.color_mode);
    const effectiveColorMode = page?.color_mode || (applyRestoration ? opts.colorMode : "original");

    const inBleedScope = opts.bleedAppliedEntries && opts.bleedAppliedEntries.length > 0
      ? isPageInAppliedEntries(pageNum, pageId, opts.bleedAppliedEntries)
      : isPageInScope(pageNum, opts.bleedScope, activePageNum);
    const applyBleed = isClean && opts.bleedEnabled && inBleedScope;

    const params = new URLSearchParams({
      preview_clean: String(isClean),
      clean_borders: String(applyRestoration ? opts.cleanBorders : false),
      border_margin_px: String(opts.borderMarginPx),
      border_threshold: String(opts.borderThreshold),
      enhance_colors: String((applyRestoration && opts.enhanceColors) || hasPageColorOverride),
      saturation: String(applyRestoration || hasPageColorOverride ? opts.saturation : 1.0),
      contrast: String(applyRestoration || hasPageColorOverride ? opts.contrast : 1.0),
      color_mode: effectiveColorMode,
      bw_threshold: String(opts.bwThreshold),
      whiten_bg: String(applyRestoration ? opts.whitenBg : false),
      deskew: "false",
      dpi: String(dpi),
      rev: String(page?.rev ?? 0),
      deskew_module_enabled: String(isClean && applyDeskew),
      deskew_mode: effectiveDeskewMode,
      deskew_angle: String(effectiveDeskewAngle),
      deskew_max_angle: String(opts.deskewMaxAngle),
      deskew_ignore_borders: String(opts.deskewIgnoreBorders),
      flatten_illumination: String(applyCleanup ? opts.flattenIllumination : false),
      despeckle_level: String(applyCleanup ? opts.despeckleLevel : 0),
      bleed_mm: String(applyBleed ? opts.bleedMm : 0),
      bleed_mode: opts.bleedMode,
      bleed_color: opts.bleedColor,
      bleed_placement: opts.bleedPlacement,
      show_crop_marks: String(applyBleed ? opts.showCropMarks : false),
    });

    return getApiUrl(`/api/book-scan/page-thumbnail/${sessionId}/${pageId}?${params.toString()}`);
  }, [sessionId, pages, selectedPageId]);

  return {
    intakeMode, setIntakeMode,
    fileSingle, setFileSingle,
    fileOdds, setFileOdds,
    fileEvens, setFileEvens,
    oddsOrder, setOddsOrder,
    evensOrder, setEvensOrder,
    startWith, setStartWith,
    multiFileStrategy, setMultiFileStrategy,
    reverseFileIndices, setReverseFileIndices,
    swapOddsEvens,
    files, setFiles,
    addFiles,
    removeFile,
    moveFile,
    toggleReverseFile,
    clearFiles,
    splitPos, setSplitPos,
    sessionId, setSessionId,
    pages, setPages,
    selectedPageId, setSelectedPageId,
    activeTab, setActiveTab,
    isInitializing, setIsInitializing,
    error, setError,
    isDetectingAngle, detectedAngle,
    deskewTaskProgress, setDeskewTaskProgress,
    detectPageAngle,
    detectAllPageAngles,
    isDetectingCrop,
    cropDetectProgress,
    detectCrop,
    detectAllCrops,
    buildThumbnailUrl,
    resetSession,
    initSession,
  };
}
