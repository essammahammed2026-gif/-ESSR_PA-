"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  ChevronsLeft, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsRight, 
  SlidersHorizontal, 
  ZoomIn, 
  ZoomOut, 
  Maximize2 
} from "lucide-react";
import { ImpositionPreviewResponse, ImposingItem } from "@/types/prepress";
import { API_BASE_URL } from "@/lib/api";

export interface PreviewViewportProps {
  previewData: ImpositionPreviewResponse | null;
  items: ImposingItem[];
  jobMode: string;
  bookStep: number;
  isPreviewing: boolean;
  sheetW: number;
  sheetH: number;
  margin: number;
  drawBorder: boolean;
  borderColor: string;
  cropMarks: boolean;
  regMarks?: boolean;
  error: string | null;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function PreviewViewport({
  previewData,
  items,
  jobMode,
  bookStep,
  isPreviewing,
  sheetW,
  sheetH,
  margin,
  drawBorder,
  borderColor,
  cropMarks,
  regMarks = false,
  error,
  currentPage,
  setCurrentPage
}: PreviewViewportProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showPageOverlay, setShowPageOverlay] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

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

  return (
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

              {/* Registration Corner Marks */}
              {regMarks && (
                <>
                  <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 pointer-events-none flex items-center justify-center">
                    <div className="absolute w-2.5 h-2.5 rounded-full border border-black" />
                    <div className="absolute w-3.5 h-[1px] bg-black" />
                    <div className="absolute w-[1px] h-3.5 bg-black" />
                  </div>
                  <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 pointer-events-none flex items-center justify-center">
                    <div className="absolute w-2.5 h-2.5 rounded-full border border-black" />
                    <div className="absolute w-3.5 h-[1px] bg-black" />
                    <div className="absolute w-[1px] h-3.5 bg-black" />
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 pointer-events-none flex items-center justify-center">
                    <div className="absolute w-2.5 h-2.5 rounded-full border border-black" />
                    <div className="absolute w-3.5 h-[1px] bg-black" />
                    <div className="absolute w-[1px] h-3.5 bg-black" />
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 pointer-events-none flex items-center justify-center">
                    <div className="absolute w-2.5 h-2.5 rounded-full border border-black" />
                    <div className="absolute w-3.5 h-[1px] bg-black" />
                    <div className="absolute w-[1px] h-3.5 bg-black" />
                  </div>
                </>
              )}

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
          </div>
        </div>
      </div>
    </div>
  );
}
