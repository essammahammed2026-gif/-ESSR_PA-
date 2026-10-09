"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

import { ImposingItem, ImposingPage, ImpositionPreviewResponse, PageRotation } from "@/types/prepress";
import { useImpositionState } from "@/hooks/useImpositionState";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { PreviewViewport } from "@/components/imposing/PreviewViewport";
import { LeftAssetPanel } from "@/components/imposing/LeftAssetPanel";
import { RightControlPanel } from "@/components/imposing/RightControlPanel";



function ImposingStudioContent() {
  const {
    jobMode, setJobMode,
    items, setItems,
    pages, setPages,
    reorderPages,
    rotatePage,
    toggleDeletePage,
    duplicatePage,
    clearAllPages,
    mode,
    autoRotateSheet,
    
    unit,
    sheetW, setSheetW,
    sheetH, setSheetH,
    sheetPreset, setSheetPreset,
    margin, setMargin,
    gap, setGap,
    drawBorder,
    borderColor,
    cropMarks, setCropMarks,
    regMarks, setRegMarks,
    rows, setRows,
    cols, setCols,
    align, uniformOrientation,
  } = useImpositionState();

  const searchParams = useSearchParams();

  // Preload file if directed from Command Center / Hub
  useEffect(() => {
    const fileIdParam = searchParams.get("file_id");
    const nameParam = searchParams.get("name") || "Preloaded Artwork";
    const wParam = parseFloat(searchParams.get("w") || "0");
    const hParam = parseFloat(searchParams.get("h") || "0");
    const pageCountParam = parseInt(searchParams.get("page_count") || "1", 10);
    const modeParam = searchParams.get("job_mode");

    if (fileIdParam && wParam > 0 && hParam > 0) {
      const isBook = pageCountParam > 1;
      if (modeParam === "gang" || modeParam === "book") {
        setJobMode(modeParam);
      } else {
        setJobMode(isBook ? "book" : "gang");
      }

      setSheetW(prev => prev > 0 ? prev : 320);
      setSheetH(prev => prev > 0 ? prev : 450);
      setSheetPreset(prev => prev ? prev : "320,450");

      setItems([{
        file_id: fileIdParam,
        name: nameParam,
        w: wParam,
        h: hParam,
        copies: 1,
        ratio: wParam / hParam,
        locked: true,
        keep_aspect: false,
        fill_color: "#FFFFFF",
        original_w: wParam,
        original_h: hParam,
        page_count: pageCountParam,
        is_book: isBook,
        page_range: "all",
        fit_mode: "stretch",
        page_rotation: isBook ? "cw" : "none",
        bleed_mode: "none",
        bleed_mm: 0.0,
        bleed_color: "#FFFFFF",
        bleed_type: "outside"
      }]);

      // Retrieve granular pages from backend API
      fetch(`${API_BASE_URL}/api/imposing/pages/${fileIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.pages && Array.isArray(data.pages)) {
            setPages(data.pages.map((p: { page_num: number; width_mm: number; height_mm: number; thumb_url: string }) => ({
              id: `${fileIdParam}_p${p.page_num}`,
              file_id: fileIdParam,
              name: nameParam,
              original_page_num: p.page_num,
              display_page_num: p.page_num + 1,
              w: p.width_mm || wParam,
              h: p.height_mm || hParam,
              rotation: 0 as const,
              is_deleted: false,
              thumb_url: p.thumb_url || `/api/imposing/thumbnail/${fileIdParam}/${p.page_num}`,
            })));
          } else {
            const fallbackList = [];
            for (let i = 0; i < pageCountParam; i++) {
              fallbackList.push({
                id: `${fileIdParam}_p${i}`,
                file_id: fileIdParam,
                name: nameParam,
                original_page_num: i,
                display_page_num: i + 1,
                w: wParam,
                h: hParam,
                rotation: 0 as const,
                is_deleted: false,
                thumb_url: `/api/imposing/thumbnail/${fileIdParam}/${i}`,
              });
            }
            setPages(fallbackList);
          }
        })
        .catch(() => {
          const fallbackList = [];
          for (let i = 0; i < pageCountParam; i++) {
            fallbackList.push({
              id: `${fileIdParam}_p${i}`,
              file_id: fileIdParam,
              name: nameParam,
              original_page_num: i,
              display_page_num: i + 1,
              w: wParam,
              h: hParam,
              rotation: 0 as const,
              is_deleted: false,
              thumb_url: `/api/imposing/thumbnail/${fileIdParam}/${i}`,
            });
          }
          setPages(fallbackList);
        });
    }
  }, [searchParams, setJobMode, setItems, setPages, setSheetH, setSheetPreset, setSheetW]);

  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImpositionPreviewResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bookStep = 2;
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
  }, [sheetPreset, mode, setSheetH, setSheetW]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    setIsUploading(true);
    setError(null);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE_URL}/api/imposing/upload`, {
          method: "POST",
          body: formData,
        });
        return res.json();
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
            bleed_type: "outside"
          });

          if (data.pages && Array.isArray(data.pages)) {
            data.pages.forEach((p: { page_num: number; width_mm: number; height_mm: number; thumb_url: string }) => {
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
          setError(prev => prev ? `${prev}\n${data.error}` : data.error);
        }
      }
      
      if (newItems.length > 0) {
        if (hasBookUpload) {
          setJobMode("book");
        }
        setItems(prev => [...prev, ...newItems]);
        setPages(prev => [...prev, ...newPages]);
      }
    } catch {
      setError("Failed to upload files to imposing server.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const getItemsForLayout = useCallback((): ImposingItem[] => {
    const activePages = pages.filter(p => !p.is_deleted);
    if (activePages.length === 0) {
      return items;
    }
    return activePages.map((p) => {
      const baseItem = items.find((it) => it.file_id === p.file_id) || items[0];
      const pageRot: PageRotation =
        p.rotation === 90 ? "cw" : p.rotation === 270 ? "ccw" : "none";
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

  const handlePreview = useCallback(async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsPreviewing(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/preview`, {
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
          uniform_orientation: uniformOrientation
        })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
        setCurrentPage(0);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to calculate imposing layout.");
    } finally {
      setIsPreviewing(false);
    }
  }, [getItemsForLayout, jobMode, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, regMarks, rows, cols, align, autoRotateSheet, uniformOrientation]);

  const handleExport = async () => {
    const layoutItems = getItemsForLayout();
    if (layoutItems.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsExporting(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/export`, {
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
          uniform_orientation: uniformOrientation
        })
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Imposed_${mode}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export print-ready PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  // Debounced auto-preview (350ms)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (items.length === 0 && pages.length === 0) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { 
      handlePreview(); 
    }, 350);
    return () => { 
      if (typingTimeout.current) clearTimeout(typingTimeout.current); 
    };
  }, [items, pages, jobMode, mode, sheetW, sheetH, margin, gap, rows, cols, align, drawBorder, borderColor, cropMarks, autoRotateSheet, handlePreview]);

  return (
    <StudioLayout
      title="Imposing Studio"
      statusBadge={
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#181D27] border border-[#242A38] text-xs">
          <span className="text-slate-400 font-mono font-medium">
            {sheetW}×{sheetH}{unit}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-semibold uppercase text-[11px]">
            {jobMode}
          </span>
        </div>
      }
      leftLabel="Deck"
      leftPanel={
        <LeftAssetPanel 
          items={items}
          pages={pages}
          handleFileUpload={handleFileUpload}
          isUploading={isUploading}
          reorderPages={reorderPages}
          rotatePage={rotatePage}
          toggleDeletePage={toggleDeletePage}
          duplicatePage={duplicatePage}
          clearAllPages={clearAllPages}
        />
      }
      centerViewport={
        <PreviewViewport
          previewData={previewData}
          items={items}
          jobMode={jobMode}
          bookStep={bookStep}
          isPreviewing={isPreviewing}
          sheetW={sheetW}
          sheetH={sheetH}
          margin={margin}
          drawBorder={drawBorder}
          borderColor={borderColor}
          cropMarks={cropMarks}
          regMarks={regMarks}
          error={error}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      }
      rightLabel="Controls"
      rightPanel={
        <RightControlPanel
          jobMode={jobMode}
          setJobMode={setJobMode}
          items={items}
          sheetPreset={sheetPreset}
          setSheetPreset={setSheetPreset}
          sheetW={sheetW}
          setSheetW={setSheetW}
          sheetH={sheetH}
          setSheetH={setSheetH}
          unit={unit}
          gap={gap}
          setGap={setGap}
          margin={margin}
          setMargin={setMargin}
          handleExport={handleExport}
          isExporting={isExporting}
          cropMarks={cropMarks}
          setCropMarks={setCropMarks}
          regMarks={regMarks}
          setRegMarks={setRegMarks}
          rows={rows}
          setRows={setRows}
          cols={cols}
          setCols={setCols}
          handlePreview={handlePreview}
        />
      }
    />
  );
}

export default function ImposingStudio() {
  return (
    <Suspense fallback={null}>
      <ImposingStudioContent />
    </Suspense>
  );
}
