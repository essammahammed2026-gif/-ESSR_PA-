"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, SlidersHorizontal, Download, List, LayoutGrid, RefreshCw, ChevronDown, History } from "lucide-react";
import { useBookStudioState } from "@/hooks/useBookStudioState";
import { type LengthUnit, UNIT_OPTIONS } from "@/lib/units";
import { ExportFormat, TiffCompression } from "@/types/book_studio";
import dynamic from "next/dynamic";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { BookLeftPanel } from "@/components/book-studio/BookLeftPanel";
import { BookRightPanel } from "@/components/book-studio/BookRightPanel";
import { HistoryPopover } from "@/components/book-studio/HistoryPopover";
import { ExportProgressModal } from "@/components/book-studio/ExportProgressModal";
import { ExportConfigModal } from "@/components/book-studio/ExportConfigModal";

const BookWorkspace = dynamic(
  () => import("@/components/book-studio/BookWorkspace").then((mod) => mod.BookWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#0d1017] text-slate-500 text-xs font-mono">
        Loading canvas viewport...
      </div>
    ),
  }
);

function BookStudioContent() {
  const {
    unit, setUnit,
    cropProgress,
    deskewProgress,
    cleanupProgress,
    bleedProgress,
    restoreProgress,
    selectedPageIds, setSelectedPageIds,
    eyedropperActive, setEyedropperActive,
    straightenActive, setStraightenActive,
    maskToolActive, setMaskToolActive,
    focusedModule,
    openModule,
    intakeMode, setIntakeMode,
    fileSingle, setFileSingle,
    fileOdds, setFileOdds,
    fileEvens, setFileEvens,
    oddsOrder, setOddsOrder,
    evensOrder, setEvensOrder,
    startWith, setStartWith,
    multiFileStrategy, setMultiFileStrategy,
    reverseFileIndices,
    swapOddsEvens,
    files,
    addFiles,
    removeFile,
    moveFile,
    toggleReverseFile,
    clearFiles,
    splitPos, setSplitPos,
    sessionId,
    pages,
    selectedPageId, setSelectedPageId,
    isInitializing,
    isExporting,
    error,
    deskewModule, setDeskewModule,
    cleanupModule, setCleanupModule,
    bleedModule, setBleedModule,
    restorationModule, setRestorationModule,
    cropModule, setCropModule,
    pageCrops, focusCropPage,
    clearPageCrops,
    isDetectingCrop,
    detectCrop,
    detectAllCrops,
    splitSpread,
    revertSpread,
    revertSplitLevel,
    applyCrop,
    revertCropLevel,
    resetCrop,
    resetDeskew,
    resetCleanup,
    resetRestoration,
    resetBleed,
    removeAppliedCrop,
    removeAllAppliedCrops,
    clearAllDeskewAngles,
    applyMaskBox,
    removeMaskBox,
    clearPageMasks,
    clearAllMasks,
    applyCleanupFilters,
    setPageColorMode,
    isDetectingAngle, detectedAngle,
    detectPageAngle,
    detectAllPageAngles,
    setPageDeskewAngle,
    resetJob,
    initSession,
    loadSession,
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
    exportProgress,
    dismissExportProgress,
    getDeckThumbnailUrl,
    getThumbnailUrl,
    history,
    currentHistoryIndex,
    canUndo,
    canRedo,
    undo,
    redo,
    jumpToStep,
    recordHistoryStep,
    buildModulesSnapshot,
    shortcuts,
    shortcutLabels,
  } = useBookStudioState();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDualPage, setIsDualPage] = useState<boolean>(false);
  // Dual mode adds per-side scope toggles (left / right page); leaving dual mode drops them.
  const toggleDualPage = () => {
    const next = !isDualPage;
    setIsDualPage(next);
    setCropModule((prev) => ({
      ...prev,
      target: { ...prev.target, dualSides: next && prev.target.base === "current" ? ["left", "right"] : undefined },
    }));
    setDeskewModule((prev) => ({
      ...prev,
      scope: { ...prev.scope, dualSides: next && prev.scope.mode === "current" ? ["left", "right"] : undefined },
    }));
    setCleanupModule((prev) => ({
      ...prev,
      scope: { ...prev.scope, dualSides: next && prev.scope.mode === "current" ? ["left", "right"] : undefined },
    }));
    setRestorationModule((prev) => ({
      ...prev,
      scope: { ...prev.scope, dualSides: next && prev.scope.mode === "current" ? ["left", "right"] : undefined },
    }));
    setBleedModule((prev) => ({
      ...prev,
      scope: { ...prev.scope, dualSides: next && prev.scope.mode === "current" ? ["left", "right"] : undefined },
    }));
  };
  const [historyMenuOpen, setHistoryMenuOpen] = useState<boolean>(false);

  // Multi-format Export Dropdown & Config Modal state
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [exportConfigOpen, setExportConfigOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportDpi, setExportDpi] = useState<number>(300);
  const [exportQuality, setExportQuality] = useState<number>(95);
  const [tiffCompression, setTiffCompression] = useState<TiffCompression>("lzw");
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [exportMenuOpen]);

  const activePagesCount = Math.max(1, pages.length);

  const exportFormatLabel =
    exportFormat === "pdf"
      ? "Export PDF"
      : exportFormat === "pdf_split"
        ? "Export 1-Up PDFs"
        : `Export ${exportFormat.toUpperCase()}`;

  const handleRunExport = (fmt: ExportFormat = exportFormat) => {
    setExportMenuOpen(false);
    void exportPdf({
      format: fmt,
      dpi: exportDpi,
      quality: exportQuality,
      tiffCompression,
    });
  };

  const searchParams = useSearchParams();
  const preloadedPathRef = useRef<string | null>(null);

  // Preload file or resume session if routed from Hub or Command Center
  useEffect(() => {
    const sessionIdParam = searchParams.get("session_id");
    const filePathParam = searchParams.get("file_path");

    if (sessionIdParam && sessionIdParam !== preloadedPathRef.current && !sessionId && !isInitializing) {
      preloadedPathRef.current = sessionIdParam;
      void loadSession(sessionIdParam);
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        // ignore
      }
    } else if (filePathParam && filePathParam !== preloadedPathRef.current && !sessionId && !isInitializing) {
      preloadedPathRef.current = filePathParam;
      const nameParam = searchParams.get("name");
      setIntakeMode("single_page");
      void initSession(filePathParam, nameParam || undefined);
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        // ignore
      }
    }
  }, [searchParams, sessionId, isInitializing, setIntakeMode, initSession, loadSession]);

  return (
    <>
    <StudioLayout
      className="book-studio"
      title="Book Studio"
      breadcrumbs={
        sessionId && pages.length > 0
          ? [{ label: searchParams.get("name") || (fileSingle?.name || "Book Session") }]
          : undefined
      }
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

          {/* History Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setHistoryMenuOpen((p) => !p)}
              disabled={!sessionId || history.length === 0}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                historyMenuOpen
                  ? "bg-[#252B3B] text-white border-amber-500/50"
                  : "bg-[#131720] border-[#242A38] text-slate-300 hover:text-white hover:bg-[#181D27]"
              }`}
              title="Open Document History"
            >
              <History size={13} className="text-amber-400" />
              <span>History</span>
              {history.length > 0 && (
                <span className="text-[10px] font-mono text-slate-400">({history.length})</span>
              )}
            </button>

            <HistoryPopover
              history={history}
              currentIndex={currentHistoryIndex}
              onSelectStep={(idx) => {
                void jumpToStep(idx);
                setHistoryMenuOpen(false);
              }}
              open={historyMenuOpen}
              onClose={() => setHistoryMenuOpen(false)}
            />
          </div>

          {/* Expandable Multi-Format Export Button & Dropdown */}
          <div className="relative flex items-center" ref={exportMenuRef}>
            <div className="flex items-center rounded-lg shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setExportConfigOpen(true)}
                disabled={!sessionId || isExporting}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
                title={`Configure & Export ${exportFormatLabel}`}
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-slate-950" />
                    <span>Exporting ({exportProgress.progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>{exportFormatLabel}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setExportMenuOpen((p) => !p)}
                disabled={!sessionId || isExporting}
                className="px-1.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 border-l border-amber-700/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Choose file format"
              >
                <ChevronDown size={13} />
              </button>
            </div>

            {/* Clean Dropdown: Formats Only */}
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg bg-[#131720] border border-[#2E3648] shadow-2xl p-1 z-50 text-xs select-none">
                {([
                  { id: "pdf", label: "PDF" },
                  { id: "pdf_split", label: "PDF (Pages)" },
                  { id: "tiff", label: "TIFF" },
                  { id: "png", label: "PNG" },
                  { id: "jpeg", label: "JPEG" },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setExportFormat(item.id);
                      setExportMenuOpen(false);
                      setExportConfigOpen(true);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded text-left font-medium transition-colors cursor-pointer ${
                      exportFormat === item.id
                        ? "bg-amber-500/15 text-amber-400 font-bold"
                        : "text-slate-300 hover:bg-[#181D27] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          startWith={startWith}
          setStartWith={setStartWith}
          multiFileStrategy={multiFileStrategy}
          setMultiFileStrategy={setMultiFileStrategy}
          reverseFileIndices={reverseFileIndices}
          swapOddsEvens={swapOddsEvens}
          files={files}
          addFiles={addFiles}
          removeFile={removeFile}
          moveFile={moveFile}
          toggleReverseFile={toggleReverseFile}
          clearFiles={clearFiles}
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
          getThumbnailUrl={getDeckThumbnailUrl}
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
          focusedModule={focusedModule}
          showGrid={deskewModule.enabled && deskewModule.showGrid}
          gridColor={deskewModule.gridColor}
          eyedropperActive={eyedropperActive}
          onPickColor={(hex) => {
            if (focusedModule === "cleanup") {
              const nextCleanup = {
                ...cleanupModule,
                enabled: true,
                maskColor: hex,
                draftMaskBox: cleanupModule.draftMaskBox
                  ? { ...cleanupModule.draftMaskBox, color: hex }
                  : cleanupModule.draftMaskBox,
              };
              setCleanupModule(nextCleanup);
              recordHistoryStep(`Pick Erase Color (${hex.toUpperCase()})`, buildModulesSnapshot({ cleanupModule: nextCleanup }));
            } else {
              const nextBleed = { ...bleedModule, solidColor: hex };
              setBleedModule(nextBleed);
              recordHistoryStep(`Pick Bleed Color (${hex.toUpperCase()})`, buildModulesSnapshot({ bleedModule: nextBleed }));
            }
            setEyedropperActive(false);
          }}
          straightenActive={straightenActive}
          onToggleStraighten={() => {
            setIsRightCollapsed(false);
            openModule("deskew");
            setEyedropperActive(false);
            setMaskToolActive(false);
            setStraightenActive((prev) => !prev);
          }}
          onApplyStraightenAngle={(deltaAngle) => {
            if (selectedPageId) {
              const activePage = pages.find((p) => p.id === selectedPageId);
              const baseAngle =
                activePage?.deskew_angle !== undefined
                  ? activePage.deskew_angle
                  : detectedAngle !== null && detectedAngle !== undefined
                    ? detectedAngle
                    : deskewModule.angle;
              setPageDeskewAngle(selectedPageId, Math.round((baseAngle + deltaAngle) * 100) / 100);
            }
            setStraightenActive(false);
          }}
          maskToolActive={maskToolActive}
          onToggleMaskTool={() => {
            setIsRightCollapsed(false);
            openModule("cleanup");
            setStraightenActive(false);
            setEyedropperActive(false);
            setMaskToolActive((prev) => !prev);
          }}
          onToggleCropTool={() => {
            setIsRightCollapsed(false);
            openModule("crop");
            setCropModule((prev) => ({ ...prev, enabled: !prev.enabled }));
          }}
          onApplyMaskBox={(box, side) => {
            const currentIdx = pages.findIndex((p) => p.id === selectedPageId);
            const pairStartIdx = currentIdx >= 0 ? Math.floor(currentIdx / 2) * 2 : 0;
            const leftPage = pages[pairStartIdx];
            const rightPage = pages[pairStartIdx + 1];
            const targetPage = side === "secondary" ? rightPage : leftPage;
            if (targetPage) {
              setSelectedPageId(targetPage.id);
            }
            const isDualActive = isDualPage && Boolean(rightPage);
            const isDualLinked = isDualActive && (cleanupModule.scope.dualSides?.length ?? 2) >= 2;
            const nextDualSides = (isDualActive && !isDualLinked)
              ? (side === "secondary" ? ["right" as const] : ["left" as const])
              : cleanupModule.scope.dualSides;

            const newDraftMask = {
              id: `m_${Date.now().toString(36)}`,
              ...box,
              color: cleanupModule.maskColor || "#ffffff",
            };

            const nextPageDrafts = { ...(cleanupModule.pageDraftMasks || {}) };
            if (!isDualActive || cleanupModule.scope.mode !== "current" || isDualLinked) {
              if (leftPage) nextPageDrafts[leftPage.id] = newDraftMask;
              if (isDualActive && rightPage) nextPageDrafts[rightPage.id] = newDraftMask;
            } else if (targetPage) {
              nextPageDrafts[targetPage.id] = newDraftMask;
            }
            const nextCleanup = {
              ...cleanupModule,
              draftMaskBox: newDraftMask,
              pageDraftMasks: nextPageDrafts,
              scope: {
                ...cleanupModule.scope,
                dualSides: nextDualSides,
              },
            };
            setCleanupModule(nextCleanup);
            recordHistoryStep("Draw Erase Box", buildModulesSnapshot({ cleanupModule: nextCleanup }));
            setMaskToolActive(false);
          }}
          onRemoveMaskBox={(maskId) => {
            void removeMaskBox(maskId);
          }}
          onToggleGrid={() => {
            setDeskewModule((prev) => ({ ...prev, enabled: true, showGrid: !prev.showGrid }));
          }}
          cropModule={cropModule}
          isDualPage={isDualPage}
          onToggleDualPage={toggleDualPage}
          pageCrops={pageCrops}
          focusCropPage={focusCropPage}
          bleedModule={bleedModule}
          cleanupModule={cleanupModule}
          deskewModule={deskewModule}
          restorationModule={restorationModule}
          setCropModule={setCropModule}
          setCleanupModule={setCleanupModule}
          setDeskewModule={setDeskewModule}
          setRestorationModule={setRestorationModule}
          setBleedModule={setBleedModule}
          onCommitBoxDrag={(label) => recordHistoryStep(label)}
          onUndo={undo}
          canUndo={canUndo}
          onRedo={redo}
          canRedo={canRedo}
          shortcuts={shortcuts}
          shortcutLabels={shortcutLabels}
          isDeckOpen={!isLeftCollapsed}
          onToggleDeck={() => setIsLeftCollapsed((prev) => !prev)}
        />
      }

      // Right Panel: Prepress & Restoration Controls
      rightLabel="Controls"
      rightIcon={<SlidersHorizontal size={13} />}
      rightWidthClass="w-full lg:w-[325px] xl:w-[345px]"
      isRightCollapsed={isRightCollapsed}
      onToggleRight={() => setIsRightCollapsed((prev) => !prev)}
      rightPanel={
        <BookRightPanel
          shortcutLabels={shortcutLabels}
          cropModule={cropModule}
          isDualPage={isDualPage}
          focusCropPage={focusCropPage}
          setCropModule={setCropModule}
          isDetectingCrop={isDetectingCrop}
          detectCrop={detectCrop}
          detectAllCrops={detectAllCrops}
          pageCropsCount={Object.keys(pageCrops).length}
          hasActivePageDraftCrop={Boolean(selectedPageId && pageCrops[selectedPageId])}
          clearPageCrops={clearPageCrops}
          splitSpread={splitSpread}
          revertSpread={revertSpread}
          revertSplitLevel={revertSplitLevel}
          applyCrop={applyCrop}
          revertCropLevel={revertCropLevel}
          resetCrop={resetCrop}
          resetDeskew={resetDeskew}
          resetCleanup={resetCleanup}
          resetRestoration={resetRestoration}
          resetBleed={resetBleed}
          removeAppliedCrop={removeAppliedCrop}
          removeAllAppliedCrops={removeAllAppliedCrops}
          pages={pages}
          deskewModule={deskewModule}
          setDeskewModule={setDeskewModule}
          clearAllDeskewAngles={clearAllDeskewAngles}
          cleanupModule={cleanupModule}
          setCleanupModule={setCleanupModule}
          bleedModule={bleedModule}
          setBleedModule={setBleedModule}
          restorationModule={restorationModule}
          setRestorationModule={setRestorationModule}
          maskToolActive={maskToolActive}
          onToggleMaskTool={() => {
            setStraightenActive(false);
            setEyedropperActive(false);
            setMaskToolActive((prev) => !prev);
          }}
          onActivateMaskEyedropper={() => {
            openModule("cleanup");
            setStraightenActive(false);
            setMaskToolActive(false);
            setEyedropperActive(true);
          }}
          onClearPageMasks={(ids) => void clearPageMasks(ids)}
          onClearAllMasks={() => void clearAllMasks()}
          applyMaskBox={applyMaskBox}
          removeMaskBox={removeMaskBox}
          applyCleanupFilters={applyCleanupFilters}
          pageColorMode={
            selectedPageId
              ? pages.find((p) => p.id === selectedPageId)?.color_mode ?? null
              : null
          }
          onSetPageColorMode={(mode, targetIds, clearAll) => {
            const ids = targetIds ?? (selectedPageIds.length > 1 ? selectedPageIds : undefined);
            void setPageColorMode(mode, ids, clearAll);
          }}
          focusedModule={focusedModule}
          onFocusModule={openModule}
          sessionId={sessionId}
          unit={unit}
          onActivateEyedropper={() => {
            setStraightenActive(false);
            setMaskToolActive(false);
            setEyedropperActive(true);
          }}
          onCollapse={() => setIsRightCollapsed(true)}
          isDetectingAngle={isDetectingAngle}
          detectedAngle={detectedAngle}
          detectPageAngle={detectPageAngle}
          detectAllPageAngles={detectAllPageAngles}
          pageDeskewAngle={
            selectedPageId
              ? pages.find((p) => p.id === selectedPageId)?.deskew_angle ?? null
              : null
          }
          onChangePageAngle={(angle) => {
            if (selectedPageId) {
              setPageDeskewAngle(selectedPageId, angle);
            }
          }}
          straightenActive={straightenActive}
          onToggleStraighten={() => {
            setEyedropperActive(false);
            setMaskToolActive(false);
            setStraightenActive((prev) => !prev);
          }}
          deskewedPagesCount={pages.filter((p) => p.deskew_angle !== undefined && Math.abs(p.deskew_angle) > 0.01).length}
          cropProgress={cropProgress}
          deskewProgress={deskewProgress}
          cleanupProgress={cleanupProgress}
          bleedProgress={bleedProgress}
          restoreProgress={restoreProgress}
          selectedPageId={selectedPageId}
          onSelectPageId={setSelectedPageId}
          onRecordDeskewHistory={(label, nextDeskew) =>
            recordHistoryStep(label, buildModulesSnapshot({ deskewModule: nextDeskew }))
          }
          onRecordBleedHistory={(label, nextBleed) =>
            recordHistoryStep(label, buildModulesSnapshot({ bleedModule: nextBleed }))
          }
          onRecordRestorationHistory={(label, nextRestore) =>
            recordHistoryStep(label, buildModulesSnapshot({ restorationModule: nextRestore }))
          }
        />
      }
    />
    <ExportConfigModal
      isOpen={exportConfigOpen}
      onClose={() => setExportConfigOpen(false)}
      format={exportFormat}
      onFormatChange={(fmt) => setExportFormat(fmt)}
      dpi={exportDpi}
      onDpiChange={(d) => {
        setExportDpi(d);
        setBleedModule((prev) => ({ ...prev, exportDpi: d }));
      }}
      quality={exportQuality}
      onQualityChange={setExportQuality}
      tiffCompression={tiffCompression}
      onTiffCompressionChange={setTiffCompression}
      onExport={() => {
        setExportConfigOpen(false);
        handleRunExport(exportFormat);
      }}
      pagesCount={activePagesCount}
      isExporting={isExporting}
    />
    <ExportProgressModal
      progress={exportProgress}
      onDismiss={dismissExportProgress}
    />
    </>
  );
}

export default function BookStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#12151B] text-slate-400 text-xs font-mono">
          Loading Book Studio...
        </div>
      }
    >
      <BookStudioContent />
    </Suspense>
  );
}
