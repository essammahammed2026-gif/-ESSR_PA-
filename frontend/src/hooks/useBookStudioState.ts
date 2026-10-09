import { useState, useCallback, useMemo, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { 
  BookIntakeMode, 
  BookStudioPage, 
  BookProcessSettings,
  DeskewModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox
} from "@/types/book_studio";
import { isPageInScope } from "@/lib/pageScope";

export function useBookStudioState() {
  // Intake configuration
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
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Processing settings
  const [previewCleaned, setPreviewCleaned] = useState<boolean>(true);

  // Modular Processing Framework: All modules off by default
  const [cropModule, setCropModule] = useState<CropModuleConfig>({
    enabled: false,
    mode: "spread",
    cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
    splitPos: 0.50,
    scope: { mode: "all", customRange: "" },
  });
  const [isDetectingCrop, setIsDetectingCrop] = useState<boolean>(false);

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

  const [isDetectingAngle, setIsDetectingAngle] = useState<boolean>(false);
  const [detectedAngle, setDetectedAngle] = useState<number | null>(null);

  // Reset page-specific detected angle when selecting a different page
  useEffect(() => {
    setDetectedAngle(null);
  }, [selectedPageId]);

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

  // Reset current session
  const resetJob = useCallback(() => {
    setSessionId(null);
    setPages([]);
    setSelectedPageId(null);
    setFileSingle(null);
    setFileOdds(null);
    setFileEvens(null);
    setError(null);
    setActiveTab("grid");
    setCropModule({
      enabled: false,
      mode: "spread",
      cropBox: { x1: 0.05, y1: 0.05, x2: 0.95, y2: 0.95 },
      splitPos: 0.50,
      scope: { mode: "all", customRange: "" },
    });
    setIsDetectingCrop(false);
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
    setDetectedAngle(null);
  }, []);

  // Initialize session with backend
  const initSession = useCallback(async (existingFilePath?: string) => {
    setIsInitializing(true);
    setError(null);

    try {
      const formData = new FormData();

      if (intakeMode === "dual_pass") {
        if (!fileOdds || !fileEvens) {
          throw new Error("Both Odds and Evens PDF files are required for Dual Pass ingestion.");
        }
        formData.append("mode", "dual");
        formData.append("is_spread", "false");
        formData.append("odds_order", oddsOrder);
        formData.append("evens_order", evensOrder);
        formData.append("spread_split_pos", "0.5");
        formData.append("file_odds", fileOdds);
        formData.append("file_evens", fileEvens);
      } else {
        const isSpread = intakeMode === "spread";
        formData.append("mode", "single");
        formData.append("is_spread", String(isSpread));
        formData.append("odds_order", "forward");
        formData.append("evens_order", "reverse");
        formData.append("spread_split_pos", String(splitPos));

        if (existingFilePath) {
          formData.append("existing_file_path", existingFilePath);
        } else {
          if (!fileSingle) {
            throw new Error("Please select a PDF file to begin.");
          }
          formData.append("file_single", fileSingle);
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/book-scan/init-session`, {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [intakeMode, fileOdds, fileEvens, oddsOrder, evensOrder, splitPos, fileSingle]);

  // Page manipulation actions
  const rotatePage = useCallback(async (pageId: string, delta: number = 90) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/book-scan/rotate/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, rotation_delta: delta }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, rotation: data.page.rotation } : p))
        );
      }
    } catch (err) {
      console.error("Rotate page failed:", err);
    }
  }, [sessionId]);

  const deletePage = useCallback(async (pageId: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/book-scan/page/${sessionId}/${pageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPages((prev) => {
          const remaining = prev.filter((p) => p.id !== pageId);
          if (selectedPageId === pageId) {
            setSelectedPageId(remaining.length > 0 ? remaining[0].id : null);
          }
          return remaining;
        });
      }
    } catch (err) {
      console.error("Delete page failed:", err);
    }
  }, [sessionId, selectedPageId]);

  const reorderPages = useCallback(async (fromIdx: number, toIdx: number) => {
    if (!sessionId || fromIdx === toIdx) return;
    setPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);

      // Persist to backend asynchronously
      fetch(`${API_BASE_URL}/api/book-scan/reorder/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_ids: copy.map((p) => p.id) }),
      }).catch((err) => console.error("Reorder backend sync error:", err));

      return copy;
    });
  }, [sessionId]);

  // Detect deskew angle via backend analysis
  const detectPageAngle = useCallback(async (pageId?: string) => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingAngle(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/book-scan/detect-angle/${sessionId}/${targetId}?max_angle=${deskewModule.maxAngle}&ignore_borders=${deskewModule.ignoreBorders}`,
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
  }, [sessionId, selectedPageId, deskewModule.maxAngle, deskewModule.ignoreBorders]);

  // Detect open book boundary and central spine fold
  const detectCrop = useCallback(async (pageId?: string): Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null> => {
    const targetId = pageId || selectedPageId;
    if (!sessionId || !targetId) return null;
    setIsDetectingCrop(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/book-scan/detect-crop/${sessionId}/${targetId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setCropModule((prev) => ({
          ...prev,
          cropBox: data.crop_box,
          splitPos: data.split_pos,
        }));
        return data;
      }
    } catch (err) {
      console.error("Detect crop failed:", err);
    } finally {
      setIsDetectingCrop(false);
    }
    return null;
  }, [sessionId, selectedPageId]);

  // Split a 2-page spread into discrete Left & Right pages in the deck
  const splitSpread = useCallback(async (target: "current" | "scope" = "current") => {
    if (!sessionId || !selectedPageId) return;
    try {
      let targetPageIds: string[] | undefined = undefined;
      let applyToAll = false;
      if (target === "scope") {
        if (cropModule.scope.mode === "all") {
          applyToAll = true;
        } else {
          targetPageIds = pages
            .filter((p, idx) => isPageInScope(idx + 1, cropModule.scope))
            .map((p) => p.id);
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/book-scan/split-spread/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId,
          crop_box: cropModule.cropBox,
          split_pos: cropModule.splitPos,
          apply_to_all: applyToAll,
          target_page_ids: targetPageIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
        if (data.new_selected_id) {
          setSelectedPageId(data.new_selected_id);
        }
        // Switch crop mode to single and reset crop box for the newly created page half
        setCropModule((prev) => ({
          ...prev,
          mode: "single",
          cropBox: { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 },
          splitPos: 0.5,
        }));
      }
    } catch (err) {
      console.error("Split spread failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule.cropBox, cropModule.splitPos, cropModule.scope, pages]);

  // Revert a split page back to its uncut 2-page spread
  const revertSpread = useCallback(async (mode: "current" | "all" = "current", pageId?: string) => {
    const targetId = pageId || selectedPageId;
    if (!sessionId) return;
    if (mode === "current" && !targetId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/book-scan/revert-spread/${sessionId}`, {
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
        if (data.new_selected_id) {
          setSelectedPageId(data.new_selected_id);
        }
        // Switch crop mode back to spread for recombined sheet
        setCropModule((prev) => ({
          ...prev,
          mode: "spread",
        }));
      }
    } catch (err) {
      console.error("Revert spread failed:", err);
    }
  }, [sessionId, selectedPageId]);

  // Crop outer dead space margins on single page (or pages in scope)
  const applyCrop = useCallback(async (target: "current" | "scope" = "current") => {
    if (!sessionId || !selectedPageId) return;
    try {
      let targetPageIds: string[] | undefined = undefined;
      let applyToAll = false;
      if (target === "scope") {
        if (cropModule.scope.mode === "all") {
          applyToAll = true;
        } else {
          targetPageIds = pages
            .filter((p, idx) => isPageInScope(idx + 1, cropModule.scope))
            .map((p) => p.id);
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/book-scan/crop-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId,
          crop_box: cropModule.cropBox,
          apply_to_all: applyToAll,
          target_page_ids: targetPageIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
      }
    } catch (err) {
      console.error("Apply crop failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule.cropBox, cropModule.scope, pages]);

  // Export print-ready PDF
  const exportPdf = useCallback(async () => {
    if (!sessionId) return;
    setIsExporting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/book-scan/export/${sessionId}`, {
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
      setError(msg);
    } finally {
      setIsExporting(false);
    }
  }, [
    sessionId,
    bleedModule,
    restorationModule,
    deskewModule,
    intakeMode,
  ]);

  // Debounced URL generator for thumbnails & high-res inspector
  const getThumbnailUrl = useCallback((pageId: string, isClean: boolean, dpi: number = 100) => {
    if (!sessionId) return "";
    const pageIdx = pages.findIndex((p) => p.id === pageId);
    const pageNum = pageIdx >= 0 ? pageIdx + 1 : 1;

    // Check scope applicability for this specific page
    const applyDeskew = deskewModule.enabled && isPageInScope(pageNum, deskewModule.scope);
    const applyRestoration = restorationModule.enabled && isPageInScope(pageNum, restorationModule.scope);

    const params = new URLSearchParams({
      preview_clean: String(isClean),
      clean_borders: String(applyRestoration ? restorationModule.cleanBorders : false),
      border_margin_px: String(debouncedMargin),
      border_threshold: String(restorationModule.borderThreshold),
      enhance_colors: String(applyRestoration ? restorationModule.enhanceColors : false),
      saturation: String(applyRestoration ? debouncedSaturation : 1.0),
      contrast: String(applyRestoration ? debouncedContrast : 1.0),
      deskew: "false",
      dpi: String(dpi),
      deskew_module_enabled: String(applyDeskew),
      deskew_mode: deskewModule.mode,
      deskew_angle: String(debouncedDeskewAngle),
      deskew_max_angle: String(deskewModule.maxAngle),
      deskew_ignore_borders: String(deskewModule.ignoreBorders),
    });
    return `${API_BASE_URL}/api/book-scan/page-thumbnail/${sessionId}/${pageId}?${params.toString()}`;
  }, [
    sessionId,
    pages,
    restorationModule,
    debouncedMargin,
    debouncedSaturation,
    debouncedContrast,
    deskewModule,
    debouncedDeskewAngle,
  ]);

  return {
    intakeMode, setIntakeMode,
    fileSingle, setFileSingle,
    fileOdds, setFileOdds,
    fileEvens, setFileEvens,
    oddsOrder, setOddsOrder,
    evensOrder, setEvensOrder,
    splitPos, setSplitPos,
    sessionId,
    pages,
    selectedPageId, setSelectedPageId,
    activeTab, setActiveTab,
    isInitializing,
    isExporting,
    error, setError,
    previewCleaned, setPreviewCleaned,
    debouncedBleed,
    debouncedMargin,
    debouncedSaturation,
    debouncedContrast,
    deskewModule, setDeskewModule,
    bleedModule, setBleedModule,
    restorationModule, setRestorationModule,
    cropModule, setCropModule,
    isDetectingCrop,
    detectCrop,
    splitSpread,
    revertSpread,
    applyCrop,
    isDetectingAngle, detectedAngle,
    detectPageAngle,
    settings,
    resetJob,
    initSession,
    rotatePage,
    deletePage,
    reorderPages,
    exportPdf,
    getThumbnailUrl,
  };
}
