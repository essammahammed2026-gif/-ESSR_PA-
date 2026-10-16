"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, downloadBlob } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import {
  ImposingItem,
  ImposingPage,
  ImposingPageMeta,
  ImposingUploadResponse,
  ImpositionPreviewResponse,
  PageRotation,
} from "@/types/prepress";

type UploadResult = ImposingUploadResponse & { error?: string };

/**
 * Single source of truth for hydrating ImposingPage[] from either upload
 * response metadata or fallback page counts.
 */
export function buildImposingPagesFromMeta(
  fileId: string,
  name: string,
  defaultW: number,
  defaultH: number,
  pageCount: number,
  pagesMeta?: ImposingPageMeta[]
): ImposingPage[] {
  const uid = () => `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  if (pagesMeta && Array.isArray(pagesMeta) && pagesMeta.length > 0) {
    return pagesMeta.map((p) => ({
      id: `${fileId}_p${p.page_num}_${uid()}`,
      file_id: fileId,
      name,
      original_page_num: p.page_num,
      display_page_num: p.page_num + 1,
      w: p.width_mm || defaultW,
      h: p.height_mm || defaultH,
      rotation: 0 as const,
      is_deleted: false,
      thumb_url: p.thumb_url || `/api/imposing/thumbnail/${fileId}/${p.page_num}`,
    }));
  }

  const count = Math.max(1, pageCount || 1);
  const list: ImposingPage[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      id: `${fileId}_p${i}_${uid()}`,
      file_id: fileId,
      name,
      original_page_num: i,
      display_page_num: i + 1,
      w: defaultW,
      h: defaultH,
      rotation: 0 as const,
      is_deleted: false,
      thumb_url: `/api/imposing/thumbnail/${fileId}/${i}`,
    });
  }
  return list;
}

/**
 * Unified Imposing Studio state, page-deck operations, and job lifecycle hook.
 * Consolidates usePageDeck, useImpositionState, and useImposingJob into one
 * cohesive domain.
 */
export function useImpositionStudio() {
  const [jobMode, setJobMode] = useState<"book" | "gang">("book");
  const [selectedBookIdx, setSelectedBookIdx] = useState(0);
  const [items, setItems] = useState<ImposingItem[]>([]);
  const [pages, setPages] = useState<ImposingPage[]>([]);
  const [mode, setMode] = useState<"Sheet" | "Roll">("Sheet");
  const [unit, setUnit] = useState("mm");

  const [sheetW, setSheetW] = useState(320);
  const [sheetH, setSheetH] = useState(450);
  const [sheetPreset, setSheetPreset] = useState("320,450");

  const [margin, setMargin] = useState(10.0);
  const [gap, setGap] = useState(5.0);
  const [drawBorder, setDrawBorder] = useState(false);
  const [borderColor, setBorderColor] = useState("#000000");
  const [cropMarks, setCropMarks] = useState(true);
  const [regMarks, setRegMarks] = useState(false);
  const [rows, setRows] = useState<number | null>(null);
  const [cols, setCols] = useState<number | null>(null);
  const [align, setAlign] = useState("Center");
  const [autoRotateSheet, setAutoRotateSheet] = useState(true);
  const [uniformOrientation, setUniformOrientation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [dbSheets, setDbSheets] = useState<{ name: string; width: number; height: number }[]>([]);
  const [dbRolls, setDbRolls] = useState<{ name: string; width: number }[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImpositionPreviewResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // --- Page Deck Operations ---
  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const rotatePage = useCallback((id: string, dir: "cw" | "ccw") => {
    const delta = dir === "cw" ? 90 : -90;
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, rotation: ((((p.rotation + delta) % 360) + 360) % 360) as ImposingPage["rotation"] }
          : p
      )
    );
  }, []);

  const toggleDeletePage = useCallback((id: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, is_deleted: !p.is_deleted } : p)));
  }, []);

  const duplicatePage = useCallback((id: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const clone: ImposingPage = {
        ...target,
        id: `${target.file_id}_copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        display_page_num: target.display_page_num || target.original_page_num + 1,
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  }, []);

  const clearAllPages = useCallback(() => {
    setPages([]);
    setItems([]);
  }, []);

  // --- Load Saved Presets & Defaults ---
  useEffect(() => {
    apiFetch(`/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sheets) {
          setDbSheets(data.sheets);
          setSheetW((prev) => (prev > 0 ? prev : data.sheets[0]?.width || 320));
          setSheetH((prev) => (prev > 0 ? prev : data.sheets[0]?.height || 450));
          setSheetPreset((prev) =>
            prev ? prev : data.sheets[0] ? `${data.sheets[0].width},${data.sheets[0].height}` : "320,450"
          );
        }
        if (data.rolls) setDbRolls(data.rolls);
        if (data.imposing) {
          if (data.imposing.default_sheet_unit) setUnit(data.imposing.default_sheet_unit);
          if (data.imposing.default_margin !== undefined) setMargin(data.imposing.default_margin);
          if (data.imposing.default_gap !== undefined) setGap(data.imposing.default_gap);
          if (data.imposing.crop_marks !== undefined) setCropMarks(data.imposing.crop_marks);
          if (data.imposing.draw_border !== undefined) setDrawBorder(data.imposing.draw_border);
          if (data.imposing.auto_rotate_sheet !== undefined) setAutoRotateSheet(data.imposing.auto_rotate_sheet);
          if (data.imposing.uniform_orientation !== undefined) setUniformOrientation(data.imposing.uniform_orientation);
        }
      })
      .catch(() => {});
  }, []);

  // Sync sheet dimensions when sheetPreset changes
  useEffect(() => {
    if (!sheetPreset || sheetPreset === "custom") return;
    if (mode === "Sheet") {
      const parts = sheetPreset.split(",");
      if (parts.length === 2) {
        setSheetW(parseFloat(parts[0]));
        setSheetH(parseFloat(parts[1]));
      }
    } else {
      setSheetW(parseFloat(sheetPreset));
    }
  }, [sheetPreset, mode]);

  // --- Layout Item & Request Payload Builders ---
  const getItemsForLayout = useCallback((): ImposingItem[] => {
    const activePages = pages.filter((p) => !p.is_deleted);
    if (activePages.length === 0) return items;
    return activePages.map((p) => {
      const baseItem = items.find((it) => it.file_id === p.file_id) || items[0];
      const pageRot: PageRotation = p.rotation === 90 ? "cw" : p.rotation === 270 ? "ccw" : "none";
      return {
        file_id: p.file_id,
        name: p.name || baseItem?.name || "Page",
        w: baseItem?.w || p.w,
        h: baseItem?.h || p.h,
        copies: 1,
        ratio: (baseItem?.w || p.w) / (baseItem?.h || p.h),
        page_count: 1,
        page_num: p.original_page_num,
        fit_mode: baseItem?.fit_mode || "stretch",
        page_rotation: pageRot,
        bleed_mode: baseItem?.bleed_mode || "none",
        bleed_mm: baseItem?.bleed_mm || 0,
        bleed_color: baseItem?.bleed_color || "#FFFFFF",
        bleed_type: baseItem?.bleed_type || "outside",
        keep_aspect: baseItem?.keep_aspect || false,
        fill_color: baseItem?.fill_color || "#FFFFFF",
      };
    });
  }, [items, pages]);

  const buildImposingPayload = useCallback(
    (layoutItems: ImposingItem[]) => ({
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
    [
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
    ]
  );

  // --- Upload, Preview & Export Handlers ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            file_id: data.file_id,
            name: data.name,
            w: data.w,
            h: data.h,
            copies: 1,
            ratio: data.w / data.h,
            locked: true,
            keep_aspect: false,
            fill_color: "#FFFFFF",
            original_w: data.w,
            original_h: data.h,
            page_count: data.page_count || 1,
            is_book: isBook,
            page_range: "all",
            fit_mode: "stretch",
            page_rotation: isBook ? "cw" : "none",
            bleed_mode: "none",
            bleed_mm: 0.0,
            bleed_color: "#FFFFFF",
            bleed_type: "outside",
          });

          newPages.push(
            ...buildImposingPagesFromMeta(
              data.file_id,
              data.name,
              data.w,
              data.h,
              data.page_count || 1,
              data.pages
            )
          );
        } else {
          setError((prev) => (prev ? `${prev}\n${data.error}` : data.error ?? "Upload failed."));
        }
      }

      if (newItems.length > 0) {
        if (hasBookUpload) setJobMode("book");
        setItems((prev) => [...prev, ...newItems]);
        setPages((prev) => [...prev, ...newPages]);
      }
    } catch {
      setError("Failed to upload files to imposing server.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }, []);

  const handlePreview = useCallback(async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsPreviewing(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/imposing/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildImposingPayload(layoutItems)),
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
  }, [getItemsForLayout, sheetW, sheetH, buildImposingPayload]);

  const handleExport = useCallback(async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsExporting(true);
    setError(null);

    try {
      await downloadBlob(`/api/imposing/export`, `Imposed_${mode}_${Date.now()}.pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildImposingPayload(layoutItems)),
      });
    } catch {
      setError("Failed to export print-ready PDF.");
    } finally {
      setIsExporting(false);
    }
  }, [getItemsForLayout, sheetW, sheetH, mode, buildImposingPayload]);

  // Debounced auto-preview key (350ms via shared hook)
  const debouncedPreviewKey = useDebounce(
    JSON.stringify({
      items,
      pages,
      jobMode,
      mode,
      sheetW,
      sheetH,
      margin,
      gap,
      rows,
      cols,
      align,
      drawBorder,
      borderColor,
      cropMarks,
      autoRotateSheet,
      uniformOrientation,
    }),
    350
  );
  useEffect(() => {
    if (items.length === 0 && pages.length === 0) return;
    handlePreview();
  }, [debouncedPreviewKey, items.length, pages.length, handlePreview]);

  return {
    jobMode, setJobMode,
    selectedBookIdx, setSelectedBookIdx,
    items, setItems,
    pages, setPages,
    reorderPages,
    rotatePage,
    toggleDeletePage,
    duplicatePage,
    clearAllPages,
    mode, setMode,
    unit, setUnit,
    sheetW, setSheetW,
    sheetH, setSheetH,
    sheetPreset, setSheetPreset,
    margin, setMargin,
    gap, setGap,
    drawBorder, setDrawBorder,
    borderColor, setBorderColor,
    cropMarks, setCropMarks,
    regMarks, setRegMarks,
    rows, setRows,
    cols, setCols,
    align, setAlign,
    autoRotateSheet, setAutoRotateSheet,
    uniformOrientation, setUniformOrientation,
    showAdvanced, setShowAdvanced,
    dbSheets, dbRolls,
    isUploading,
    isPreviewing,
    isExporting,
    previewData,
    currentPage, setCurrentPage,
    error, setError,
    handleFileUpload,
    handlePreview,
    handleExport,
  };
}
