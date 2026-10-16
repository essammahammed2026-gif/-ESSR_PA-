import { useState, useCallback, useEffect } from "react";
import { apiFetch, getApiUrl } from "@/lib/api";
import { isPageInScope } from "@/lib/pageScope";
import {
  BookIntakeMode,
  BookStudioPage,
  DetectAngleOpts,
  DetectCropResult,
  ThumbnailRenderOpts,
} from "@/types/book_studio";

const DEFAULT_DETECT_ANGLE_OPTS: DetectAngleOpts = {
  maxAngle: 10.0,
  ignoreBorders: true,
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
  const [fileSingle, setFileSingle] = useState<File | null>(null);
  const [fileOdds, setFileOdds] = useState<File | null>(null);
  const [fileEvens, setFileEvens] = useState<File | null>(null);
  const [oddsOrder, setOddsOrder] = useState<"forward" | "reverse">("forward");
  const [evensOrder, setEvensOrder] = useState<"reverse" | "forward">("reverse");
  const [splitPos, setSplitPos] = useState<number>(0.5);

  // Active session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<BookStudioPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "inspector">("grid");

  // Loading states & errors
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Per-page detection states
  const [isDetectingAngle, setIsDetectingAngle] = useState<boolean>(false);
  const [detectedAngle, setDetectedAngle] = useState<number | null>(null);
  const [isDetectingCrop, setIsDetectingCrop] = useState<boolean>(false);

  // Reset page-specific detected angle when selecting a different page
  useEffect(() => {
    setDetectedAngle(null);
  }, [selectedPageId]);

  // Reset current session (module configs are reset by useBookModules)
  const resetSession = useCallback(() => {
    setSessionId(null);
    setPages([]);
    setSelectedPageId(null);
    setFiles([]);
    setFileSingle(null);
    setFileOdds(null);
    setFileEvens(null);
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
      formData.append("mode", "single");
      formData.append("is_spread", "false");

      if (typeof arg === "string") {
        formData.append("existing_file_path", arg);
      } else {
        const queue = Array.isArray(arg) ? arg : (files.length > 0 ? files : (fileSingle ? [fileSingle] : []));
        if (queue.length === 0) {
          throw new Error("Please select or drop at least one file to begin.");
        }
        queue.forEach((f) => formData.append("files", f));
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
  }, [files, fileSingle]);

  // Detect deskew angle via backend analysis
  const detectPageAngle = useCallback(async (
    pageId?: string,
    opts: DetectAngleOpts = DEFAULT_DETECT_ANGLE_OPTS
  ): Promise<number | null> => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingAngle(true);
    try {
      const res = await apiFetch(
        `/api/book-scan/detect-angle/${sessionId}/${targetId}?max_angle=${opts.maxAngle}&ignore_borders=${opts.ignoreBorders}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        const angle = Number(data.detected_angle);
        setDetectedAngle(angle);
        return angle;
      }
    } catch (err) {
      console.error("Detect angle failed:", err);
    } finally {
      setIsDetectingAngle(false);
    }
    return null;
  }, [sessionId, selectedPageId]);

  // Detect open book boundary and central spine fold.
  // Pure w.r.t. module state: the composer applies the result to cropModule.
  const detectCrop = useCallback(async (pageId?: string): Promise<DetectCropResult | null> => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingCrop(true);
    try {
      const res = await apiFetch(`/api/book-scan/detect-crop/${sessionId}/${targetId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        return data as DetectCropResult;
      }
    } catch (err) {
      console.error("Detect crop failed:", err);
    } finally {
      setIsDetectingCrop(false);
    }
    return null;
  }, [sessionId, selectedPageId]);

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

    // Check scope applicability for this specific page
    const applyDeskew = opts.deskewEnabled && isPageInScope(pageNum, opts.deskewScope);
    const applyRestoration = opts.restorationEnabled && isPageInScope(pageNum, opts.restorationScope);

    const params = new URLSearchParams({
      preview_clean: String(isClean),
      clean_borders: String(applyRestoration ? opts.cleanBorders : false),
      border_margin_px: String(opts.borderMarginPx),
      border_threshold: String(opts.borderThreshold),
      enhance_colors: String(applyRestoration ? opts.enhanceColors : false),
      saturation: String(applyRestoration ? opts.saturation : 1.0),
      contrast: String(applyRestoration ? opts.contrast : 1.0),
      deskew: "false",
      dpi: String(dpi),
      rev: String(page?.rev ?? 0),
      deskew_module_enabled: String(applyDeskew),
      deskew_mode: opts.deskewMode,
      deskew_angle: String(opts.deskewAngle),
      deskew_max_angle: String(opts.deskewMaxAngle),
      deskew_ignore_borders: String(opts.deskewIgnoreBorders),
    });
    return getApiUrl(`/api/book-scan/page-thumbnail/${sessionId}/${pageId}?${params.toString()}`);
  }, [sessionId, pages]);

  return {
    intakeMode, setIntakeMode,
    fileSingle, setFileSingle,
    fileOdds, setFileOdds,
    fileEvens, setFileEvens,
    oddsOrder, setOddsOrder,
    evensOrder, setEvensOrder,
    splitPos, setSplitPos,
    sessionId, setSessionId,
    pages, setPages,
    selectedPageId, setSelectedPageId,
    activeTab, setActiveTab,
    isInitializing, setIsInitializing,
    error, setError,
    isDetectingAngle, detectedAngle,
    detectPageAngle,
    isDetectingCrop,
    detectCrop,
    buildThumbnailUrl,
    resetSession,
    initSession,
  };
}
