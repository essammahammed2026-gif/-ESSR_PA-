import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  BleedModuleConfig,
  BookIntakeMode,
  DeskewModuleConfig,
  RestorationModuleConfig,
} from "@/types/book_studio";

export interface UseBookExportArgs {
  sessionId: string | null;
  bleedModule: BleedModuleConfig;
  deskewModule: DeskewModuleConfig;
  restorationModule: RestorationModuleConfig;
}

/** Print-ready PDF export for Book Studio (extracted from useBookModules — fix.md Phase 2). */
export function useBookExport({ sessionId, bleedModule, deskewModule, restorationModule }: UseBookExportArgs) {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  }, [
    sessionId,
    bleedModule,
    restorationModule,
    deskewModule,
  ]);

  return { isExporting, exportError, setExportError, exportPdf };
}
