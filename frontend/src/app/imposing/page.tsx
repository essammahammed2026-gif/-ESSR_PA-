"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { useImpositionStudio } from "@/hooks/useImpositionStudio";
import { UNIT_OPTIONS, LengthUnit } from "@/lib/units";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { LeftAssetPanel } from "@/components/imposing/LeftAssetPanel";
import { RightControlPanel } from "@/components/imposing/RightControlPanel";

const PreviewViewport = dynamic(
  () =>
    import("@/components/imposing/PreviewViewport").then(
      (mod) => mod.PreviewViewport,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[var(--surface-canvas,#090C12)] text-[var(--text-muted,#64748B)] text-xs font-mono">
        Loading imposing canvas...
      </div>
    ),
  },
);

function ImposingStudioContent() {
  const {
    sessionId,
    sessionTitle,
    isSaving,
    initSession,
    loadSession,
    jobMode,
    setJobMode,
    items,
    setItems,
    pages,
    setPages,
    deckViewMode,
    setDeckViewMode,
    selectedPageIds,
    toggleSelectPage,
    selectAllPages,
    deselectAllPages,
    invertSelectedPages,
    batchRotateSelected,
    batchToggleDeleteSelected,
    batchDuplicateSelected,
    reorderPages,
    rotatePage,
    toggleDeletePage,
    duplicatePage,
    clearAllPages,
    unit,
    setUnit,
    sheetW,
    setSheetW,
    sheetH,
    setSheetH,
    sheetPreset,
    setSheetPreset,
    margin,
    setMargin,
    gap,
    setGap,
    drawBorder,
    borderColor,
    cropMarks,
    regMarks,
    rows,
    setRows,
    cols,
    setCols,
    isUploading,
    isPreviewing,
    isExporting,
    previewData,
    currentPage,
    setCurrentPage,
    error,
    handleFileUpload,
    handlePreview,
    handleExport,
  } = useImpositionStudio();

  const searchParams = useSearchParams();
  const loadedSessionRef = useRef<string | null>(null);
  const preloadedFileIdRef = useRef<string | null>(null);

  // Preload file or load session from SQLite WAL
  useEffect(() => {
    const sessionIdParam = searchParams.get("session_id");
    const fileIdParam = searchParams.get("file_id");
    const nameParam = searchParams.get("name") || "Preloaded Artwork";
    const wParam = parseFloat(searchParams.get("w") || "0");
    const hParam = parseFloat(searchParams.get("h") || "0");
    const pageCountParam = parseInt(searchParams.get("page_count") || "1", 10);
    const modeParam = searchParams.get("job_mode") as "book" | "gang" | null;

    if (sessionIdParam && sessionIdParam !== loadedSessionRef.current) {
      loadedSessionRef.current = sessionIdParam;
      loadSession(sessionIdParam);
    } else if (fileIdParam && fileIdParam !== preloadedFileIdRef.current) {
      preloadedFileIdRef.current = fileIdParam;
      initSession({
        fileId: fileIdParam,
        name: nameParam,
        jobMode: modeParam || (pageCountParam > 1 ? "book" : "gang"),
        sheetW: wParam > 0 ? undefined : 320,
        sheetH: hParam > 0 ? undefined : 450,
      });
    }
  }, [searchParams, loadSession, initSession]);

  const bookStep = 2;
  const [isDeckOpen, setIsDeckOpen] = useState<boolean>(true);
  const [isRightOpen, setIsRightOpen] = useState<boolean>(true);

  const displayTitle = sessionTitle || (items.length > 0 ? items[0].name : "Imposing Studio");

  return (
    <StudioLayout
      title="Imposing Studio"
      breadcrumbs={
        displayTitle !== "Imposing Studio"
          ? [{ label: displayTitle }]
          : []
      }
      statusBadge={
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[var(--text-muted,#64748B)] font-mono">
            {Math.round(sheetW)}×{Math.round(sheetH)} {unit}
          </span>
          <span className="text-[var(--border-subtle,#242C3D)]">•</span>
          <span className="text-[var(--app-accent,#F59E0B)] font-semibold uppercase text-[11px]">
            {jobMode}
          </span>
          {sessionId && (
            <>
              <span className="text-[var(--border-subtle,#242C3D)]">•</span>
              <span className="text-[10px] text-[var(--text-muted,#64748B)]">
                {isSaving ? "Saving..." : "Saved"}
              </span>
            </>
          )}
        </div>
      }
      headerActions={
        <div className="flex items-center space-x-2 select-none">
          {/* Global Length Unit Selector (Matches Book Studio) */}
          <div className="flex items-center bg-[var(--surface-inset,#11151E)] p-0.5 rounded-lg border border-[var(--border-subtle,#242C3D)] text-xs">
            {UNIT_OPTIONS.map((u) => {
              const active = unit === u.value;
              return (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUnit(u.value)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    active
                      ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] font-bold shadow-xs"
                      : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
                  }`}
                  title={`Set length unit to ${u.label}`}
                >
                  {u.short}
                </button>
              );
            })}
          </div>

          {/* Primary Export Button (Matches Book Studio) */}
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[var(--app-accent,#F59E0B)] hover:brightness-110 disabled:bg-[var(--surface-card,#181D27)] text-[var(--app-accent-fg,#0F172A)] disabled:text-[var(--text-muted,#64748B)] text-xs font-bold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
            title="Export Print-Ready PDF"
          >
            {isExporting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Export Print PDF</span>
              </>
            )}
          </button>
        </div>
      }
      leftLabel="Deck"
      isLeftCollapsed={!isDeckOpen}
      onToggleLeft={() => setIsDeckOpen((prev) => !prev)}
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
          deckViewMode={deckViewMode}
          setDeckViewMode={setDeckViewMode}
          selectedPageIds={selectedPageIds}
          toggleSelectPage={toggleSelectPage}
          selectAllPages={selectAllPages}
          deselectAllPages={deselectAllPages}
          invertSelectedPages={invertSelectedPages}
          batchRotateSelected={batchRotateSelected}
          batchToggleDeleteSelected={batchToggleDeleteSelected}
          batchDuplicateSelected={batchDuplicateSelected}
          unit={unit}
          onCollapse={() => setIsDeckOpen(false)}
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
          isDeckOpen={isDeckOpen}
          onToggleDeck={() => setIsDeckOpen((prev) => !prev)}
          unit={unit}
        />
      }
      rightLabel="Tools"
      isRightCollapsed={!isRightOpen}
      onToggleRight={() => setIsRightOpen((prev) => !prev)}
      rightPanel={
        <RightControlPanel
          jobMode={jobMode}
          setJobMode={setJobMode}
          items={items}
          pages={pages}
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
          rows={rows}
          setRows={setRows}
          cols={cols}
          setCols={setCols}
          batchRotateSelected={batchRotateSelected}
          selectedPageIds={selectedPageIds}
          rotatePage={rotatePage}
          onCollapse={() => setIsRightOpen(false)}
        />
      }
    />
  );
}

export default function ImposingStudio() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[var(--surface-app,#0E1117)] text-[var(--text-muted,#64748B)] text-xs font-mono">
          Loading Imposing Studio...
        </div>
      }
    >
      <ImposingStudioContent />
    </Suspense>
  );
}
