"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ImposingPageMeta } from "@/types/prepress";
import { useImpositionStudio, buildImposingPagesFromMeta } from "@/hooks/useImpositionStudio";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { PreviewViewport } from "@/components/imposing/PreviewViewport";
import { LeftAssetPanel } from "@/components/imposing/LeftAssetPanel";
import { RightControlPanel } from "@/components/imposing/RightControlPanel";

interface PreloadPagesResponse {
  success: boolean;
  pages?: ImposingPageMeta[];
}

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
    isUploading,
    isPreviewing,
    isExporting,
    previewData,
    currentPage, setCurrentPage,
    error,
    handleFileUpload,
    handlePreview,
    handleExport,
  } = useImpositionStudio();

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
      setItems([
        {
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
          bleed_type: "outside",
        },
      ]);

      apiFetch(`/api/imposing/pages/${fileIdParam}`)
        .then((res) => res.json())
        .then((data: PreloadPagesResponse) => {
          setPages(
            buildImposingPagesFromMeta(
              fileIdParam,
              nameParam,
              wParam,
              hParam,
              pageCountParam,
              data.success ? data.pages : undefined
            )
          );
        })
        .catch(() => {
          setPages(buildImposingPagesFromMeta(fileIdParam, nameParam, wParam, hParam, pageCountParam));
        });
    }
  }, [searchParams, setJobMode, setItems, setPages, setSheetH, setSheetPreset, setSheetW]);

  const bookStep = 2;

  return (
    <StudioLayout
      title="Imposing Studio"
      breadcrumbs={
        items.length > 0
          ? [
              { label: jobMode === "book" ? "Book Mode" : "Gang Run" },
              { label: items[0].name },
            ]
          : [{ label: jobMode === "book" ? "Book Mode" : "Gang Run" }]
      }
      statusBadge={
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#181D27] border border-[#242A38] text-xs">
          <span className="text-slate-400 font-mono font-medium">{sheetW}×{sheetH}{unit}</span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-semibold uppercase text-[11px]">{jobMode}</span>
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
