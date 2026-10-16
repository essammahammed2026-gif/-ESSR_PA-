"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, SlidersHorizontal, Download, List, LayoutGrid, RefreshCw } from "lucide-react";
import { useBookStudioState } from "@/hooks/useBookStudioState";
import { type LengthUnit, UNIT_OPTIONS } from "@/lib/units";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { BookLeftPanel } from "@/components/book-studio/BookLeftPanel";
import { BookWorkspace } from "@/components/book-studio/BookWorkspace";
import { BookRightPanel } from "@/components/book-studio/BookRightPanel";

function BookStudioContent() {
  const {
    unit, setUnit,
    selectedPageIds, setSelectedPageIds,
    eyedropperActive, setEyedropperActive,
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
    resetJob,
    initSession,
    rotatePage,
    rotatePages,
    deletePage,
    deletePages,
    reorderPages,
    duplicatePage,
    duplicatePages,
    insertBlankPage,
    copyPage,
    pastePage,
    canPaste,
    extractPage,
    exportPdf,
    getThumbnailUrl,
    history,
    currentHistoryIndex,
    canUndo,
    canRedo,
    undo,
    redo,
    jumpToStep,
    revertToOriginal,
    shortcuts,
    shortcutLabels,
  } = useBookStudioState();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
      className="book-studio"
      title="Book Studio"
      disablePanelHotkeys={true}
      headerLeftActions={
        <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg p-0.5 ml-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={viewMode === "grid" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            title="Grid Thumbnail View"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === "list"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={viewMode === "list" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
            title="Compact List View"
          >
            <List size={14} />
          </button>
        </div>
      }
      headerActions={
        <div className="flex items-center space-x-2">
          {/* Global Length Unit Dropdown */}
          <div className="flex items-center space-x-1.5 bg-[#131720] border border-[#242A38] rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500">Unit</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as LengthUnit)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              title="Global studio length unit (applies to dimensions, crop, cut lines, bleed, and properties)"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#181D27] text-slate-200">
                  {opt.label} ({opt.short})
                </option>
              ))}
            </select>
          </div>

          {/* Export PDF Button (Amber styled per concept.png) */}
          <button
            type="button"
            onClick={exportPdf}
            disabled={!sessionId || isExporting}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            title="Export Cleaned PDF Document"
          >
            {isExporting ? (
              <>
                <RefreshCw size={13} className="animate-spin text-slate-950" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Export PDF</span>
              </>
            )}
          </button>
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
          selectedPageIds={selectedPageIds}
          setSelectedPageIds={setSelectedPageIds}
          isInitializing={isInitializing}
          initSession={() => initSession()}
          resetJob={resetJob}
          rotatePage={rotatePage}
          rotatePages={rotatePages}
          deletePage={deletePage}
          deletePages={deletePages}
          reorderPages={reorderPages}
          duplicatePage={duplicatePage}
          duplicatePages={duplicatePages}
          insertBlankPage={insertBlankPage}
          copyPage={copyPage}
          pastePage={pastePage}
          canPaste={canPaste}
          extractPage={extractPage}
          getThumbnailUrl={getThumbnailUrl}
          viewMode={viewMode}
          unit={unit}
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
          sessionId={sessionId}
          unit={unit}
          showGrid={deskewModule.enabled && deskewModule.showGrid}
          gridColor={deskewModule.gridColor}
          eyedropperActive={eyedropperActive}
          onPickColor={(hex) => {
            setBleedModule((prev) => ({ ...prev, solidColor: hex }));
            setEyedropperActive(false);
          }}
          cropModule={cropModule}
          bleedModule={bleedModule}
          setCropModule={setCropModule}

          onUndo={undo}
          canUndo={canUndo}
          onRedo={redo}
          canRedo={canRedo}
          onRestoreOriginal={revertToOriginal}
          history={history}
          currentHistoryIndex={currentHistoryIndex}
          onSelectHistoryStep={jumpToStep}
          shortcuts={shortcuts}
          shortcutLabels={shortcutLabels}
        />
      }

      // Right Panel: Prepress & Restoration Controls
      rightLabel="Controls"
      rightIcon={<SlidersHorizontal size={13} />}
      isRightCollapsed={isRightCollapsed}
      onToggleRight={() => setIsRightCollapsed((prev) => !prev)}
      rightPanel={
        <BookRightPanel
          cropModule={cropModule}
          setCropModule={setCropModule}
          isDetectingCrop={isDetectingCrop}
          detectCrop={detectCrop}
          splitSpread={splitSpread}
          revertSpread={revertSpread}
          applyCrop={applyCrop}
          pages={pages}
          deskewModule={deskewModule}
          setDeskewModule={setDeskewModule}
          bleedModule={bleedModule}
          setBleedModule={setBleedModule}
          restorationModule={restorationModule}
          setRestorationModule={setRestorationModule}
          sessionId={sessionId}
          unit={unit}
          onActivateEyedropper={() => setEyedropperActive(true)}
          onCollapse={() => setIsRightCollapsed(true)}
          isDetectingAngle={isDetectingAngle}
          detectedAngle={detectedAngle}
          detectPageAngle={detectPageAngle}
          selectedPageId={selectedPageId}
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
