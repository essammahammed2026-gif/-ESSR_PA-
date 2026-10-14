"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { ImposingItem, ImposingPage, ImposingPageMeta, PageRotation } from "@/types/prepress";
import { useImpositionState } from "@/hooks/useImpositionState";
import { useImposingJob } from "@/hooks/useImposingJob";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { PreviewViewport } from "@/components/imposing/PreviewViewport";
import { LeftAssetPanel } from "@/components/imposing/LeftAssetPanel";
import { RightControlPanel } from "@/components/imposing/RightControlPanel";

interface PreloadPagesResponse { success: boolean; pages?: ImposingPageMeta[] }

function buildFallbackPages(fileId: string, name: string, w: number, h: number, count: number): ImposingPage[] {
  const list: ImposingPage[] = [];
  for (let i = 0; i < count; i++) {
    list.push({ id: `${fileId}_p${i}`, file_id: fileId, name, original_page_num: i, display_page_num: i + 1, w, h, rotation: 0 as const, is_deleted: false, thumb_url: `/api/imposing/thumbnail/${fileId}/${i}` });
  }
  return list;
}

function ImposingStudioContent() {
  const { jobMode, setJobMode, items, setItems, pages, setPages, reorderPages, rotatePage, toggleDeletePage, duplicatePage, clearAllPages, mode, autoRotateSheet, unit, sheetW, setSheetW, sheetH, setSheetH, sheetPreset, setSheetPreset, margin, setMargin, gap, setGap, drawBorder, borderColor, cropMarks, setCropMarks, regMarks, setRegMarks, rows, setRows, cols, setCols, align, uniformOrientation } = useImpositionState();
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
      if (modeParam === "gang" || modeParam === "book") setJobMode(modeParam);
      else setJobMode(isBook ? "book" : "gang");
      setSheetW((prev) => (prev > 0 ? prev : 320));
      setSheetH((prev) => (prev > 0 ? prev : 450));
      setSheetPreset((prev) => (prev ? prev : "320,450"));
      setItems([{ file_id: fileIdParam, name: nameParam, w: wParam, h: hParam, copies: 1, ratio: wParam / hParam, locked: true, keep_aspect: false, fill_color: "#FFFFFF", original_w: wParam, original_h: hParam, page_count: pageCountParam, is_book: isBook, page_range: "all", fit_mode: "stretch", page_rotation: isBook ? "cw" : "none", bleed_mode: "none", bleed_mm: 0.0, bleed_color: "#FFFFFF", bleed_type: "outside" }]);
      // Retrieve granular pages from backend API
      fetch(getApiUrl(`/api/imposing/pages/${fileIdParam}`))
        .then((res) => res.json())
        .then((data: PreloadPagesResponse) => {
          if (data.success && data.pages && Array.isArray(data.pages)) {
            setPages(data.pages.map((p) => ({ id: `${fileIdParam}_p${p.page_num}`, file_id: fileIdParam, name: nameParam, original_page_num: p.page_num, display_page_num: p.page_num + 1, w: p.width_mm || wParam, h: p.height_mm || hParam, rotation: 0 as const, is_deleted: false, thumb_url: p.thumb_url || `/api/imposing/thumbnail/${fileIdParam}/${p.page_num}` })));
          } else {
            setPages(buildFallbackPages(fileIdParam, nameParam, wParam, hParam, pageCountParam));
          }
        })
        .catch(() => {
          setPages(buildFallbackPages(fileIdParam, nameParam, wParam, hParam, pageCountParam));
        });
    }
  }, [searchParams, setJobMode, setItems, setPages, setSheetH, setSheetPreset, setSheetW]);

  useEffect(() => {
    if (!sheetPreset || sheetPreset === "custom") return;
    if (mode === "Sheet") {
      const parts = sheetPreset.split(",");
      if (parts.length === 2) { setSheetW(parseFloat(parts[0])); setSheetH(parseFloat(parts[1])); }
    } else {
      setSheetW(parseFloat(sheetPreset));
    }
  }, [sheetPreset, mode, setSheetH, setSheetW]);

  const getItemsForLayout = useCallback((): ImposingItem[] => {
    const activePages = pages.filter((p) => !p.is_deleted);
    if (activePages.length === 0) return items;
    return activePages.map((p) => {
      const baseItem = items.find((it) => it.file_id === p.file_id) || items[0];
      const pageRot: PageRotation = p.rotation === 90 ? "cw" : p.rotation === 270 ? "ccw" : "none";
      return { file_id: p.file_id, name: p.name || baseItem?.name || "Page", w: baseItem?.w || p.w, h: baseItem?.h || p.h, copies: 1, ratio: (baseItem?.w || p.w) / (baseItem?.h || p.h), page_count: 1, page_num: p.original_page_num, fit_mode: baseItem?.fit_mode || "stretch", page_rotation: pageRot, bleed_mode: baseItem?.bleed_mode || "none", bleed_mm: baseItem?.bleed_mm || 0, bleed_color: baseItem?.bleed_color || "#FFFFFF", bleed_type: baseItem?.bleed_type || "outside", keep_aspect: baseItem?.keep_aspect || false, fill_color: baseItem?.fill_color || "#FFFFFF" };
    });
  }, [items, pages]);

  const { isUploading, isPreviewing, isExporting, previewData, currentPage, setCurrentPage, error, handleFileUpload, handlePreview, handleExport } = useImposingJob({ getItemsForLayout, jobMode, setJobMode, items, pages, setItems, setPages, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, regMarks, rows, cols, align, autoRotateSheet, uniformOrientation });
  const bookStep = 2;

  return (
    <StudioLayout
      title="Imposing Studio"
      statusBadge={
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#181D27] border border-[#242A38] text-xs">
          <span className="text-slate-400 font-mono font-medium">{sheetW}×{sheetH}{unit}</span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-semibold uppercase text-[11px]">{jobMode}</span>
        </div>
      }
      leftLabel="Deck"
      leftPanel={<LeftAssetPanel items={items} pages={pages} handleFileUpload={handleFileUpload} isUploading={isUploading} reorderPages={reorderPages} rotatePage={rotatePage} toggleDeletePage={toggleDeletePage} duplicatePage={duplicatePage} clearAllPages={clearAllPages} />}
      centerViewport={<PreviewViewport previewData={previewData} items={items} jobMode={jobMode} bookStep={bookStep} isPreviewing={isPreviewing} sheetW={sheetW} sheetH={sheetH} margin={margin} drawBorder={drawBorder} borderColor={borderColor} cropMarks={cropMarks} regMarks={regMarks} error={error} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
      rightLabel="Controls"
      rightPanel={<RightControlPanel jobMode={jobMode} setJobMode={setJobMode} items={items} sheetPreset={sheetPreset} setSheetPreset={setSheetPreset} sheetW={sheetW} setSheetW={setSheetW} sheetH={sheetH} setSheetH={setSheetH} unit={unit} gap={gap} setGap={setGap} margin={margin} setMargin={setMargin} handleExport={handleExport} isExporting={isExporting} cropMarks={cropMarks} setCropMarks={setCropMarks} regMarks={regMarks} setRegMarks={setRegMarks} rows={rows} setRows={setRows} cols={cols} setCols={setCols} handlePreview={handlePreview} />}
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
