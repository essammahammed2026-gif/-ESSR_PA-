"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Scissors, 
  Download, 
  Loader2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Upload, 
  Layers, 
  SlidersHorizontal 
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const PRESET_COLORS = [
  { name: "CutContour (Magenta)", value: "#FF00FF" },
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#00FF00" },
  { name: "Blue", value: "#0000FF" },
  { name: "Black", value: "#000000" },
];

interface NumberControlProps {
  label: string;
  value: string;
  min: string;
  max: string;
  step: string;
  unit?: string;
  onChange: (val: string) => void;
}

const NumberControl: React.FC<NumberControlProps> = ({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  unit = "", 
  onChange 
}) => {
  const handleDec = () => onChange(String(Math.max(Number(min), Number(value) - Number(step))));
  const handleInc = () => onChange(String(Math.min(Number(max), Number(value) + Number(step))));
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <label className="font-semibold text-slate-300">{label}</label>
        <div className="flex items-center space-x-1">
          <button 
            type="button"
            onClick={handleDec} 
            className="w-6 h-6 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors"
          >
            -
          </button>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-1.5 py-0.5">
            <input 
              type="number" 
              min={min} 
              max={max} 
              step={step} 
              value={value} 
              onChange={(e) => onChange(e.target.value)} 
              className="w-12 text-xs bg-transparent text-center text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none font-mono"
            />
            {unit && <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>}
          </div>
          <button 
            type="button"
            onClick={handleInc} 
            className="w-6 h-6 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full h-1.5 bg-[#232936] rounded-lg appearance-none cursor-pointer accent-pink-500"
      />
    </div>
  );
};

export default function ContourStudio() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prepress Parameters
  const [offsetVal, setOffsetVal] = useState("0");
  const [threshold, setThreshold] = useState("20");
  const [smoothing, setSmoothing] = useState("2");
  const [keepHoles, setKeepHoles] = useState(false);
  const [addWhiteMatte, setAddWhiteMatte] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FF00FF");
  
  // Viewport / Canvas Controls
  const [artworkOpacity, setArtworkOpacity] = useState("100");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Mouse wheel pan & zoom with non-passive event listener
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
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const generateContour = useCallback(async (
    id: string, 
    offset: string, 
    thresh: string, 
    smooth: string, 
    holes: boolean, 
    matte: boolean, 
    color: string
  ) => {
    setIsGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.append("file_id", id);
    formData.append("offset_val", offset);
    formData.append("threshold", thresh);
    formData.append("smoothing_factor", smooth);
    formData.append("keep_holes", String(holes));
    formData.append("add_white_matte", String(matte));
    formData.append("stroke_color", color);

    try {
      const res = await fetch(`${API_BASE_URL}/api/contour/generate`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSvgContent(data.svg);
      } else {
        setError(data.error || "Failed to generate die-cut path.");
      }
    } catch {
      setError("Network error communicating with die-cut engine.");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsGenerating(true);
    setError(null);
    setSvgContent(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/contour/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setFileId(data.file_id);
        generateContour(data.file_id, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
      } else {
        setError(data.error || "Artwork upload failed.");
        setIsGenerating(false);
      }
    } catch {
      setError("Failed to upload artwork to prepress engine.");
      setIsGenerating(false);
    }
  };

  // Debounced auto-recalculation when parameters change (350ms)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!fileId) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    
    typingTimeout.current = setTimeout(() => {
      generateContour(fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
    }, 350);

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor, generateContour]);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cut_contour_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFitToViewport = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoom = (direction: "in" | "out") => {
    const factor = direction === "in" ? 1.25 : 0.8;
    setScale((prev) => Math.min(Math.max(0.1, prev * factor), 15));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#242A38]">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <span>Contour Cut Studio</span>
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700/50">
              Die-Line Vector
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Plotter-ready cut lines with physical scaling, bleed expansion, and choke underbase.
          </p>
        </div>

        {svgContent && (
          <button 
            onClick={handleDownload}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm"
          >
            <Download size={15} />
            <span>Export CutContour SVG</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Settings Panel */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] space-y-5">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-[#242A38]">
              <Upload size={14} className="text-pink-400" />
              <span>Input Artwork</span>
            </div>

            <div>
              <label 
                htmlFor="contour-file-input"
                className="w-full border-2 border-dashed border-[#2E3648] hover:border-pink-500/50 rounded-lg p-4 text-center cursor-pointer block bg-[#131720]/60 transition-colors"
              >
                <input 
                  id="contour-file-input"
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <Scissors size={24} className="text-pink-400 mx-auto mb-2 opacity-80" />
                <span className="text-xs font-semibold text-slate-300 block">
                  Select Artwork File
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  PNG with transparency or PDF
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-[#242A38] space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <SlidersHorizontal size={14} className="text-pink-400" />
                <span>Cut Geometry</span>
              </div>

              <NumberControl 
                label="Bleed / Choke Offset" 
                value={offsetVal} 
                min="-10" 
                max="10" 
                step="0.5" 
                unit="mm" 
                onChange={setOffsetVal} 
              />

              <NumberControl 
                label="Edge Smoothing" 
                value={smoothing} 
                min="0" 
                max="15" 
                step="1" 
                onChange={setSmoothing} 
              />
              
              <NumberControl 
                label="Detection Threshold" 
                value={threshold} 
                min="0" 
                max="100" 
                step="1" 
                onChange={setThreshold} 
              />
            </div>

            {/* Stroke Color */}
            <div className="pt-3 border-t border-[#242A38]">
              <label className="block text-xs font-semibold text-slate-300 mb-2">Spot Stroke Swatch</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button 
                    key={c.value} 
                    type="button"
                    title={c.name}
                    onClick={() => setStrokeColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      strokeColor === c.value ? "border-white scale-110" : "border-transparent hover:scale-105"
                    } transition-transform shadow-sm`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <div 
                  title="Custom Spot Color" 
                  className="relative w-6 h-6 rounded-full border border-[#2E3648] overflow-hidden cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-[#232936]"
                >
                  <input 
                    type="color" 
                    value={strokeColor} 
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0"
                  />
                  <span className="text-[10px] font-bold text-slate-300">+</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">{strokeColor.toUpperCase()} (CutContour)</div>
            </div>

            {/* Finishing Toggles */}
            <div className="pt-3 border-t border-[#242A38] space-y-2.5">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={keepHoles} 
                  onChange={(e) => setKeepHoles(e.target.checked)} 
                  className="rounded bg-[#131720] border-[#2E3648] text-pink-500 focus:ring-pink-500" 
                />
                <span className="text-xs font-medium text-slate-300">Preserve Internal Cut Holes</span>
              </label>
              
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={addWhiteMatte} 
                  onChange={(e) => setAddWhiteMatte(e.target.checked)} 
                  className="rounded bg-[#131720] border-[#2E3648] text-pink-500 focus:ring-pink-500" 
                />
                <span className="text-xs font-medium text-slate-300">Underbase White Matte Base</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Canvas Area */}
        <div className="lg:col-span-3 flex flex-col space-y-3">
          {error && (
            <div className="p-3.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">
              {error}
            </div>
          )}

          <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex-1 flex flex-col overflow-hidden min-h-[580px] shadow-sm relative">
            {/* Canvas Toolbar */}
            <div className="p-3 border-b border-[#242A38] flex justify-between items-center bg-[#141822]">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Layers size={14} className="text-pink-400" />
                  <span>Interactive Proof Canvas</span>
                </span>
                {isGenerating && (
                  <span className="text-xs text-pink-400 flex items-center font-medium">
                    <Loader2 className="animate-spin mr-1.5" size={13} />
                    Tracing Die Lines...
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-[#1A202C] px-2.5 py-1 rounded border border-[#2E3648]">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Artwork Opacity</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={artworkOpacity} 
                    onChange={(e) => setArtworkOpacity(e.target.value)} 
                    className="w-20 h-1 bg-[#2E3648] rounded appearance-none cursor-pointer accent-slate-300"
                  />
                  <span className="text-[10px] font-mono text-slate-300 w-7 text-right">{artworkOpacity}%</span>
                </div>
              </div>
            </div>
            
            {/* Viewport Canvas */}
            <div 
              ref={canvasRef}
              className="flex-1 bg-[#0F1218] flex items-center justify-center p-8 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {!svgContent && !isGenerating && (
                <div className="text-slate-400 flex flex-col items-center">
                  <Scissors size={44} className="mb-3 opacity-30 text-pink-400" />
                  <p className="text-sm font-medium text-slate-300">Upload artwork to trace contour cut path</p>
                  <p className="text-xs text-slate-400 mt-1">Automatic transparent boundary vectorization</p>
                </div>
              )}
              
              {svgContent && (
                <div 
                  className="drop-shadow-2xl transition-opacity duration-200"
                  style={{ 
                    opacity: isGenerating ? 0.6 : 1,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: "center",
                    willChange: "transform",
                    transition: isDragging ? "none" : "transform 0.08s ease-out"
                  }}
                >
                  <style>{`
                    #Artwork { opacity: ${Number(artworkOpacity) / 100}; transition: opacity 0.1s; } 
                    .canvas-svg-container > svg { width: 100% !important; height: 100% !important; max-height: 65vh; pointer-events: none; }
                  `}</style>
                  <div 
                    dangerouslySetInnerHTML={{ __html: svgContent }} 
                    className="canvas-svg-container w-full h-full object-contain" 
                    style={{ maxHeight: "65vh" }} 
                  />
                </div>
              )}

              {/* Floating Viewport HUD Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-[#181D27]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2E3648] shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => handleZoom("in")}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Zoom In (+)"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoom("out")}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={15} />
                </button>
                <div className="w-px h-3.5 bg-[#2E3648] mx-1" />
                <button
                  type="button"
                  onClick={handleFitToViewport}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Fit to Screen"
                >
                  <Maximize2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleFitToViewport}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#232936] transition-colors"
                  title="Reset Pan & Zoom"
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
