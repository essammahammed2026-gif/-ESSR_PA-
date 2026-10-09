"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, FolderOpen, SlidersHorizontal } from "lucide-react";
import { useBookStudioState } from "@/hooks/useBookStudioState";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { BookLeftPanel } from "@/components/book-studio/BookLeftPanel";
import { BookWorkspace } from "@/components/book-studio/BookWorkspace";
import { BookRightPanel } from "@/components/book-studio/BookRightPanel";

function BookStudioContent() {
  const {
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
    isInitializing,
    isExporting,
    error,
    bleedMm, setBleedMm,
    showCropMarks, setShowCropMarks,
    exportDpi, setExportDpi,
    cleanBorders, setCleanBorders,
    borderMarginPx, setBorderMarginPx,
    enhanceColors, setEnhanceColors,
    saturation, setSaturation,
    contrast, setContrast,
    deskew, setDeskew,
    resetJob,
    initSession,
    rotatePage,
    deletePage,
    reorderPages,
    exportPdf,
    getThumbnailUrl,
  } = useBookStudioState();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);

  const searchParams = useSearchParams();

  // Preload file if routed from Hub or Command Center
  useEffect(() => {
    const filePathParam = searchParams.get("file_path");
    if (filePathParam && !sessionId && !isInitializing) {
      setIntakeMode("single_page");
      initSession(filePathParam);
    }
  }, [searchParams, sessionId, isInitializing, setIntakeMode, initSession]);

  return (
    <StudioLayout
      title="Book Studio"
      statusBadge={
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#181D27] border border-[#242A38] text-xs">
          <BookOpen size={13} className="text-amber-400" />
          <span className="text-slate-300 font-medium">
            {sessionId ? `${pages.length} Pages Loaded` : "Intake Ready"}
          </span>
        </div>
      }
      error={error}

      // Left Panel: Intake & Thumbnails Deck
      leftLabel="Deck"
      leftIcon={<FolderOpen size={13} />}
      isLeftCollapsed={isLeftCollapsed}
      onToggleLeft={() => setIsLeftCollapsed((prev) => !prev)}
      leftPanel={
        <BookLeftPanel
          intakeMode={intakeMode}
          setIntakeMode={setIntakeMode}
          fileSingle={fileSingle}
          setFileSingle={setFileSingle}
          fileOdds={fileOdds}
          setFileOdds={setFileOdds}
          fileEvens={fileEvens}
          setFileEvens={setFileEvens}
          oddsOrder={oddsOrder}
          setOddsOrder={setOddsOrder}
          evensOrder={evensOrder}
          setEvensOrder={setEvensOrder}
          splitPos={splitPos}
          setSplitPos={setSplitPos}
          sessionId={sessionId}
          pages={pages}
          selectedPageId={selectedPageId}
          setSelectedPageId={setSelectedPageId}
          isInitializing={isInitializing}
          initSession={() => initSession()}
          resetJob={resetJob}
          rotatePage={rotatePage}
          deletePage={deletePage}
          reorderPages={reorderPages}
          getThumbnailUrl={getThumbnailUrl}
          onCollapse={() => setIsLeftCollapsed(true)}
        />
      }

      // Center Viewport: Full-Page High-Res Canvas with Space/O Overlay
      centerViewport={
        <BookWorkspace
          pages={pages}
          selectedPageId={selectedPageId}
          setSelectedPageId={setSelectedPageId}
          getThumbnailUrl={getThumbnailUrl}
          rotatePage={rotatePage}
          deletePage={deletePage}
          sessionId={sessionId}
        />
      }

      // Right Panel: Prepress & Restoration Controls
      rightLabel="Controls"
      rightIcon={<SlidersHorizontal size={13} />}
      isRightCollapsed={isRightCollapsed}
      onToggleRight={() => setIsRightCollapsed((prev) => !prev)}
      rightPanel={
        <BookRightPanel
          bleedMm={bleedMm}
          setBleedMm={setBleedMm}
          showCropMarks={showCropMarks}
          setShowCropMarks={setShowCropMarks}
          exportDpi={exportDpi}
          setExportDpi={setExportDpi}
          cleanBorders={cleanBorders}
          setCleanBorders={setCleanBorders}
          borderMarginPx={borderMarginPx}
          setBorderMarginPx={setBorderMarginPx}
          enhanceColors={enhanceColors}
          setEnhanceColors={setEnhanceColors}
          saturation={saturation}
          setSaturation={setSaturation}
          contrast={contrast}
          setContrast={setContrast}
          deskew={deskew}
          setDeskew={setDeskew}
          handleExport={exportPdf}
          isExporting={isExporting}
          sessionId={sessionId}
          totalPages={pages.length}
          onCollapse={() => setIsRightCollapsed(true)}
        />
      }
    />
  );
}

export default function BookStudioPage() {
  return (
    <Suspense fallback={null}>
      <BookStudioContent />
    </Suspense>
  );
}
