import { useState, useCallback, useEffect } from "react";
import { apiFetch, getApiUrl } from "@/lib/api";
import { isPageInScope, getAppliedEntryForPage } from "@/lib/pageScope";
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
  const initSession = useCallback(async (arg?: string | File[], customOriginalFilename?: string) => {
    setIsInitializing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("is_spread", "false");

      if (customOriginalFilename) {
        formData.append("original_filename", customOriginalFilename);
      }

      if (typeof arg === "string") {
        formData.append("mode", "single");
        formData.append("existing_file_path", arg);
        if (!customOriginalFilename) {
          const rawBase = arg.split("/").pop() || "";
          const cleanName = rawBase.replace(/^\d+_/, "");
          if (cleanName) {
            formData.append("original_filename", cleanName);
          }
        }
      } else if (Array.isArray(arg)) {
        if (arg.length === 0) {
          throw new Error("Please select or drop at least one file to begin.");
        }
        if (arg.length === 1) {
          formData.append("mode", "single");
          formData.append("file_single", arg[0]);
          if (!customOriginalFilename) {
            formData.append("original_filename", arg[0].name);
          }
        } else {
          formData.append("mode", "multi_merge");
          arg.forEach((f) => formData.append("files", f));
          if (!customOriginalFilename) {
            formData.append("original_filename", arg[0].name);
          }
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
          if (!customOriginalFilename) {
            formData.append("original_filename", fileOdds.name);
          }
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
          if (!customOriginalFilename && files[0]) {
            formData.append("original_filename", files[0].name);
          }
        }
      } else {
        // intakeMode === "single_page"
        if (!fileSingle) {
          if (files.length > 0) {
            formData.append("mode", "multi_merge");
            files.forEach((f) => formData.append("files", f));
            if (!customOriginalFilename) {
              formData.append("original_filename", files[0].name);
            }
          } else {
            throw new Error("Please select a book PDF file to begin.");
          }
        } else {
          formData.append("mode", "single");
          formData.append("file_single", fileSingle);
          if (!customOriginalFilename) {
            formData.append("original_filename", fileSingle.name);
          }
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

  // Load an existing session directly by ID (from Dashboard or resume URL)
  const loadSession = useCallback(async (targetSessionId: string) => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/sessions/${targetSessionId}`);
      if (!res.ok) {
        throw new Error(`Failed to load session ${targetSessionId}`);
      }
      const data = await res.json();
      if (data.success && data.session) {
        const sess = data.session;
        setSessionId(sess.id);
        const sessPages: BookStudioPage[] = sess.pages || [];
        setPages(sessPages);
        if (sessPages.length > 0) {
          setSelectedPageId(sessPages[0].id);
        }
        return sess;
      }
      throw new Error("Invalid session data returned from server");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, []);

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

  // Stable thumbnail URL generator for Deck Cards in the Left Panel.
  // Represents strictly the committed page state (crops, masks, rotations, deskew angle, color mode)
  // and is completely decoupled from selectedPageId and uncommitted draft sliders.
  const buildDeckThumbnailUrl = useCallback((
    pageId: string,
    dpi: number = 80
  ): string => {
    if (!sessionId) return "";
    const pageIdx = pages.findIndex((p) => p.id === pageId);
    const page = pageIdx >= 0 ? pages[pageIdx] : undefined;
    const hasPageAngle = page?.deskew_angle !== undefined && page?.deskew_angle !== null;
    const effectiveColorMode = page?.color_mode || "original";

    const params = new URLSearchParams({
      preview_clean: "true",
      clean_borders: "false",
      border_margin_px: "0",
      border_threshold: "210",
      enhance_colors: String(Boolean(page?.color_mode)),
      saturation: "1.0",
      contrast: "1.0",
      color_mode: effectiveColorMode,
      bw_threshold: "180",
      whiten_bg: "false",
      deskew: "false",
      dpi: String(dpi),
      rev: String(page?.rev ?? 0),
      deskew_module_enabled: String(hasPageAngle),
      deskew_mode: hasPageAngle ? "manual" : "auto",
      deskew_angle: hasPageAngle ? String(page?.deskew_angle) : "0",
      deskew_max_angle: "10.0",
      deskew_ignore_borders: "true",
      flatten_illumination: "false",
      spine_strength: "1.0",
      despeckle_level: "0",
      bleed_mm: "0",
      bleed_mode: "mirror",
      bleed_color: "#ffffff",
      bleed_placement: "outside",
      show_crop_marks: "false",
    });

    return getApiUrl(`/api/book-scan/page-thumbnail/${sessionId}/${pageId}?${params.toString()}`);
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

    // Deskew Layer Resolution
    const deskewEntry = opts.deskewAppliedEntries && opts.deskewAppliedEntries.length > 0
      ? getAppliedEntryForPage(pageNum, pageId, opts.deskewAppliedEntries)
      : undefined;
    const inDeskewDraftScope = isPageInScope(pageNum, opts.deskewScope, activePageNum);
    const inDeskewScope = deskewEntry ? true : inDeskewDraftScope;
    const hasPageAngle = page?.deskew_angle !== undefined && page?.deskew_angle !== null;
    const applyDeskew = hasPageAngle || (opts.deskewEnabled && inDeskewScope);
    const effectiveDeskewAngle = hasPageAngle
      ? Number(page.deskew_angle)
      : inDeskewDraftScope && opts.deskewEnabled
        ? opts.deskewAngle
        : deskewEntry?.params?.angle !== undefined
          ? Number(deskewEntry.params.angle)
          : opts.deskewAngle;
    const effectiveDeskewMode = hasPageAngle
      ? "manual"
      : inDeskewDraftScope && opts.deskewEnabled
        ? opts.deskewMode
        : (deskewEntry?.params?.mode || opts.deskewMode);
    const effectiveDeskewMaxAngle = inDeskewDraftScope && opts.deskewEnabled
      ? opts.deskewMaxAngle
      : deskewEntry?.params?.maxAngle !== undefined
        ? Number(deskewEntry.params.maxAngle)
        : opts.deskewMaxAngle;
    const effectiveDeskewIgnoreBorders = inDeskewDraftScope && opts.deskewEnabled
      ? opts.deskewIgnoreBorders
      : deskewEntry?.params?.ignoreBorders !== undefined
        ? Boolean(deskewEntry.params.ignoreBorders)
        : opts.deskewIgnoreBorders;

    // Cleanup Layer Resolution
    // Mask entries are overlays (rendered separately); only filter entries drive cleanup params.
    const cleanupFilterEntries = (opts.cleanupAppliedEntries || []).filter(
      (e) => !(e.params?.isMaskEntry || e.id.startsWith("mask_"))
    );
    const cleanupEntry = cleanupFilterEntries.length > 0
      ? getAppliedEntryForPage(pageNum, pageId, cleanupFilterEntries)
      : undefined;

    const inDraftScope = isPageInScope(pageNum, opts.cleanupScope, activePageNum);
    const hasLiveDraft = Boolean(
      opts.cleanupEnabled && (opts.flattenIllumination || opts.despeckleLevel > 0 || opts.spineBox)
    );

    let applyCleanup = false;
    let effectiveFlattenIllumination = false;
    let effectiveSpineStrength = 1.0;
    let effectiveSpineBox = opts.spineBox;
    let effectiveDespeckleLevel = 0.0;

    if (inDraftScope && hasLiveDraft) {
      // Live draft preview takes immediate priority across its active scope
      applyCleanup = isClean;
      effectiveFlattenIllumination = Boolean(opts.flattenIllumination);
      effectiveSpineStrength = opts.spineStrength ?? 1.0;
      effectiveSpineBox = opts.spineBox;
      effectiveDespeckleLevel = opts.despeckleLevel ?? 0.0;
    } else if (cleanupEntry) {
      // Fall back to previously committed applied entry for this page
      applyCleanup = isClean;
      effectiveFlattenIllumination = Boolean(cleanupEntry.params?.flattenIllumination);
      effectiveSpineStrength = Number(cleanupEntry.params?.spineStrength ?? 1.0);
      effectiveSpineBox = cleanupEntry.params?.spineBox;
      effectiveDespeckleLevel = Number(cleanupEntry.params?.despeckleLevel ?? 0);
    } else if (inDraftScope && opts.cleanupEnabled) {
      applyCleanup = isClean;
      effectiveFlattenIllumination = Boolean(opts.flattenIllumination);
      effectiveSpineStrength = opts.spineStrength ?? 1.0;
      effectiveSpineBox = opts.spineBox;
      effectiveDespeckleLevel = opts.despeckleLevel ?? 0.0;
    }

    // Restoration (Colors) Layer Resolution
    const restorationEntry = opts.restorationAppliedEntries && opts.restorationAppliedEntries.length > 0
      ? getAppliedEntryForPage(pageNum, pageId, opts.restorationAppliedEntries)
      : undefined;
    const inRestorationDraftScope = isPageInScope(pageNum, opts.restorationScope, activePageNum);
    const inRestorationScope = restorationEntry ? true : inRestorationDraftScope;
    const applyRestoration = isClean && opts.restorationEnabled && inRestorationScope;
    const hasPageColorOverride = isClean && Boolean(page?.color_mode);
    const effectiveColorMode = page?.color_mode || (applyRestoration ? (inRestorationDraftScope ? opts.colorMode : (restorationEntry?.params?.colorMode || opts.colorMode)) : "original");
    const effectiveCleanBorders = inRestorationDraftScope
      ? opts.cleanBorders
      : restorationEntry?.params?.cleanBorders !== undefined
        ? Boolean(restorationEntry.params.cleanBorders)
        : opts.cleanBorders;
    const effectiveBorderMarginPx = inRestorationDraftScope
      ? opts.borderMarginPx
      : restorationEntry?.params?.borderMarginPx !== undefined
        ? Number(restorationEntry.params.borderMarginPx)
        : opts.borderMarginPx;
    const effectiveBorderThreshold = inRestorationDraftScope
      ? opts.borderThreshold
      : restorationEntry?.params?.borderThreshold !== undefined
        ? Number(restorationEntry.params.borderThreshold)
        : opts.borderThreshold;
    const effectiveEnhanceColors = inRestorationDraftScope
      ? opts.enhanceColors
      : restorationEntry?.params?.enhanceColors !== undefined
        ? Boolean(restorationEntry.params.enhanceColors)
        : opts.enhanceColors;
    const effectiveSaturation = inRestorationDraftScope
      ? opts.saturation
      : restorationEntry?.params?.saturation !== undefined
        ? Number(restorationEntry.params.saturation)
        : opts.saturation;
    const effectiveContrast = inRestorationDraftScope
      ? opts.contrast
      : restorationEntry?.params?.contrast !== undefined
        ? Number(restorationEntry.params.contrast)
        : opts.contrast;
    const effectiveBwThreshold = inRestorationDraftScope
      ? opts.bwThreshold
      : restorationEntry?.params?.bwThreshold !== undefined
        ? Number(restorationEntry.params.bwThreshold)
        : opts.bwThreshold;
    const effectiveWhitenBg = inRestorationDraftScope
      ? opts.whitenBg
      : restorationEntry?.params?.whitenBg !== undefined
        ? Boolean(restorationEntry.params.whitenBg)
        : opts.whitenBg;

    // Bleed Layer Resolution
    const bleedEntry = opts.bleedAppliedEntries && opts.bleedAppliedEntries.length > 0
      ? getAppliedEntryForPage(pageNum, pageId, opts.bleedAppliedEntries)
      : undefined;
    const inBleedDraftScope = isPageInScope(pageNum, opts.bleedScope, activePageNum);
    const inBleedScope = bleedEntry ? true : inBleedDraftScope;
    const applyBleed = isClean && opts.bleedEnabled && inBleedScope;
    const effectiveBleedMm = inBleedDraftScope ? opts.bleedMm : (bleedEntry ? Number(bleedEntry.bleedMm ?? 0) : opts.bleedMm);
    const effectiveBleedMode = inBleedDraftScope ? opts.bleedMode : (bleedEntry?.mode || opts.bleedMode);
    const effectiveBleedColor = inBleedDraftScope ? opts.bleedColor : (bleedEntry?.solidColor || opts.bleedColor);
    const effectiveBleedPlacement = inBleedDraftScope ? opts.bleedPlacement : (bleedEntry?.placement || opts.bleedPlacement);
    const effectiveShowCropMarks = inBleedDraftScope ? opts.showCropMarks : (bleedEntry ? Boolean(bleedEntry.showCropMarks) : opts.showCropMarks);

    const params = new URLSearchParams({
      preview_clean: String(isClean),
      clean_borders: String(applyRestoration ? effectiveCleanBorders : false),
      border_margin_px: String(effectiveBorderMarginPx),
      border_threshold: String(effectiveBorderThreshold),
      enhance_colors: String((applyRestoration && effectiveEnhanceColors) || hasPageColorOverride),
      saturation: String(applyRestoration || hasPageColorOverride ? effectiveSaturation : 1.0),
      contrast: String(applyRestoration || hasPageColorOverride ? effectiveContrast : 1.0),
      color_mode: effectiveColorMode,
      bw_threshold: String(effectiveBwThreshold),
      whiten_bg: String(applyRestoration ? effectiveWhitenBg : false),
      deskew: "false",
      dpi: String(dpi),
      rev: String(page?.rev ?? 0),
      deskew_module_enabled: String(isClean && applyDeskew),
      deskew_mode: effectiveDeskewMode,
      deskew_angle: String(effectiveDeskewAngle),
      deskew_max_angle: String(effectiveDeskewMaxAngle),
      deskew_ignore_borders: String(effectiveDeskewIgnoreBorders),
      flatten_illumination: String(applyCleanup ? effectiveFlattenIllumination : false),
      spine_strength: String(applyCleanup ? effectiveSpineStrength : 1.0),
      despeckle_level: String(applyCleanup ? effectiveDespeckleLevel : 0),
      bleed_mm: String(applyBleed ? effectiveBleedMm : 0),
      bleed_mode: effectiveBleedMode,
      bleed_color: effectiveBleedColor,
      bleed_placement: effectiveBleedPlacement,
      show_crop_marks: String(applyBleed ? effectiveShowCropMarks : false),
    });

    if (applyCleanup && effectiveSpineBox) {
      params.set("spine_box", `${effectiveSpineBox.x1},${effectiveSpineBox.y1},${effectiveSpineBox.x2},${effectiveSpineBox.y2}`);
    }

    if (opts.excludeMaskIds && opts.excludeMaskIds.length > 0) {
      params.set("exclude_mask_ids", opts.excludeMaskIds.join(","));
    }

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
    buildDeckThumbnailUrl,
    buildThumbnailUrl,
    resetSession,
    initSession,
    loadSession,
  };
}
