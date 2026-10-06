"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

import { ImposingItem, ImpositionPreviewResponse } from "@/types/prepress";
import { useImpositionState } from "@/hooks/useImpositionState";
import { PreviewViewport } from "@/components/imposing/PreviewViewport";
import { LeftAssetPanel } from "@/components/imposing/LeftAssetPanel";
import { RightControlPanel } from "@/components/imposing/RightControlPanel";



function ImposingStudioContent() {
  const {
    jobMode, setJobMode,
    items, setItems,
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
    cropMarks, setCropMarks, align, uniformOrientation,
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
    <div className="flex flex-col h-[calc(100vh-2rem)] space-y-2">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#242A38]">
         <div className="flex items-center space-x-2 text-sm text-slate-300">
            <span className="text-blue-400 cursor-pointer">Hub</span>
            <span className="text-slate-500">/</span>
            <span className="font-semibold text-white">Imposition & PDF Studio</span>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Left Panel */}
        <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 h-full">
           <LeftAssetPanel 
             items={items}
             handleFileUpload={handleFileUpload}
             isUploading={isUploading}
             removeItem={removeItem}
           />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 h-full min-w-0">
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
             error={error}
             currentPage={currentPage}
             setCurrentPage={setCurrentPage}
           />
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 h-full overflow-y-auto">
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
           />
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
