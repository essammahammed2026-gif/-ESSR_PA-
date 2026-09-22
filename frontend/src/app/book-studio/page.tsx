"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, 
  RotateCw, 
  Trash2, 
  Download, 
  Settings2, 
  Sparkles, 
  Layers, 
  FileText, 
  RefreshCw, 
  Eye, 
  Check, 
  Sliders, 
  ArrowUpDown,
  BookOpen
} from "lucide-react";

interface BookPage {
  id: string;
  source: string;
  doc_idx: number;
  half: string;
  split_pos: number;
  rotation: number;
  label: string;
}

export default function BookStudioPage() {
  // Mode selection
  const [scanMode, setScanMode] = useState<"dual" | "single">("dual");
  const [isSpread, setIsSpread] = useState<boolean>(false);
  const [oddsOrder, setOddsOrder] = useState<"forward" | "reverse">("forward");
  const [evensOrder, setEvensOrder] = useState<"reverse" | "forward">("reverse");
  const [splitPos, setSplitPos] = useState<number>(0.5);

  // Files
  const [fileOdds, setFileOdds] = useState<File | null>(null);
  const [fileEvens, setFileEvens] = useState<File | null>(null);
  const [fileSingle, setFileSingle] = useState<File | null>(null);

  // Studio Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Processing settings
  const [previewCleaned, setPreviewCleaned] = useState<boolean>(true);
  const [cleanBorders, setCleanBorders] = useState<boolean>(true);
  const [borderMarginPx, setBorderMarginPx] = useState<number>(15);
  const [borderThreshold, setBorderThreshold] = useState<number>(210);
  const [enhanceColors, setEnhanceColors] = useState<boolean>(true);
  const [saturation, setSaturation] = useState<number>(1.30);
  const [contrast, setContrast] = useState<number>(1.10);
  const [deskew, setDeskew] = useState<boolean>(false);
  const [bleedMm, setBleedMm] = useState<number>(3.0);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [exportDpi, setExportDpi] = useState<number>(200);

  // Drag-and-drop / reordering
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleInitSession = async () => {
    setIsInitializing(true);
    try {
      const formData = new FormData();
      formData.append("mode", scanMode);
      formData.append("is_spread", String(isSpread));
      formData.append("odds_order", oddsOrder);
      formData.append("evens_order", evensOrder);
      formData.append("spread_split_pos", String(splitPos));

      if (scanMode === "dual") {
        if (!fileOdds || !fileEvens) {
          alert("Please select both Odds and Evens PDF files.");
          setIsInitializing(false);
          return;
        }
        formData.append("file_odds", fileOdds);
        formData.append("file_evens", fileEvens);
      } else {
        if (!fileSingle) {
          alert("Please select the PDF file.");
          setIsInitializing(false);
          return;
        }
        formData.append("file_single", fileSingle);
      }

      const res = await fetch("http://localhost:8000/api/book-scan/init-session", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to initialize session");
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setPages(data.pages);
      if (data.pages.length > 0) {
        setSelectedPageId(data.pages[0].id);
      }
    } catch (e: any) {
      alert(`Initialization error: ${e.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRotate = async (pageId: string, delta: number = 90) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/book-scan/rotate/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, rotation_delta: delta })
      });
      if (res.ok) {
        const data = await res.json();
        setPages(pages.map(p => p.id === pageId ? { ...p, rotation: data.page.rotation } : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/book-scan/page/${sessionId}/${pageId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const remaining = pages.filter(p => p.id !== pageId);
        setPages(remaining);
        if (selectedPageId === pageId) {
          setSelectedPageId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx || !sessionId) return;
    const reordered = [...pages];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setPages(reordered);
    setDraggedIdx(null);

    // Persist reorder to backend
    try {
      await fetch(`http://localhost:8000/api/book-scan/reorder/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_ids: reordered.map(p => p.id) })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = async () => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/book-scan/export/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bleed_mm: bleedMm,
          show_crop_marks: showCropMarks,
          dpi: exportDpi,
          clean_borders: cleanBorders,
          border_margin_px: borderMarginPx,
          border_threshold: borderThreshold,
          enhance_colors: enhanceColors,
          saturation: saturation,
          contrast: contrast,
          deskew: deskew,
          sharpen: true
        })
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cleaned_book_${bleedMm}mm_bleed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getThumbUrl = (pageId: string, clean: boolean) => {
    if (!sessionId) return "";
    return `http://localhost:8000/api/book-scan/page-thumbnail/${sessionId}/${pageId}?preview_clean=${clean}&clean_borders=${cleanBorders}&border_margin_px=${borderMarginPx}&border_threshold=${borderThreshold}&enhance_colors=${enhanceColors}&saturation=${saturation}&contrast=${contrast}&deskew=${deskew}&t=${Date.now()}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-amber-500" size={32} />
            Scanned Book Studio
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Collate odd/even passes, split double-page spreads, whiten & deskew pages, and add 3mm bleed with crop marks.
          </p>
        </div>

        {sessionId && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSessionId(null); setPages([]); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
            >
              New Job
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {isExporting ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
              {isExporting ? "Rendering PDF..." : "Export Print-Ready PDF"}
            </button>
          </div>
        )}
      </div>

      {/* Step 1: Upload & Collation Configuration */}
      {!sessionId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings2 size={22} className="text-blue-500" />
            1. Book Scan Ingestion & Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode selection */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                Scan Feed Workflow
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScanMode("dual")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    scanMode === "dual"
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="font-semibold block text-sm">Dual Pass (Odds + Evens)</span>
                  <span className="text-xs text-gray-500 mt-1 block">
                    Two separate PDFs: one for odd side, one for even side
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScanMode("single")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    scanMode === "single"
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="font-semibold block text-sm">Single Combined PDF</span>
                  <span className="text-xs text-gray-500 mt-1 block">
                    Normal pre-merged or single-pass duplex scan
                  </span>
                </button>
              </div>

              {/* Spread vs Single page option */}
              <div className="pt-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                  Scanned Page Geometry
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="spread_type"
                      checked={!isSpread}
                      onChange={() => setIsSpread(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Treat As-Is (No Page Splitting)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="spread_type"
                      checked={isSpread}
                      onChange={() => setIsSpread(true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Split Center Seam (Spread Mode)</span>
                  </label>
                </div>
              </div>

              {/* Feed directions */}
              {scanMode === "dual" && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Odds Feed Order</label>
                    <select
                      value={oddsOrder}
                      onChange={(e: any) => setOddsOrder(e.target.value)}
                      className="w-full text-sm border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-2"
                    >
                      <option value="forward">Forward (1, 3, 5...)</option>
                      <option value="reverse">Reverse (...5, 3, 1)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Evens Feed Order</label>
                    <select
                      value={evensOrder}
                      onChange={(e: any) => setEvensOrder(e.target.value)}
                      className="w-full text-sm border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-2"
                    >
                      <option value="reverse">Reverse (...6, 4, 2) [ADF Flip]</option>
                      <option value="forward">Forward (2, 4, 6...)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* File Upload zone */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                Select Scan PDF(s)
              </label>

              {scanMode === "dual" ? (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      id="file_odds"
                      className="hidden"
                      onChange={(e) => setFileOdds(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="file_odds" className="cursor-pointer block">
                      <FileText className="mx-auto text-blue-500 mb-1" size={28} />
                      <span className="text-sm font-medium block">
                        {fileOdds ? fileOdds.name : "Choose Odds PDF (e.g. 1a (2).pdf)"}
                      </span>
                      <span className="text-xs text-gray-400">Click to browse</span>
                    </label>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      id="file_evens"
                      className="hidden"
                      onChange={(e) => setFileEvens(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="file_evens" className="cursor-pointer block">
                      <FileText className="mx-auto text-purple-500 mb-1" size={28} />
                      <span className="text-sm font-medium block">
                        {fileEvens ? fileEvens.name : "Choose Evens PDF (e.g. 1a (3).pdf)"}
                      </span>
                      <span className="text-xs text-gray-400">Click to browse</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    id="file_single"
                    className="hidden"
                    onChange={(e) => setFileSingle(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="file_single" className="cursor-pointer block">
                    <FileText className="mx-auto text-blue-500 mb-2" size={36} />
                    <span className="text-sm font-medium block">
                      {fileSingle ? fileSingle.name : "Choose Single Scanned PDF"}
                    </span>
                    <span className="text-xs text-gray-400">Click to browse</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleInitSession}
              disabled={isInitializing}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {isInitializing ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
              {isInitializing ? "Collating and Splitting..." : "Open in Studio"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Interactive Studio */}
      {sessionId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left / Main Workspace: Thumbnails & Page Reordering */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Total Pages: {pages.length}</span>
                <span className="text-xs text-gray-400">• Drag cards to re-order • Click to preview</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewCleaned}
                    onChange={(e) => setPreviewCleaned(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-medium text-xs">Live Cleaned Preview</span>
                </label>
              </div>
            </div>

            {/* Thumbnail grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {pages.map((p, idx) => {
                const isSelected = p.id === selectedPageId;
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    onClick={() => setSelectedPageId(p.id)}
                    className={`group relative bg-white dark:bg-gray-800 rounded-lg border-2 p-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-900 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={getThumbUrl(p.id, previewCleaned)}
                        alt={p.label}
                        className="object-contain w-full h-full pointer-events-none"
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                      />
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] font-medium truncate text-gray-600 dark:text-gray-300">
                        {p.label}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Rotate 90°"
                          onClick={(e) => { e.stopPropagation(); handleRotate(p.id, 90); }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-blue-500"
                        >
                          <RotateCw size={12} />
                        </button>
                        <button
                          type="button"
                          title="Delete Page"
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Page Large Inspector */}
            {selectedPageId && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <Eye size={18} className="text-blue-500" />
                    High-Res Page Inspector (Page #{pages.findIndex(p => p.id === selectedPageId) + 1})
                  </h3>
                  <button
                    onClick={() => handleRotate(selectedPageId, 90)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded font-medium"
                  >
                    <RotateCw size={14} />
                    Rotate 90° Clockwise
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Original Extracted Scan</span>
                    <div className="h-[450px] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center p-2 border dark:border-gray-700">
                      <img
                        src={getThumbUrl(selectedPageId, false)}
                        alt="Original scan"
                        className="object-contain h-full w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-green-600 uppercase flex items-center gap-1">
                      <Sparkles size={14} />
                      Cleaned with 3mm Bleed & Crop Marks
                    </span>
                    <div className="h-[450px] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center p-2 border border-green-500/30">
                      <img
                        src={getThumbUrl(selectedPageId, true)}
                        alt="Cleaned scan"
                        className="object-contain h-full w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Cleanup & Bleed Controls */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-6">
              <h3 className="font-semibold text-base flex items-center gap-2 pb-3 border-b dark:border-gray-700">
                <Sliders size={18} className="text-amber-500" />
                Cleanup & Bleed Controls
              </h3>

              {/* Bleed Settings */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Print Bleed & Marks
                </label>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>Bleed Width:</span>
                    <span className="font-bold text-blue-600">{bleedMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={bleedMm}
                    onChange={(e) => setBleedMm(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    Mirrors page edge pixels for bleed. (Standard: 3mm)
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs pt-1">
                  <input
                    type="checkbox"
                    checked={showCropMarks}
                    onChange={(e) => setShowCropMarks(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-medium">Draw Vector Crop / Cut Marks</span>
                </label>
              </div>

              {/* Computer Vision Cleanup */}
              <div className="space-y-4 pt-3 border-t dark:border-gray-700">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Color Restoration & Minimal Border Clean
                </label>

                {/* Minimal Border Cleaning */}
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={cleanBorders}
                      onChange={(e) => setCleanBorders(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold">Minimal Border Cleanup (Outer Edges Only)</span>
                  </label>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Cleans dirty scanner edges, glass boundary shadows, and feed marks without touching page content.
                  </p>

                  {cleanBorders && (
                    <div className="pt-2 space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Edge Margin Depth:</span>
                        <span className="font-bold text-blue-600">{borderMarginPx} px</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="40"
                        step="1"
                        value={borderMarginPx}
                        onChange={(e) => setBorderMarginPx(parseInt(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  )}
                </div>

                {/* Color Richness Boost */}
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={enhanceColors}
                      onChange={(e) => setEnhanceColors(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold">Restore Washed-Out Colors</span>
                  </label>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Eliminates scanner haze, deepens washed blacks, and enriches faded color saturation.
                  </p>

                  {enhanceColors && (
                    <div className="pt-2 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span>Color Saturation:</span>
                          <span className="font-bold text-blue-600">{Math.round((saturation - 1.0) * 100)}% Boost</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="1.8"
                          step="0.05"
                          value={saturation}
                          onChange={(e) => setSaturation(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span>Contrast & Black Depth:</span>
                          <span className="font-bold text-blue-600">{contrast}x</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="1.4"
                          step="0.02"
                          value={contrast}
                          onChange={(e) => setContrast(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Deskew */}
                <label className="flex items-center gap-2 cursor-pointer text-xs pt-1">
                  <input
                    type="checkbox"
                    checked={deskew}
                    onChange={(e) => setDeskew(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-medium">Optional: Auto-Deskew Minor Tilt</span>
                </label>
              </div>

              {/* Export Quality */}
              <div className="space-y-3 pt-3 border-t dark:border-gray-700">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Export Quality (DPI)
                </label>
                <select
                  value={exportDpi}
                  onChange={(e: any) => setExportDpi(parseInt(e.target.value))}
                  className="w-full text-xs border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-2"
                >
                  <option value="150">150 DPI (Fast / Draft)</option>
                  <option value="200">200 DPI (Balanced Press Quality)</option>
                  <option value="300">300 DPI (High-End Production Print)</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isExporting ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                {isExporting ? "Compiling Book PDF..." : "Export Book PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
