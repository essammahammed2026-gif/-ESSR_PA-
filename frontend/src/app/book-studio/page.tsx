"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, SlidersHorizontal, Download, List, LayoutGrid, RefreshCw, ChevronDown, FileText, FileArchive, Image as ImageIcon } from "lucide-react";
import { useBookStudioState } from "@/hooks/useBookStudioState";
import { type LengthUnit, UNIT_OPTIONS } from "@/lib/units";
import { ExportFormat, TiffCompression } from "@/types/book_studio";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { BookLeftPanel } from "@/components/book-studio/BookLeftPanel";
import { BookWorkspace } from "@/components/book-studio/BookWorkspace";
import { BookRightPanel } from "@/components/book-studio/BookRightPanel";
import { ExportProgressModal } from "@/components/book-studio/ExportProgressModal";

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
    pageCrops,
    clearPageCrops,
    isDetectingCrop,
    detectCrop,
    detectAllCrops,
    splitSpread,
    revertSpread,
    applyCrop,
    removeAppliedCrop,
    clearAllDeskewAngles,
    applyMaskBox,
    removeMaskBox,
    clearPageMasks,
    clearAllMasks,
    setPageColorMode,
    isDetectingAngle, detectedAngle,
    detectPageAngle,
    detectAllPageAngles,
    setPageDeskewAngle,
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
    exportProgress,
    dismissExportProgress,
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

  // Multi-format Export Dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportDpi, setExportDpi] = useState<number>(300);
  const [exportQuality, setExportQuality] = useState<number>(92);
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

  const exportFormatLabel =
    exportFormat === "pdf"
      ? "Export PDF"
      : exportFormat === "pdf_split"
        ? "Export PDF Pages (.zip)"
        : `Export ${exportFormat.toUpperCase()} (.zip)`;

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

  // Preload file if routed from Hub or Command Center
  useEffect(() => {
    const filePathParam = searchParams.get("file_path");
    if (filePathParam && !sessionId && !isInitializing) {
      setIntakeMode("single_page");
      initSession(filePathParam);
    }
  }, [searchParams, sessionId, isInitializing, setIntakeMode, initSession]);

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

          {/* Expandable Multi-Format Export Button & Dropdown */}
          <div className="relative flex items-center" ref={exportMenuRef}>
            <div className="flex items-center rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => handleRunExport(exportFormat)}
                disabled={!sessionId || isExporting}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
                title={`Run ${exportFormatLabel} at ${exportDpi} DPI`}
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
                title="Choose export format (Merged PDF, Separate PDF Pages, JPEG, PNG, TIFF) and quality"
              >
                <ChevronDown size={13} />
              </button>
            </div>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-[var(--surface-panel,#131720)] border border-[var(--border-strong,#2E3648)] shadow-2xl p-3 z-50 space-y-3 text-xs select-none">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Export Format
                  </span>
                  <div className="space-y-1">
                    {([
                      { id: "pdf", label: "Merged Document (.pdf)", desc: "Single print-ready PDF with TrimBox & Bleed", icon: <FileText size={13} /> },
                      { id: "pdf_split", label: "Separate PDF Pages (.zip)", desc: "Individual 1-page PDFs packaged in a ZIP", icon: <FileArchive size={13} /> },
                      { id: "jpeg", label: "JPEG Images (.zip)", desc: "High-speed compressed images with quality control", icon: <ImageIcon size={13} /> },
                      { id: "png", label: "Lossless PNG Images (.zip)", desc: "Crisp lossless RGB/Grayscale page images", icon: <ImageIcon size={13} /> },
                      { id: "tiff", label: "Archival TIFF Images (.zip)", desc: "Prepress TIFF images with LZW/Deflate compression", icon: <ImageIcon size={13} /> },
                    ] as const).map((item) => {
                      const active = exportFormat === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setExportFormat(item.id)}
                          className={`w-full flex items-start space-x-2 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                            active
                              ? "bg-amber-500/15 border-amber-500/50 text-[var(--text-primary,#fff)]"
                              : "bg-[var(--surface-card,#181D27)] border-[var(--border-subtle,#242A38)] text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 text-amber-400">{item.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[11px]">{item.label}</div>
                            <div className="text-[9px] text-slate-400 truncate">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Output DPI */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Resolution (DPI)
                  </span>
                  <div className="grid grid-cols-4 gap-1 p-0.5 bg-[var(--surface-card,#181D27)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[10px]">
                    {[150, 200, 300, 400].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setExportDpi(d);
                          setBleedModule((prev) => ({ ...prev, exportDpi: d }));
                        }}
                        className={`py-1 rounded font-mono font-semibold cursor-pointer ${
                          exportDpi === d ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality Slider for PDF / JPEG / PNG */}
                {exportFormat !== "tiff" ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 font-semibold">
                        {exportFormat === "png" ? "Compression Level" : "Image Quality"}
                      </span>
                      <span className="font-mono font-bold text-amber-400">{exportQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="100"
                      step="2"
                      value={exportQuality}
                      onChange={(e) => setExportQuality(Number(e.target.value))}
                      className="w-full h-1 accent-amber-500 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      TIFF Compression
                    </span>
                    <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--surface-card,#181D27)] rounded-lg border border-[var(--border-subtle,#242A38)] text-[10px]">
                      {(["lzw", "deflate", "none"] as TiffCompression[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTiffCompression(c)}
                          className={`py-1 rounded uppercase font-mono font-semibold cursor-pointer ${
                            tiffCompression === c ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleRunExport(exportFormat)}
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download {exportFormatLabel}</span>
                </button>
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
            if (focusedModule === "cleanup") {
              setCleanupModule((prev) => ({ ...prev, enabled: true, maskColor: hex }));
            } else {
              setBleedModule((prev) => ({ ...prev, solidColor: hex }));
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
          onApplyMaskBox={(box) => {
            void applyMaskBox(box);
          }}
          onRemoveMaskBox={(maskId) => {
            void removeMaskBox(maskId);
          }}
          onToggleGrid={() => {
            setDeskewModule((prev) => ({ ...prev, enabled: true, showGrid: !prev.showGrid }));
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
          detectAllCrops={detectAllCrops}
          pageCropsCount={Object.keys(pageCrops).length}
          hasActivePageDraftCrop={Boolean(selectedPageId && pageCrops[selectedPageId])}
          clearPageCrops={clearPageCrops}
          splitSpread={splitSpread}
          revertSpread={revertSpread}
          applyCrop={applyCrop}
          removeAppliedCrop={removeAppliedCrop}
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
          onClearPageMasks={() => void clearPageMasks()}
          onClearAllMasks={() => void clearAllMasks()}
          pageColorMode={
            selectedPageId
              ? pages.find((p) => p.id === selectedPageId)?.color_mode ?? null
              : null
          }
          onSetPageColorMode={(mode, clearAll) => {
            void setPageColorMode(mode, selectedPageIds.length > 1 ? selectedPageIds : undefined, clearAll);
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
        />
      }
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
    <Suspense fallback={null}>
      <BookStudioContent />
    </Suspense>
  );
}
