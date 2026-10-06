"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Upload, 
  Download, 
  Loader2, 
  Trash2, 
  Link as LinkIcon, 
  Unlink, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  ArrowRightLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
  LayoutDashboard,
    Scissors,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Settings2,
  Eye,
  EyeOff
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

import { NumberControl, toUnit, toMm } from "@/components/imposing/controls";
import { ImposingItem, ImpositionPreviewResponse } from "@/types/prepress";
import { useImpositionState } from "@/hooks/useImpositionState";

const BOOK_TRIM_PRESETS = [
  { name: "A5 (148 × 210 mm)", w: 148, h: 210 },
  { name: "A4 (210 × 297 mm)", w: 210, h: 297 },
  { name: "B5 (176 × 250 mm)", w: 176, h: 250 },
  { name: "Novel 6×9\" (152.4 × 228.6 mm)", w: 152.4, h: 228.6 },
  { name: "Digest 5.5×8.5\" (139.7 × 215.9 mm)", w: 139.7, h: 215.9 },
  { name: "Pocket (108 × 175 mm)", w: 108, h: 175 },
];

function ImposingStudioContent() {
  const {
    jobMode, setJobMode,
    selectedBookIdx, setSelectedBookIdx,
    items, setItems,
    mode,
    autoRotateSheet,
    
    unit, setUnit,
    sheetW, setSheetW,
    sheetH, setSheetH,
    sheetPreset, setSheetPreset,
    margin, setMargin,
    gap, setGap,
    drawBorder, setDrawBorder,
    borderColor, setBorderColor,
    cropMarks, setCropMarks,
    align, setAlign,
    
    uniformOrientation, setUniformOrientation,
    showAdvanced, setShowAdvanced,
    dbSheets
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
    }
  }, [searchParams]);

  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSvg, setIsExportingSvg] = useState(false);
  
  const [previewData, setPreviewData] = useState<ImpositionPreviewResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPageOverlay, setShowPageOverlay] = useState(false);
  const [bookStep, setBookStep] = useState<1 | 2>(1);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.002;
      const delta = -e.deltaY * zoomSensitivity;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      
      setScale((prevScale) => {
        const newScale = Math.min(Math.max(0.1, prevScale + prevScale * delta), 15);
        const ratio = newScale / prevScale;
        const mouseX = clientX - rect.left - rect.width / 2;
        const mouseY = clientY - rect.top - rect.height / 2;
        setPosition((prevPos) => ({
          x: mouseX - (mouseX - prevPos.x) * ratio,
          y: mouseY - (mouseY - prevPos.y) * ratio
        }));
        return newScale;
      });
    };

    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const rafId = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      setPosition({
        x: clientX - dragStart.current.x,
        y: clientY - dragStart.current.y
      });
      rafId.current = null;
    });
  };

  const handleMouseUp = () => { setIsDragging(false); };
  const handleMouseLeave = () => { setIsDragging(false); };
  
  useEffect(() => {
    if (previewData && previewData.preview_pages && previewData.preview_pages[currentPage]) {
      const pageW = previewData.preview_pages[currentPage].w;
      const pageH = previewData.preview_pages[currentPage].h;
      
      const updateFitScale = () => {
        if (!canvasRef.current || pageW <= 0 || pageH <= 0) return;
        const rect = canvasRef.current.getBoundingClientRect();
        // Give 36px breathing padding so the sheet displays as large as possible without feeling locked
        const availW = Math.max(100, rect.width - 36);
        const availH = Math.max(100, rect.height - 36);
        const fitScale = Math.min(availW / pageW, availH / pageH);
        setScale(Math.max(0.05, fitScale));
        setPosition({ x: 0, y: 0 });
      };

      // Run on frame to ensure canvas has laid out
      const frame = requestAnimationFrame(updateFitScale);
      return () => cancelAnimationFrame(frame);
    }
  }, [previewData, currentPage]);

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
        } else {
          setError(prev => prev ? `${prev}\n${data.error}` : data.error);
        }
      }
      
      if (newItems.length > 0) {
        if (hasBookUpload) {
          setJobMode("book");
        }
        setItems(prev => [...prev, ...newItems]);
      }
    } catch {
      setError("Failed to upload files to imposing server.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };


  const updateItemFields = (idx: number, updates: Partial<ImposingItem>) => {
    setItems(prev => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], ...updates };
      }
      return next;
    });
  };

  const updateItemField = <K extends keyof ImposingItem>(idx: number, field: K, val: ImposingItem[K]) => {
    updateItemFields(idx, { [field]: val });
  };

  const updateItemSize = (idx: number, field: "w" | "h", valUnit: number) => {
    const newItems = [...items];
    const it = newItems[idx];
    const mmVal = toMm(valUnit, unit);
    if (field === "w") {
      it.w = mmVal;
      if (it.locked && it.ratio) it.h = mmVal / it.ratio;
    } else {
      it.h = mmVal;
      if (it.locked && it.ratio) it.w = mmVal * it.ratio;
    }
    setItems(newItems);
  };

  const resetItemSize = (idx: number) => {
    const newItems = [...items];
    const it = newItems[idx];
    if (it.original_w !== undefined && it.original_h !== undefined) {
      it.w = it.original_w;
      it.h = it.original_h;
      it.ratio = it.original_w / it.original_h;
      setItems(newItems);
    }
  };
  
  const toggleLock = (idx: number) => {
    const newItems = [...items];
    newItems[idx].locked = !newItems[idx].locked;
    if (newItems[idx].locked) {
      newItems[idx].ratio = newItems[idx].w / newItems[idx].h;
    }
    setItems(newItems);
  };
  
  const removeItem = (idx: number) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  const handlePreview = useCallback(async () => {
    if (items.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsPreviewing(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, 
          job_mode: jobMode,
          mode, 
          sheet_w: sheetW, 
          sheet_h: sheetH, 
          margin, 
          gap, 
          draw_border: drawBorder, 
          border_color: borderColor, 
          crop_marks: cropMarks, 
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
  }, [items, jobMode, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, align, autoRotateSheet, uniformOrientation]);

  const handleExport = async () => {
    if (items.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsExporting(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, 
          job_mode: jobMode,
          mode, 
          sheet_w: sheetW, 
          sheet_h: sheetH, 
          margin, 
          gap, 
          draw_border: drawBorder, 
          border_color: borderColor, 
          crop_marks: cropMarks, 
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

  const handleExportSvg = async () => {
    if (items.length === 0 || !sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) return;
    setIsExportingSvg(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/export-svg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, 
          job_mode: jobMode,
          mode, 
          sheet_w: sheetW, 
          sheet_h: sheetH, 
          margin, 
          gap, 
          draw_border: drawBorder, 
          border_color: borderColor, 
          crop_marks: cropMarks, 
          align, 
          auto_rotate_sheet: autoRotateSheet,
          uniform_orientation: uniformOrientation,
          page_index: currentPage
        })
      });
      
      if (!res.ok) throw new Error("SVG Export failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const sheetSuffix = previewData && previewData.preview_pages && previewData.preview_pages.length > 1 
        ? `_Sheet_${currentPage + 1}` 
        : "";
      link.download = `Imposed_Cut${sheetSuffix}_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export layered cut SVG.");
    } finally {
      setIsExportingSvg(false);
    }
  };

  // Debounced auto-preview (350ms)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (items.length === 0) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { 
      handlePreview(); 
    }, 350);
    return () => { 
      if (typingTimeout.current) clearTimeout(typingTimeout.current); 
    };
  }, [items, jobMode, mode, sheetW, sheetH, margin, gap, align, drawBorder, borderColor, cropMarks, autoRotateSheet, handlePreview]);

  return (
    <div className="w-full space-y-3 pb-4">
      {/* Compact Studio Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-[#242A38]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="text-emerald-400" size={20} />
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
              Imposing Studio
            </h1>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-[#131720] p-0.5 rounded-lg border border-[#2E3648]">
            <button 
              type="button"
              onClick={() => setJobMode("book")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                jobMode === "book" 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen size={13} />
              <span>Book & Publication</span>
            </button>
            <button 
              type="button"
              onClick={() => setJobMode("gang")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                jobMode === "gang" 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutDashboard size={13} />
              <span>Gang Run & Stickers</span>
            </button>
          </div>

          <span className="hidden xl:inline text-xs text-slate-400 border-l border-[#242A38] pl-2.5">
            {jobMode === "book"
              ? "Sequential publication layout with outward bleed & opposing page auto-alignment"
              : "Auto-nesting layout engine for offset press sheets and wide-format rolls"}
          </span>
        </div>

        <div className="flex items-center space-x-2 self-start lg:self-auto shrink-0">
          <label className="cursor-pointer px-3.5 py-1.5 bg-[#131720] hover:bg-[#232936] text-emerald-400 border border-[#2E3648] hover:border-emerald-500/50 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm">
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            <span>Add Artwork</span>
            <input 
              type="file" 
              multiple
              accept="image/*,application/pdf" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
          </label>

          <button 
            onClick={handleExportSvg}
            disabled={items.length === 0 || isExportingSvg}
            className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-40"
            title="Export layered SVG for digital cutting plotters (Artwork + CutContour layers)"
          >
            {isExportingSvg ? <Loader2 className="animate-spin" size={14} /> : <Scissors size={14} />}
            <span>Export Cut SVG</span>
          </button>

          <button 
            onClick={handleExport}
            disabled={items.length === 0 || isExporting}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-40"
          >
            {isExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            <span>Export Print PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3.5 items-start">
        {/* Left Control Sidebar */}
        <div className="w-full lg:w-[350px] xl:w-[370px] shrink-0 space-y-3">
          
            {/* =========================================================================
               MODE A: BOOK & PUBLICATION IMPOSITION (De-cluttered & Operator-Friendly)
               ========================================================================= */}
            <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-3.5 shadow-sm">
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-[#242A38]">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <BookOpen size={14} className="text-emerald-400" />
                  <span>Publication Setup</span>
                </span>
                <select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value)} 
                  className="text-xs bg-[#131720] border border-[#2E3648] text-slate-300 rounded px-2 py-0.5 outline-none font-medium cursor-pointer"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">inch</option>
                </select>
              </div>

              {/* 1. Document / Trim Size Section */}
              {items.length === 0 ? (
                <div className="p-5 bg-[#131720] border border-dashed border-[#2E3648] rounded-xl text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-700/50 flex items-center justify-center mx-auto text-emerald-400">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">No PDF Loaded</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Upload a book PDF to impose sequential pages</p>
                  </div>
                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
                    <Upload size={13} />
                    <span>Upload Book PDF</span>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      disabled={isUploading}
                    />
                  </label>
                </div>
              ) : (
                (() => {
                  const activeIdx = (selectedBookIdx < items.length && selectedBookIdx >= 0) ? selectedBookIdx : 0;
                  const book = items[activeIdx];
                  if (!book) return null;

                  const currentBookPreset = BOOK_TRIM_PRESETS.find(
                    p => Math.abs(p.w - book.w) < 0.5 && Math.abs(p.h - book.h) < 0.5
                  )?.name || "custom";

                  const hasBleed = (book.bleed_mode ?? 'none') !== 'none' && (book.bleed_mm ?? 0) > 0;

                  return (
                    <div className="space-y-3">
                      {/* Book Switcher Tabs if multiple items */}
                      {items.length > 1 && (
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {items.map((it, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedBookIdx(idx)}
                              className={`text-[10px] px-2 py-0.5 rounded font-medium truncate max-w-[120px] border transition-colors ${
                                activeIdx === idx
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold"
                                  : "bg-[#131720] text-slate-400 border-[#2E3648] hover:text-white"
                              }`}
                              title={it.name}
                            >
                              {it.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Step 1 vs Step 2 Stepper (Quiet Imposing style) */}
                      <div className="flex rounded-lg bg-[#131720] p-1 border border-[#2E3648] gap-1">
                        <button
                          type="button"
                          onClick={() => setBookStep(1)}
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            bookStep === 1
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-black/30 text-[10px] flex items-center justify-center font-mono">1</span>
                          <span>Trim & Bleed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookStep(2)}
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            bookStep === 2
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-black/30 text-[10px] flex items-center justify-center font-mono">2</span>
                          <span>Sheet Impose</span>
                        </button>
                      </div>

                      {/* Active File Box: Name, Pages, Original Size & Page Range */}
                      <div className="p-2.5 bg-[#131720] border border-[#2E3648] rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-200 truncate" title={book.name}>{book.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60 font-semibold">
                                {book.page_count || 1} Pages (Sequential)
                              </span>
                              {book.original_w !== undefined && book.original_h !== undefined && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Original: {toUnit(book.original_w, unit)} × {toUnit(book.original_h, unit)} {unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(activeIdx)}
                            className="text-slate-400 hover:text-red-400 transition-colors p-1 shrink-0"
                            title="Remove Book"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>


                        {/* Copies selector */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#242A38]">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">Copies:</span>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button 
                              type="button"
                              onClick={() => updateItemField(activeIdx, 'copies', Math.max(1, (book.copies || 1) - 1))}
                              className="w-5 h-5 bg-[#232936] hover:bg-[#2E3648] text-slate-300 rounded text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-7 text-center font-mono font-bold text-xs text-white">
                              {book.copies || 1}
                            </span>
                            <button 
                              type="button"
                              onClick={() => updateItemField(activeIdx, 'copies', (book.copies || 1) + 1)}
                              className="w-5 h-5 bg-[#232936] hover:bg-[#2E3648] text-slate-300 rounded text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {/* Page Range selector */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#242A38]">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">Page Range:</span>
                          <input 
                            type="text" 
                            value={book.page_range || "all"} 
                            onChange={(e) => updateItemField(activeIdx, 'page_range', e.target.value)}
                            placeholder="all or 1-16, 17-32"
                            className="flex-1 text-xs font-mono bg-[#181D27] border border-[#2E3648] text-emerald-400 px-2 py-0.5 rounded outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemField(activeIdx, 'page_range', 'all')}
                            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                              (book.page_range === 'all' || !book.page_range) 
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-medium' 
                                : 'bg-[#181D27] text-slate-400 border-[#2E3648] hover:text-white'
                            }`}
                          >
                            All
                          </button>
                        </div>
                      </div>

                      {/* =========================================================
                          STEP 1: PAGE TRIM, FIT & BLEED EXTENSION
                          ========================================================= */}
                      {bookStep === 1 && (
                        <div className="space-y-3">
                          {/* Finished Book Trim Size */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="block text-[11px] font-semibold text-slate-300">Finished Book Trim Size</label>
                              {book.original_w !== undefined && book.original_h !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => resetItemSize(activeIdx)}
                                  className="text-[9px] text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                                  title="Reset trim dimensions to original PDF size"
                                >
                                  <RotateCcw size={9} />
                                  <span>Reset</span>
                                </button>
                              )}
                            </div>
                            <select 
                              value={currentBookPreset} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== "custom") {
                                  const p = BOOK_TRIM_PRESETS.find(item => item.name === val);
                                  if (p) {
                                    updateItemFields(activeIdx, { w: p.w, h: p.h, ratio: p.w / p.h });
                                  }
                                }
                              }} 
                              className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none cursor-pointer"
                            >
                              {BOOK_TRIM_PRESETS.map((p, pIdx) => (
                                <option key={pIdx} value={p.name}>{p.name}</option>
                              ))}
                              <option value="custom">Custom Trim...</option>
                            </select>

                            {/* Inline W x H */}
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 flex items-center bg-[#131720] border border-[#2E3648] rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400 mr-1 font-mono uppercase">W</span>
                                <input 
                                  type="number" 
                                  value={toUnit(book.w, unit)} 
                                  onChange={(e) => updateItemSize(activeIdx, "w", parseFloat(e.target.value) || 1)} 
                                  className="w-full text-xs bg-transparent text-center text-white outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                />
                                <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                              </div>

                              <button 
                                type="button"
                                onClick={() => toggleLock(activeIdx)} 
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  book.locked 
                                    ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-400" 
                                    : "bg-[#131720] border-[#2E3648] text-slate-500 hover:text-white"
                                }`}
                                title={book.locked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                              >
                                {book.locked ? <LinkIcon size={12}/> : <Unlink size={12}/>}
                              </button>

                              <div className="flex-1 flex items-center bg-[#131720] border border-[#2E3648] rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400 mr-1 font-mono uppercase">H</span>
                                <input 
                                  type="number" 
                                  value={toUnit(book.h, unit)} 
                                  onChange={(e) => updateItemSize(activeIdx, "h", parseFloat(e.target.value) || 1)} 
                                  className="w-full text-xs bg-transparent text-center text-white outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                />
                                <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                              </div>

                              <button 
                                type="button"
                                onClick={() => {
                                  updateItemFields(activeIdx, { w: book.h, h: book.w, ratio: book.h / book.w });
                                }} 
                                className="p-1.5 bg-[#232936] hover:bg-[#2E3648] rounded-lg text-slate-300 transition-colors border border-[#2E3648]" 
                                title="Swap Trim Width / Height"
                              >
                                <ArrowRightLeft size={13} />
                              </button>
                            </div>

                            {/* Content Fit Mode */}
                            <div className="space-y-1 pt-1.5">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase block">Content Fit Mode</label>
                              <div className="flex space-x-1">
                                {(['stretch', 'fit', 'crop'] as const).map((fitMode) => (
                                  <button
                                    key={fitMode}
                                    type="button"
                                    onClick={() => updateItemFields(activeIdx, { fit_mode: fitMode, keep_aspect: fitMode === 'fit' })}
                                    className={`flex-1 text-[10px] py-1 rounded border transition-colors font-medium capitalize ${
                                      (book.fit_mode ?? 'stretch') === fitMode
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold'
                                        : 'bg-[#131720] text-slate-400 border-[#2E3648] hover:text-white'
                                    }`}
                                  >
                                    {fitMode}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Auto-orient Landscape Pages */}
                          <label className="flex items-start space-x-2.5 p-2 bg-[#131720] border border-[#2E3648] hover:border-emerald-600/50 rounded-lg cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={book.page_rotation === 'cw'} 
                              onChange={(e) => updateItemField(activeIdx, 'page_rotation', e.target.checked ? 'cw' : 'none')}
                              className="mt-0.5 rounded bg-[#181D27] border-[#2E3648] text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-slate-200 block">Auto-orient landscape pages</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug">
                                Turns landscape pages 90° CW to match book trim; portrait stays upright.
                              </span>
                            </div>
                          </label>

                          {/* Bleed Controls */}
                          <div className="p-2.5 bg-[#131720] border border-[#2E3648] rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center space-x-2.5 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={hasBleed} 
                                  onChange={(e) => {
                                    updateItemFields(activeIdx, {
                                      bleed_mode: e.target.checked ? (book.bleed_mode === 'solid' ? 'solid' : 'mirror') : 'none',
                                      bleed_mm: e.target.checked ? (book.bleed_mm || 3.0) : 0,
                                      bleed_type: book.bleed_type || 'outside'
                                    });
                                  }} 
                                  className="rounded bg-[#181D27] border-[#2E3648] text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                                />
                                <span className="text-xs font-semibold text-slate-200">Bleed Extension</span>
                              </label>

                              {hasBleed && (
                                <div className="flex items-center space-x-1">
                                  <input 
                                    type="number" 
                                    min="0.5" 
                                    max="20" 
                                    step="0.5"
                                    value={book.bleed_mm || 3.0} 
                                    onChange={(e) => updateItemField(activeIdx, 'bleed_mm', parseFloat(e.target.value) || 0)} 
                                    className="w-12 text-xs font-mono font-bold bg-[#181D27] border border-[#2E3648] text-emerald-400 text-center rounded px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-mono">mm</span>
                                </div>
                              )}
                            </div>

                            {hasBleed && (
                              <div className="space-y-2 pt-1 border-t border-[#242A38]">
                                <div>
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Bleed Method</span>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateItemField(activeIdx, 'bleed_mode', 'mirror')}
                                      className={`text-[11px] py-1 px-2 rounded-md border font-medium flex items-center justify-center space-x-1 transition-colors ${
                                        (book.bleed_mode ?? 'mirror') === 'mirror'
                                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold'
                                          : 'bg-[#181D27] text-slate-400 border-[#2E3648] hover:text-white'
                                      }`}
                                    >
                                      <span>🪞 Mirrored Edge</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateItemField(activeIdx, 'bleed_mode', 'solid')}
                                      className={`text-[11px] py-1 px-2 rounded-md border font-medium flex items-center justify-center space-x-1 transition-colors ${
                                        book.bleed_mode === 'solid'
                                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold'
                                          : 'bg-[#181D27] text-slate-400 border-[#2E3648] hover:text-white'
                                      }`}
                                    >
                                      <span>🎨 Solid Color</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Bleed Type</span>
                                  <div className="flex space-x-1">
                                    {(['outside', 'inside'] as const).map((bType) => (
                                      <button
                                        key={bType}
                                        type="button"
                                        onClick={() => updateItemField(activeIdx, 'bleed_type', bType)}
                                        className={`text-[10px] px-2.5 py-1 rounded border transition-colors capitalize ${
                                          (book.bleed_type ?? 'outside') === bType
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold'
                                            : 'bg-[#181D27] text-slate-400 border-[#2E3648] hover:text-white'
                                        }`}
                                      >
                                        {bType}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {book.bleed_mode === 'solid' && (
                                  <div className="flex items-center justify-between p-1.5 bg-[#181D27] rounded border border-[#2E3648]">
                                    <span className="text-[10px] text-slate-400 font-medium">Bleed Fill Color</span>
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="color" 
                                        value={book.bleed_color || '#FFFFFF'} 
                                        onChange={(e) => updateItemField(activeIdx, 'bleed_color', e.target.value)} 
                                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent" 
                                      />
                                      
                                      <span className="text-[10px] text-slate-300 font-mono uppercase">
                                        {book.bleed_color || '#FFFFFF'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Next Step Button */}
                          <button
                            type="button"
                            onClick={() => setBookStep(2)}
                            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-sm"
                          >
                            <span>Proceed to Step 2: Sheet Impose</span>
                            <ArrowRightLeft size={13} />
                          </button>
                        </div>
                      )}

                      {/* =========================================================
                          STEP 2: TARGET PRESS SHEET, MARKS & STEP & REPEAT
                          ========================================================= */}
                      {bookStep === 2 && (
                        <div className="space-y-3">
                          {/* Target Press Sheet Section */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-slate-300">Target Press Sheet</label>
                            <select 
                              value={sheetPreset} 
                              onChange={(e) => setSheetPreset(e.target.value)} 
                              className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none cursor-pointer"
                            >
                              <option value="">-- Select a press sheet --</option>
                              {(dbSheets.length > 0 ? dbSheets : [
                                { name: "SRA3", width: 320, height: 450 },
                                { name: "A3", width: 297, height: 420 },
                                { name: "B2", width: 480, height: 650 },
                                { name: "33×48 cm", width: 330, height: 480 },
                                { name: "A4", width: 210, height: 297 }
                              ]).map((s, idx) => (
                                <option key={idx} value={`${s.width},${s.height}`}>
                                  {s.name} ({s.width} × {s.height} mm)
                                </option>
                              ))}
                              <option value="custom">Custom Dimensions...</option>
                            </select>

                            {/* Inline Sheet W x H */}
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 flex items-center bg-[#131720] border border-[#2E3648] rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400 mr-1 font-mono uppercase">W</span>
                                <input 
                                  type="number" 
                                  value={toUnit(sheetW, unit)} 
                                  onChange={(e) => { 
                                    setSheetPreset("custom"); 
                                    setSheetW(toMm(parseFloat(e.target.value) || 1, unit)); 
                                  }} 
                                  className="w-full text-xs bg-transparent text-center text-white outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                />
                                <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                              </div>

                              <button 
                                type="button"
                                onClick={() => { setSheetPreset("custom"); setSheetW(sheetH); setSheetH(sheetW); }} 
                                className="p-1.5 bg-[#232936] hover:bg-[#2E3648] rounded-lg text-slate-300 transition-colors border border-[#2E3648]" 
                                title="Rotate Press Sheet 90° (Swap W/H)"
                              >
                                <ArrowRightLeft size={13} />
                              </button>

                              <div className="flex-1 flex items-center bg-[#131720] border border-[#2E3648] rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400 mr-1 font-mono uppercase">H</span>
                                <input 
                                  type="number" 
                                  value={toUnit(sheetH, unit)} 
                                  onChange={(e) => { 
                                    setSheetPreset("custom"); 
                                    setSheetH(toMm(parseFloat(e.target.value) || 1, unit)); 
                                  }} 
                                  className="w-full text-xs bg-transparent text-center text-white outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                />
                                <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
                              </div>
                            </div>
                          </div>

                          {/* Prepress Crop Marks */}
                          <label className="flex items-center space-x-2.5 p-2 bg-[#131720] border border-[#2E3648] hover:border-emerald-600/50 rounded-lg cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={cropMarks} 
                              onChange={(e) => setCropMarks(e.target.checked)} 
                              className="rounded bg-[#181D27] border-[#2E3648] text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                            />
                            <span className="text-xs font-semibold text-slate-200">Prepress Corner Crop Marks</span>
                          </label>

                          {/* Step 2 Advanced Tuning (Margins, Gutters, Alignment, Die-lines) */}
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowAdvanced(!showAdvanced)}
                              className="w-full flex items-center justify-between py-2 px-2.5 bg-[#131720] hover:bg-[#1A202C] border border-[#2E3648] rounded-lg text-xs font-semibold text-slate-300 transition-colors"
                            >
                              <span className="flex items-center space-x-1.5">
                                <Settings2 size={13} className="text-emerald-400" />
                                <span>Press Sheet Margins & Marks</span>
                              </span>
                              {showAdvanced ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </button>

                            {showAdvanced && (
                              <div className="pt-2.5 space-y-3 bg-[#131720]/50 p-2.5 rounded-lg border border-[#242A38] mt-2">
                                {/* Margins & Gaps */}
                                <div className="grid grid-cols-2 gap-2">
                                  <NumberControl 
                                    label={`Gripper (${unit})`} 
                                    value_mm={margin} 
                                    unit={unit} 
                                    min_mm={0} 
                                    max_mm={100} 
                                    step={unit === "cm" ? 0.25 : unit === "in" ? 0.1 : 2.5} 
                                    onChange={setMargin} 
                                  />
                                  <NumberControl 
                                    label={`Gutter Gap (${unit})`} 
                                    value_mm={gap} 
                                    unit={unit} 
                                    min_mm={0} 
                                    max_mm={50} 
                                    step={unit === "cm" ? 0.25 : unit === "in" ? 0.1 : 2.5} 
                                    onChange={setGap} 
                                  />
                                </div>

                                {/* Polar / Guillotine cut checkbox */}
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={uniformOrientation} 
                                    onChange={(e) => setUniformOrientation(e.target.checked)} 
                                    className="rounded bg-[#131720] border-[#2E3648] text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                                  />
                                  <span className="text-[11px] text-slate-300">Guillotine Cut (Same Orientation)</span>
                                </label>

                                {/* Sheet Alignment */}
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#242A38]">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Alignment</span>
                                  <div className="grid grid-cols-3 gap-1 w-14 bg-[#0B0F19] p-1 border border-[#2E3648] rounded">
                                    {["Top Left", "Top Center", "Top Right", "Left", "Center", "Right", "Bottom Left", "Bottom Center", "Bottom Right"].map(a => (
                                      <button
                                        key={a}
                                        type="button"
                                        title={a}
                                        onClick={() => setAlign(a)}
                                        className={`w-3 h-3 rounded-xs transition-colors border ${align === a ? 'bg-emerald-500 border-emerald-400' : 'bg-[#131720] border-[#2E3648]'}`}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Cut Outline die-line */}
                                <div className="space-y-1 pt-1 border-t border-[#242A38]">
                                  <label className="flex items-center space-x-2 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={drawBorder} 
                                      onChange={(e) => setDrawBorder(e.target.checked)} 
                                      className="rounded bg-[#131720] border-[#2E3648] text-emerald-500 focus:ring-emerald-500 cursor-pointer" 
                                    />
                                    <span className="text-[11px] text-slate-300">Show Cut Outline / Die-line</span>
                                  </label>
                                  {drawBorder && (
                                    <div className="flex items-center space-x-2 pl-5 pt-0.5">
                                      <input 
                                        type="color" 
                                        value={borderColor} 
                                        onChange={(e) => setBorderColor(e.target.value)} 
                                        className="w-5 h-5 rounded cursor-pointer border-0 p-0" 
                                      />
                                      
                                      <span className="text-[10px] text-slate-400 font-mono uppercase">{borderColor}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Back to Step 1 */}
                          <button
                            type="button"
                            onClick={() => setBookStep(1)}
                            className="w-full py-1.5 px-3 bg-[#131720] hover:bg-[#1C2230] border border-[#2E3648] text-slate-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            ← Back to Step 1: Trim & Bleed
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })()
              )}
            </div>
        </div>

        {/* Live Sheet Viewport (Dynamic sizing to match the sheet with room to pan) */}
        <div className="flex-1 min-w-0 max-w-[780px] flex flex-col space-y-3">
          {error && (
            <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">
              {error}
            </div>
          )}

          <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col overflow-hidden min-h-[460px] h-[520px] lg:h-[620px] xl:h-[680px] shadow-sm relative">
            {/* Viewport Toolbar */}
            <div className="p-2.5 border-b border-[#242A38] flex flex-wrap justify-between items-center bg-[#141822] gap-2">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-300">
                    {jobMode === "book" && bookStep === 1 
                      ? "Step 1: Page Trim & Bleed View" 
                      : "Step 2: Live Press Sheet View"}
                  </span>
                  {isPreviewing && (
                    <span className="text-xs text-emerald-400 flex items-center font-medium ml-2">
                      <Loader2 className="animate-spin mr-1.5" size={13} />
                      Calculating...
                    </span>
                  )}
                </div>

                {/* Badges / Text Overlay Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPageOverlay(!showPageOverlay)}
                  className={`text-[10px] px-2 py-1 rounded border flex items-center space-x-1.5 transition-colors font-medium ${
                    showPageOverlay 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold' 
                      : 'bg-[#1A202C] text-slate-400 border-[#2E3648] hover:text-white'
                  }`}
                  title={showPageOverlay ? "Page labels visible" : "Page labels hidden"}
                >
                  {showPageOverlay ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} />}
                  <span>{showPageOverlay ? "Labels On" : "Labels Off"}</span>
                </button>
              </div>
              
              {previewData && previewData.preview_pages && previewData.preview_pages.length > 1 && (
                <div className="flex items-center space-x-1.5 bg-[#1A202C] rounded-lg border border-[#2E3648] px-2 py-1">
                  <button 
                    type="button"
                    title="First Sheet"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(0)}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronsLeft size={14}/>
                  </button>
                  <button 
                    type="button"
                    title="Previous Sheet"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14}/>
                  </button>
                  <div className="flex items-center space-x-1 px-1">
                    <span className="text-xs text-slate-400 font-medium">Sheet</span>
                    <input 
                      type="number"
                      min={1}
                      max={previewData.preview_pages.length}
                      value={currentPage + 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= previewData.preview_pages.length) {
                          setCurrentPage(val - 1);
                        }
                      }}
                      className="w-12 text-xs font-mono font-bold bg-[#131720] border border-[#2E3648] text-white text-center rounded px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-mono font-semibold text-slate-400 whitespace-nowrap">
                      / {previewData.preview_pages.length}
                    </span>
                  </div>
                  <button 
                    type="button"
                    title="Next Sheet"
                    disabled={currentPage >= previewData.preview_pages.length - 1}
                    onClick={() => setCurrentPage((p) => Math.min(previewData.preview_pages.length - 1, p + 1))}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14}/>
                  </button>
                  <button 
                    type="button"
                    title="Last Sheet"
                    disabled={currentPage >= previewData.preview_pages.length - 1}
                    onClick={() => setCurrentPage(previewData.preview_pages.length - 1)}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronsRight size={14}/>
                  </button>
                </div>
              )}
            </div>
            
            {/* Interactive Sheet Canvas */}
            <div 
              ref={canvasRef}
              className="flex-1 bg-[#0F1218] flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              {!previewData && (
                <div className="text-slate-400 flex flex-col items-center p-6 text-center">
                  <SlidersHorizontal size={40} className="mb-3 opacity-30 text-emerald-400" />
                  {items.length === 0 ? (
                    <>
                      <p className="text-xs font-medium text-slate-300">Upload a PDF or artwork to begin</p>
                      <p className="text-[11px] text-slate-500 mt-1">Automatic imposition & nesting</p>
                    </>
                  ) : (!sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) ? (
                    <>
                      <p className="text-xs font-semibold text-emerald-400">Select a Target Press Sheet</p>
                      <p className="text-[11px] text-slate-400 mt-1">Pick your press sheet size to calculate layout</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-slate-300">Calculating sheet layout...</p>
                    </>
                  )}
                </div>
              )}
              
              {previewData && previewData.preview_pages && previewData.preview_pages[currentPage] && (
                <div 
                  className="bg-white shadow-2xl relative"
                  style={{ 
                    width: `${previewData.preview_pages[currentPage].w}px`, 
                    height: `${previewData.preview_pages[currentPage].h}px`,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.05s ease-out"
                  }}
                >
                  {/* Gripper Margin Boundary Line */}
                  <div 
                    className="absolute border border-dashed border-red-400/60 pointer-events-none" 
                    style={{
                      top: `${margin}px`, 
                      left: `${margin}px`,
                      right: `${margin}px`, 
                      bottom: `${margin}px`,
                    }}
                  />

                  {/* Imposed Box Items */}
                  {previewData.preview_pages[currentPage].boxes.map((box, i) => {
                    const hasBleed = box.bleed_mode && box.bleed_mode !== 'none' && (box.bleed_mm ?? 0) > 0;
                    const bleedMm = hasBleed ? (box.bleed_mm ?? 0) : 0;
                    const isOutsideBleed = box.bleed_type === 'outside';
                    const contentW = hasBleed ? Math.max(1, box.w - bleedMm * 2) : box.w;
                    const contentH = hasBleed ? Math.max(1, box.h - bleedMm * 2) : box.h;

                    const packerDeg = box.rotated ? 90 : 0;
                    const userDeg = box.page_rotation === 'cw' ? 90 : box.page_rotation === 'ccw' ? 270 : 0;
                    const totalDeg = (packerDeg + userDeg) % 360;
                    const isSwapped = totalDeg === 90 || totalDeg === 270;

                    const thumbUrl = box.thumb ? (box.thumb.startsWith("/") ? `${API_BASE_URL}${box.thumb}` : `${API_BASE_URL}/temp_uploads/${box.thumb}`) : "";

                    // For outside bleed, crop marks align to the finished trim box
                    const markOffset = (hasBleed && isOutsideBleed) ? bleedMm : 0;
                    const markW = box.w - markOffset * 2;
                    const markH = box.h - markOffset * 2;

                    return (
                      <div 
                        key={i} 
                        className="absolute pointer-events-none" 
                        style={{ 
                          left: `${box.x}px`, 
                          top: `${box.y}px`, 
                          width: `${box.w}px`, 
                          height: `${box.h}px` 
                        }}
                      >
                        {cropMarks && (
                          <div className="absolute pointer-events-none" style={{ left: `${markOffset}px`, top: `${markOffset}px`, width: `${markW}px`, height: `${markH}px` }}>
                            {/* Top Left */}
                            <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", top: "0" }} />
                            <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", top: "-6px" }} />
                            {/* Top Right */}
                            <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", top: "0" }} />
                            <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", top: "-6px" }} />
                            {/* Bottom Left */}
                            <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", bottom: "0" }} />
                            <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", bottom: "-6px" }} />
                            {/* Bottom Right */}
                            <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", bottom: "0" }} />
                            <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", bottom: "-6px" }} />
                          </div>
                        )}
                        
                        {/* Outer Bleed/Cut Area */}
                        <div 
                          className={`absolute inset-0 shadow-sm flex items-center justify-center overflow-hidden pointer-events-auto ${box.fit_mode === 'fit' ? '' : 'bg-slate-100'}`}
                          style={{
                            border: drawBorder ? `1px solid ${borderColor}` : "1px solid #cbd5e1",
                            backgroundColor: (box.bleed_mode === 'solid' && bleedMm > 0) 
                              ? (box.bleed_color || '#FFFFFF') 
                              : (box.fit_mode === 'fit' ? box.fill_color : '#f8fafc'),
                            backgroundImage: (box.bleed_mode === 'solid' && bleedMm > 0)
                              ? `repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(16, 185, 129, 0.12) 3px, rgba(16, 185, 129, 0.12) 6px)`
                              : undefined
                          }}
                        >
                          {/* Mirrored Bleed Visual Layer */}
                          {box.bleed_mode === 'mirror' && bleedMm > 0 && thumbUrl && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-90">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={thumbUrl}
                                alt="bleed-mirror"
                                className="absolute inset-0 w-full h-full object-cover filter blur-[0.5px]"
                                style={{
                                  transform: `rotate(${totalDeg}deg) scale(1.08)`
                                }}
                              />
                              <div className="absolute inset-0 bg-black/10 backdrop-brightness-95" />
                            </div>
                          )}

                          {/* Inner Content Area Inset by Bleed */}
                          <div 
                            className="relative flex items-center justify-center overflow-hidden z-[1]"
                            style={{
                              width: `${contentW}px`,
                              height: `${contentH}px`,
                              outline: hasBleed
                                ? (isOutsideBleed 
                                    ? "1px dashed rgba(16, 185, 129, 0.95)" 
                                    : "1px dashed rgba(245, 158, 11, 0.9)")
                                : "none",
                              backgroundColor: box.fit_mode === 'fit' ? (box.fill_color || '#ffffff') : '#ffffff'
                            }}
                          >
                            {thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={thumbUrl} 
                                loading="lazy"
                                decoding="async"
                                className={
                                  box.fit_mode === 'fit' 
                                    ? "object-contain" 
                                    : (box.fit_mode === 'crop' ? "object-cover" : "object-fill")
                                }
                                style={{
                                  width: isSwapped ? `${contentH}px` : "100%",
                                  height: isSwapped ? `${contentW}px` : "100%",
                                  transform: `rotate(${totalDeg}deg)`
                                }}
                                alt="thumb" 
                              />
                            ) : (
                              <span className="text-[8px] text-emerald-700 font-medium rotate-45 opacity-60">Item</span>
                            )}
                          </div>

                          {/* Minimal discreet overlay labels when enabled */}
                          {showPageOverlay && (
                            <>
                              {(box.page_label || (box.page_num !== undefined && box.page_num > 0)) && (
                                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/60 text-emerald-300 text-[7px] font-mono font-medium rounded-xs pointer-events-none z-[2]">
                                  {box.page_label || `P.${box.page_num! + 1}`}
                                </span>
                              )}
                              {hasBleed && (
                                <span className="absolute top-0.5 left-0.5 px-1 py-0.2 bg-emerald-950/80 text-emerald-300 text-[7px] font-mono rounded-xs pointer-events-none border border-emerald-700/50 z-[2]">
                                  +{bleedMm}mm
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Viewport Floating HUD */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-[#181D27]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2E3648] shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(15, s * 1.25))}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.1, s * 0.8))}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <div className="w-px h-3.5 bg-[#2E3648] mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (previewData && previewData.preview_pages && previewData.preview_pages[currentPage] && canvasRef.current) {
                      const pageW = previewData.preview_pages[currentPage].w;
                      const pageH = previewData.preview_pages[currentPage].h;
                      const rect = canvasRef.current.getBoundingClientRect();
                      const availW = Math.max(100, rect.width - 36);
                      const availH = Math.max(100, rect.height - 36);
                      const fitScale = Math.min(availW / pageW, availH / pageH);
                      setScale(Math.max(0.05, fitScale));
                      setPosition({ x: 0, y: 0 });
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Fit to Screen"
                >
                  <Maximize2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="1:1 Actual Size"
                >
                  <RotateCcw size={15} />
                </button>
                <span className="text-[10px] font-mono text-slate-400 pl-1.5 pr-0.5">
                  {Math.round(scale * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImposingStudio() {
  return (
    <Suspense fallback={null}>
      <ImposingStudioContent />
    </Suspense>
  );
}
