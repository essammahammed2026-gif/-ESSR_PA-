"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, downloadBlob } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import {
  ImposingItem,
  ImposingPage,
  ImposingPageMeta,
  ImposingUploadResponse,
  ImpositionPreviewResponse,
} from "@/types/prepress";

export interface ImposingLayoutParams {
  jobMode: "book" | "gang";
  mode: "Sheet" | "Roll";
  sheetW: number;
  sheetH: number;
  margin: number;
  gap: number;
  drawBorder: boolean;
  borderColor: string;
  cropMarks: boolean;
  regMarks: boolean;
  rows: number | null;
  cols: number | null;
  align: string;
  autoRotateSheet: boolean;
  uniformOrientation: boolean;
}

export interface UseImposingJobArgs extends ImposingLayoutParams {
  getItemsForLayout: () => ImposingItem[];
  setJobMode: React.Dispatch<React.SetStateAction<"book" | "gang">>;
  items: ImposingItem[];
  pages: ImposingPage[];
  setItems: React.Dispatch<React.SetStateAction<ImposingItem[]>>;
  setPages: React.Dispatch<React.SetStateAction<ImposingPage[]>>;
}

export interface UseImposingJobResult {
  isUploading: boolean;
  isPreviewing: boolean;
  isExporting: boolean;
  previewData: ImpositionPreviewResponse | null;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePreview: () => Promise<void>;
  handleExport: () => Promise<void>;
}

type UploadResult = ImposingUploadResponse & { error?: string };

export function useImposingJob(args: UseImposingJobArgs): UseImposingJobResult {
  const {
    getItemsForLayout,
    setJobMode,
    items,
    pages,
    setItems,
    setPages,
    jobMode,
    mode,
    sheetW,
    sheetH,
    margin,
    gap,
    drawBorder,
    borderColor,
    cropMarks,
    regMarks,
    rows,
    cols,
    align,
    autoRotateSheet,
    uniformOrientation,
  } = args;

  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImpositionPreviewResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const files = Array.from(e.target.files);

      setIsUploading(true);
      setError(null);

      try {
        const uploadPromises = files.map(async (file: File): Promise<UploadResult> => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await apiFetch(`/api/imposing/upload`, {
            method: "POST",
            body: formData,
          });
          return (await res.json()) as UploadResult;
        });

        const results = await Promise.all(uploadPromises);

        const newItems: ImposingItem[] = [];
        const newPages: ImposingPage[] = [];
        let hasBookUpload = false;
        for (const data of results) {
          if (data.success) {
            const isBook = !!data.is_book || (data.page_count !== undefined && data.page_count > 1);
            if (isBook) hasBookUpload = true;
            newItems.push({
              file_id: data.file_id, name: data.name, w: data.w, h: data.h, copies: 1, ratio: data.w / data.h, locked: true, keep_aspect: false,
              fill_color: "#FFFFFF", original_w: data.w, original_h: data.h, page_count: data.page_count || 1, is_book: isBook,
              page_range: "all", fit_mode: "stretch", page_rotation: isBook ? "cw" : "none", bleed_mode: "none", bleed_mm: 0.0, bleed_color: "#FFFFFF", bleed_type: "outside",
            });

            if (data.pages && Array.isArray(data.pages)) {
              data.pages.forEach((p: ImposingPageMeta) => {
                newPages.push({
                  id: `${data.file_id}_p${p.page_num}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  file_id: data.file_id,
                  name: data.name,
                  original_page_num: p.page_num,
                  display_page_num: p.page_num + 1,
                  w: p.width_mm || data.w,
                  h: p.height_mm || data.h,
                  rotation: 0 as const,
                  is_deleted: false,
                  thumb_url: p.thumb_url || `/api/imposing/thumbnail/${data.file_id}/${p.page_num}`,
                });
              });
            } else {
              const count = data.page_count || 1;
              for (let i = 0; i < count; i++) {
                newPages.push({
                  id: `${data.file_id}_p${i}_${Date.now()}`,
                  file_id: data.file_id,
                  name: data.name,
                  original_page_num: i,
                  display_page_num: i + 1,
                  w: data.w,
                  h: data.h,
                  rotation: 0 as const,
                  is_deleted: false,
                  thumb_url: `/api/imposing/thumbnail/${data.file_id}/${i}`,
                });
              }
            }
          } else {
            setError((prev) => (prev ? `${prev}\n${data.error}` : (data.error ?? "Upload failed.")));
          }
        }

        if (newItems.length > 0) {
          if (hasBookUpload) {
            setJobMode("book");
          }
          setItems((prev) => [...prev, ...newItems]);
          setPages((prev) => [...prev, ...newPages]);
        }
      } catch {
        setError("Failed to upload files to imposing server.");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [setItems, setJobMode, setPages]
  );

  const handlePreview = useCallback(async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsPreviewing(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/imposing/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: layoutItems,
          job_mode: jobMode,
          mode,
          sheet_w: sheetW,
          sheet_h: sheetH,
          margin,
          gap,
          draw_border: drawBorder,
          border_color: borderColor,
          crop_marks: cropMarks,
          reg_marks: regMarks,
          rows: rows ?? undefined,
          cols: cols ?? undefined,
          align,
          auto_rotate_sheet: autoRotateSheet,
          uniform_orientation: uniformOrientation,
        }),
      });
      const data = (await res.json()) as ImpositionPreviewResponse;
      if (data.success) {
        setPreviewData(data);
        setCurrentPage(0);
      } else {
        setError(data.error ?? "Preview failed.");
      }
    } catch {
      setError("Failed to calculate imposing layout.");
    } finally {
      setIsPreviewing(false);
    }
  }, [getItemsForLayout, jobMode, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, regMarks, rows, cols, align, autoRotateSheet, uniformOrientation]);

  const handleExport = useCallback(async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsExporting(true);
    setError(null);

    try {
      await downloadBlob(`/api/imposing/export`, `Imposed_${mode}_${Date.now()}.pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: layoutItems,
          job_mode: jobMode,
          mode,
          sheet_w: sheetW,
          sheet_h: sheetH,
          margin,
          gap,
          draw_border: drawBorder,
          border_color: borderColor,
          crop_marks: cropMarks,
          reg_marks: regMarks,
          rows: rows ?? undefined,
          cols: cols ?? undefined,
          align,
          auto_rotate_sheet: autoRotateSheet,
          uniform_orientation: uniformOrientation,
        }),
      });
    } catch {
      setError("Failed to export print-ready PDF.");
    } finally {
      setIsExporting(false);
    }
  }, [getItemsForLayout, jobMode, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, regMarks, rows, cols, align, autoRotateSheet, uniformOrientation]);

  // Debounced auto-preview key (350ms via shared hook — fix.md Phase 2.5)
  const debouncedPreviewKey = useDebounce(
    JSON.stringify({ items, pages, jobMode, mode, sheetW, sheetH, margin, gap, rows, cols, align, drawBorder, borderColor, cropMarks, autoRotateSheet, uniformOrientation }),
    350
  );
  useEffect(() => {
    if (items.length === 0 && pages.length === 0) return;
    handlePreview();
  }, [debouncedPreviewKey, items.length, pages.length, handlePreview]);

  return {
    isUploading,
    isPreviewing,
    isExporting,
    previewData,
    currentPage,
    setCurrentPage,
    error,
    setError,
    handleFileUpload,
    handlePreview,
    handleExport,
  };
}
