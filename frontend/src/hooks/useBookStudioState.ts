import { useState, useCallback, useMemo } from "react";
import { API_BASE_URL } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { BookIntakeMode, BookStudioPage, BookProcessSettings } from "@/types/book_studio";

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
  const [bleedMm, setBleedMm] = useState<number>(3.0);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [exportDpi, setExportDpi] = useState<number>(200);

  const [cleanBorders, setCleanBorders] = useState<boolean>(true);
  const [borderMarginPx, setBorderMarginPx] = useState<number>(15);
  const [borderThreshold] = useState<number>(210);

  const [enhanceColors, setEnhanceColors] = useState<boolean>(true);
  const [saturation, setSaturation] = useState<number>(1.30);
  const [contrast, setContrast] = useState<number>(1.10);
  const [deskew, setDeskew] = useState<boolean>(false);
  const [sharpen] = useState<boolean>(true);

  // Golden Rule: Debounce reactive slider controls (350ms)
  const debouncedMargin = useDebounce(borderMarginPx, 350);
  const debouncedSaturation = useDebounce(saturation, 350);
  const debouncedContrast = useDebounce(contrast, 350);
  const debouncedBleed = useDebounce(bleedMm, 350);

  // Consolidated settings
  const settings: BookProcessSettings = useMemo(() => ({
    bleedMm,
    showCropMarks,
    exportDpi,
    cleanBorders,
    borderMarginPx,
    borderThreshold,
    enhanceColors,
    saturation,
    contrast,
    deskew,
    sharpen,
  }), [
    bleedMm,
    showCropMarks,
    exportDpi,
    cleanBorders,
    borderMarginPx,
    borderThreshold,
    enhanceColors,
    saturation,
    contrast,
    deskew,
    sharpen,
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
          bleed_mm: bleedMm,
          show_crop_marks: showCropMarks,
          dpi: exportDpi,
          clean_borders: cleanBorders,
          border_margin_px: borderMarginPx,
          border_threshold: borderThreshold,
          enhance_colors: enhanceColors,
          saturation: saturation,
          contrast: contrast,
          deskew: deskew,
          sharpen,
        }),
      });

      if (!res.ok) {
        throw new Error("Export PDF failed on server.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `book_${intakeMode}_${bleedMm}mm_bleed.pdf`;
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
    bleedMm,
    showCropMarks,
    exportDpi,
    cleanBorders,
    borderMarginPx,
    borderThreshold,
    enhanceColors,
    saturation,
    contrast,
    deskew,
    sharpen,
    intakeMode,
  ]);

  // Debounced URL generator for thumbnails & high-res inspector
  const getThumbnailUrl = useCallback((pageId: string, isClean: boolean, dpi: number = 100) => {
    if (!sessionId) return "";
    const params = new URLSearchParams({
      preview_clean: String(isClean),
      clean_borders: String(cleanBorders),
      border_margin_px: String(debouncedMargin),
      border_threshold: String(borderThreshold),
      enhance_colors: String(enhanceColors),
      saturation: String(debouncedSaturation),
      contrast: String(debouncedContrast),
      deskew: String(deskew),
      dpi: String(dpi),
    });
    return `${API_BASE_URL}/api/book-scan/page-thumbnail/${sessionId}/${pageId}?${params.toString()}`;
  }, [
    sessionId,
    cleanBorders,
    debouncedMargin,
    borderThreshold,
    enhanceColors,
    debouncedSaturation,
    debouncedContrast,
    deskew,
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
    bleedMm, setBleedMm, debouncedBleed,
    showCropMarks, setShowCropMarks,
    exportDpi, setExportDpi,
    cleanBorders, setCleanBorders,
    borderMarginPx, setBorderMarginPx, debouncedMargin,
    borderThreshold,
    enhanceColors, setEnhanceColors,
    saturation, setSaturation, debouncedSaturation,
    contrast, setContrast, debouncedContrast,
    deskew, setDeskew,
    sharpen,
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
