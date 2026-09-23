"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Upload, 
  Download, 
  Loader2, 
  Trash2, 
  Link as LinkIcon, 
  Unlink, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRightLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  SlidersHorizontal
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const toUnit = (mm: number, unit: string) => {
  if (unit === "cm") return +(mm / 10).toFixed(2);
  if (unit === "in") return +(mm / 25.4).toFixed(3);
  return +mm.toFixed(2);
};

const toMm = (val: number, unit: string) => {
  if (unit === "cm") return val * 10;
  if (unit === "in") return val * 25.4;
  return val;
};

interface NumberControlProps {
  label: string;
  value_mm: number;
  unit: string;
  min_mm: number;
  max_mm: number;
  step: number;
  onChange: (val: number) => void;
}

const NumberControl: React.FC<NumberControlProps> = ({ 
  label, 
  value_mm, 
  unit, 
  min_mm, 
  max_mm, 
  step, 
  onChange 
}) => {
  const [localVal, setLocalVal] = useState(toUnit(value_mm, unit).toString());
  
  useEffect(() => { 
    setLocalVal(toUnit(value_mm, unit).toString()); 
  }, [value_mm, unit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const mm_val = toMm(parsed, unit);
      if (mm_val >= min_mm && mm_val <= max_mm) {
        onChange(mm_val);
      }
    }
  };

  const handleInc = () => {
    const parsed = parseFloat(localVal) || 0;
    const newVal = parseFloat((parsed + step).toFixed(3));
    const mm_val = Math.round(toMm(newVal, unit) * 1000) / 1000;
    if (mm_val <= max_mm) {
      setLocalVal(newVal.toString()); 
      onChange(mm_val);
    }
  };

  const handleDec = () => {
    const parsed = parseFloat(localVal) || 0;
    const newVal = parseFloat((parsed - step).toFixed(3));
    const mm_val = Math.round(toMm(newVal, unit) * 1000) / 1000;
    if (mm_val >= min_mm) {
      setLocalVal(newVal.toString()); 
      onChange(mm_val);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-300 block">{label}</label>
      <div className="flex items-center space-x-1.5">
        <button 
          type="button"
          onClick={handleDec} 
          className="w-7 h-7 shrink-0 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors text-xs"
        >
          -
        </button>
        <div className="flex-1 min-w-0 flex items-center bg-[#131720] border border-[#2E3648] rounded px-2 py-1">
          <input 
            type="number" 
            value={localVal} 
            onChange={handleChange}
            className="w-full text-xs bg-transparent text-center text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none font-mono"
          />
          <span className="text-[10px] text-slate-400 ml-1 shrink-0">{unit}</span>
        </div>
        <button 
          type="button"
          onClick={handleInc} 
          className="w-7 h-7 shrink-0 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors text-xs"
        >
          +
        </button>
      </div>
    </div>
  );
};

interface ImposingItem {
  file_id: string;
  name: string;
  w: number;
  h: number;
  copies: number;
  ratio: number;
  locked: boolean;
  origW: number;
  origH: number;
  scale: number;
}

interface PreviewBox {
  x: number;
  y: number;
  w: number;
  h: number;
  thumb?: string;
  rotated?: boolean;
}

interface PreviewPage {
  w: number;
  h: number;
  boxes: PreviewBox[];
}

interface PreviewResponse {
  success: boolean;
  error?: string;
  preview_pages: PreviewPage[];
  stats: {
    pages: number;
    total_length_m?: number;
    avg_efficiency: number;
  };
}

export default function ImposingStudio() {
  const [items, setItems] = useState<ImposingItem[]>([]);
  const [mode, setMode] = useState<"Sheet" | "Roll">("Sheet");
  const [unit, setUnit] = useState("mm");
  
  const [sheetW, setSheetW] = useState(320.0);
  const [sheetH, setSheetH] = useState(450.0);
  const [sheetPreset, setSheetPreset] = useState("320,450");
  
  const [margin, setMargin] = useState(10.0);
  const [gap, setGap] = useState(5.0);
  const [drawBorder, setDrawBorder] = useState(false);
  const [borderColor, setBorderColor] = useState("#000000");
  const [cropMarks, setCropMarks] = useState(false);
  const [align, setAlign] = useState("Left");
  const [autoRotateSheet, setAutoRotateSheet] = useState(true);

  const [dbSheets, setDbSheets] = useState<{name: string; width: number; height: number}[]>([]);
  const [dbRolls, setDbRolls] = useState<{name: string; width: number}[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sheets) setDbSheets(data.sheets);
        if (data.rolls) setDbRolls(data.rolls);
        if (data.imposing) {
          if (data.imposing.default_sheet_unit) setUnit(data.imposing.default_sheet_unit);
          if (data.imposing.default_margin !== undefined) setMargin(data.imposing.default_margin);
          if (data.imposing.default_gap !== undefined) setGap(data.imposing.default_gap);
          if (data.imposing.crop_marks !== undefined) setCropMarks(data.imposing.crop_marks);
          if (data.imposing.draw_border !== undefined) setDrawBorder(data.imposing.draw_border);
          if (data.imposing.auto_rotate_sheet !== undefined) setAutoRotateSheet(data.imposing.auto_rotate_sheet);
        }
      })
      .catch(() => {});
  }, []);

  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  
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

  const handleMouseUp = () => { setIsDragging(false); };
  const handleMouseLeave = () => { setIsDragging(false); };
  
  useEffect(() => {
    if (previewData && previewData.preview_pages && previewData.preview_pages[currentPage]) {
      const w = previewData.preview_pages[currentPage].w;
      const h = previewData.preview_pages[currentPage].h;
      const initScale = Math.min(1, 560 / h, 560 / w);
      setScale(initScale);
      setPosition({ x: 0, y: 0 });
    }
  }, [previewData, currentPage]);

  useEffect(() => {
    if (sheetPreset === "custom") return;
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
    const file = e.target.files[0];
    
    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => [
          ...prev, 
          { 
            file_id: data.file_id, 
            name: data.name, 
            w: data.w, 
            h: data.h, 
            copies: 1, 
            ratio: data.w / data.h, 
            locked: true, 
            origW: data.w, 
            origH: data.h, 
            scale: 100 
          }
        ]);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to upload file to imposing server.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const updateItemCopies = (idx: number, copies: number) => {
    const newItems = [...items];
    newItems[idx].copies = copies;
    setItems(newItems);
  };

  const scaleItem = (idx: number, scalePct: number) => {
    const newItems = [...items];
    const it = newItems[idx];
    it.scale = scalePct;
    it.w = it.origW * (scalePct / 100);
    it.h = it.origH * (scalePct / 100);
    setItems(newItems);
  };
  
  const updateItemSize = (idx: number, field: "w" | "h", valUnit: number) => {
    const newItems = [...items];
    const it = newItems[idx];
    const mmVal = toMm(valUnit, unit);
    if (field === "w") {
      it.w = mmVal;
      if (it.locked) it.h = mmVal / it.ratio;
    } else {
      it.h = mmVal;
      if (it.locked) it.w = mmVal * it.ratio;
    }
    it.scale = (it.w / it.origW) * 100;
    setItems(newItems);
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
    if (items.length === 0) return;
    setIsPreviewing(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, 
          mode, 
          sheet_w: sheetW, 
          sheet_h: sheetH, 
          margin, 
          gap, 
          draw_border: drawBorder, 
          border_color: borderColor, 
          crop_marks: cropMarks, 
          align, 
          auto_rotate_sheet: autoRotateSheet
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
  }, [items, mode, sheetW, sheetH, margin, gap, drawBorder, borderColor, cropMarks, align, autoRotateSheet]);

  const handleExport = async () => {
    if (items.length === 0) return;
    setIsExporting(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/imposing/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, 
          mode, 
          sheet_w: sheetW, 
          sheet_h: sheetH, 
          margin, 
          gap, 
          draw_border: drawBorder, 
          border_color: borderColor, 
          crop_marks: cropMarks, 
          align, 
          auto_rotate_sheet: autoRotateSheet
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
  }, [items, mode, sheetW, sheetH, margin, gap, align, drawBorder, borderColor, cropMarks, autoRotateSheet, handlePreview]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#242A38]">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <span>Imposing Studio</span>
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
              N-Up Gang Run
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            High-efficiency auto-nesting layout engine for offset press sheets and wide-format rolls.
          </p>
        </div>

        <button 
          onClick={handleExport}
          disabled={items.length === 0 || isExporting}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-40"
        >
          {isExporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
          <span>Export Print PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#242A38]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <SlidersHorizontal size={14} className="text-emerald-400" />
                <span>Target Press Media</span>
              </span>
              <select 
                value={unit} 
                onChange={(e) => setUnit(e.target.value)} 
                className="text-xs bg-[#131720] border border-[#2E3648] text-slate-300 rounded px-2 py-0.5 outline-none font-medium"
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">inch</option>
              </select>
            </div>
            
            {/* Sheet vs Roll Toggle */}
            <div className="flex space-x-1 p-1 bg-[#131720] rounded-lg border border-[#2E3648]">
              <button 
                type="button"
                className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${
                  mode === "Sheet" 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => { setMode("Sheet"); setSheetPreset("320,450"); }}
              >
                Cut Sheet
              </button>
              <button 
                type="button"
                className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${
                  mode === "Roll" 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => { setMode("Roll"); setSheetPreset("600"); }}
              >
                Continuous Roll
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Press Preset</label>
              <select 
                value={sheetPreset} 
                onChange={(e) => setSheetPreset(e.target.value)} 
                className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none"
              >
                {mode === "Sheet" ? (
                  <>
                    {(dbSheets.length > 0 ? dbSheets : [
                      { name: "A4", width: 210, height: 297 },
                      { name: "A3", width: 297, height: 420 },
                      { name: "SRA3", width: 320, height: 450 },
                      { name: "B2", width: 480, height: 650 }
                    ]).map((s, idx) => (
                      <option key={idx} value={`${s.width},${s.height}`}>
                        {s.name} ({s.width} × {s.height} mm)
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    {(dbRolls.length > 0 ? dbRolls : [
                      { name: "60cm Roll", width: 600 },
                      { name: "100cm Roll", width: 1000 },
                      { name: "160cm Wide Roll", width: 1600 }
                    ]).map((r, idx) => (
                      <option key={idx} value={`${r.width}`}>
                        {r.name} ({r.width} mm)
                      </option>
                    ))}
                  </>
                )}
                <option value="custom">Custom Dimensions...</option>
              </select>
              
              <div className="flex items-end gap-2 mt-3">
                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Width</label>
                  <input 
                    type="number" 
                    value={toUnit(sheetW, unit)} 
                    onChange={(e) => { 
                      setSheetPreset("custom"); 
                      setSheetW(toMm(parseFloat(e.target.value) || 1, unit)); 
                    }} 
                    className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-1.5 rounded-lg text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono" 
                  />
                </div>
                {mode === "Sheet" && (
                  <button 
                    type="button"
                    onClick={() => { setSheetPreset("custom"); setSheetW(sheetH); setSheetH(sheetW); }} 
                    className="p-2 mb-0.5 bg-[#232936] hover:bg-[#2E3648] rounded-lg text-slate-300 transition-colors" 
                    title="Rotate Sheet 90° (Swap W/H)"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                )}
                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    {mode === "Sheet" ? "Height" : "Max Roll Seg."}
                  </label>
                  <input 
                    type="number" 
                    value={toUnit(sheetH, unit)} 
                    onChange={(e) => { 
                      setSheetPreset("custom"); 
                      setSheetH(toMm(parseFloat(e.target.value) || 1, unit)); 
                    }} 
                    className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-1.5 rounded-lg text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#242A38] space-y-3">
              <NumberControl 
                label={`Gripper Margin (${unit})`} 
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
            
            <div className="pt-2 border-t border-[#242A38] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Row Alignment</label>
                <select 
                  value={align} 
                  onChange={(e) => setAlign(e.target.value)} 
                  className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-1.5 rounded-lg outline-none"
                >
                  <option value="Left">Left Align</option>
                  <option value="Center">Center Gutter</option>
                  <option value="Right">Right Align</option>
                </select>
              </div>
              
              {mode === "Sheet" && (
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoRotateSheet} 
                    onChange={(e) => setAutoRotateSheet(e.target.checked)} 
                    className="rounded bg-[#131720] border-[#2E3648] text-emerald-500 focus:ring-emerald-500" 
                  />
                  <span className="text-xs font-medium text-slate-300">Auto-Rotate Sheet for Max Yield</span>
                </label>
              )}
              
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={cropMarks} 
                  onChange={(e) => setCropMarks(e.target.checked)} 
                  className="rounded bg-[#131720] border-[#2E3648] text-emerald-500 focus:ring-emerald-500" 
                />
                <span className="text-xs font-medium text-slate-300">Add Prepress Corner Crop Marks</span>
              </label>

              <div>
                <label className="flex items-center space-x-2.5 cursor-pointer mb-2">
                  <input 
                    type="checkbox" 
                    checked={drawBorder} 
                    onChange={(e) => setDrawBorder(e.target.checked)} 
                    className="rounded bg-[#131720] border-[#2E3648] text-emerald-500 focus:ring-emerald-500" 
                  />
                  <span className="text-xs font-medium text-slate-300">Draw Cut Outline Border</span>
                </label>
                {drawBorder && (
                  <div className="flex items-center space-x-2 ml-5">
                    <input 
                      type="color" 
                      value={borderColor} 
                      onChange={(e) => setBorderColor(e.target.value)} 
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer" 
                    />
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{borderColor}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Artwork Items Queue */}
          <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#242A38]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Imposition Queue ({items.length})
              </span>
            </div>
            
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 bg-[#131720] border border-[#2E3648] rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-start pr-6">
                    <p className="text-xs font-semibold text-slate-200 truncate" title={it.name}>
                      {it.name}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeItem(idx)} 
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="w-14 shrink-0 flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">% Scale</label>
                      <input 
                        type="number" 
                        value={Math.round(it.scale || 100)} 
                        onChange={(e) => scaleItem(idx, parseFloat(e.target.value) || 100)} 
                        className="w-full text-xs bg-[#1A202C] border border-[#2E3648] p-1 rounded text-emerald-400 font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      />
                    </div>
                    <div className="flex-1 flex flex-col pl-1 min-w-0">
                      <div className="text-[10px] text-slate-400 w-full flex justify-between items-center mb-0.5">
                        <span>W</span>
                        <button 
                          type="button"
                          onClick={() => toggleLock(idx)} 
                          className={`px-1 rounded flex items-center hover:bg-[#232936] transition-colors ${
                            it.locked ? "text-emerald-400" : "text-slate-500"
                          }`}
                        >
                          {it.locked ? <LinkIcon size={11}/> : <Unlink size={11}/>}
                        </button>
                        <span>H</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input 
                          type="number" 
                          value={toUnit(it.w, unit)} 
                          onChange={(e) => { updateItemSize(idx, "w", parseFloat(e.target.value) || 1); }} 
                          className="w-full text-xs bg-[#1A202C] border border-[#2E3648] p-1 rounded text-slate-200 text-center font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                        <span className="text-slate-500 text-xs shrink-0">×</span>
                        <input 
                          type="number" 
                          value={toUnit(it.h, unit)} 
                          onChange={(e) => { updateItemSize(idx, "h", parseFloat(e.target.value) || 1); }} 
                          className="w-full text-xs bg-[#1A202C] border border-[#2E3648] p-1 rounded text-slate-200 text-center font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-[#242A38]">
                    <label className="text-[11px] font-semibold text-slate-300">Run Copies:</label>
                    <input 
                      type="number" 
                      min="1"
                      value={it.copies} 
                      onChange={(e) => updateItemCopies(idx, parseInt(e.target.value) || 1)}
                      className="w-20 text-xs font-mono font-bold bg-[#1A202C] border border-[#2E3648] text-white p-1 rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="cursor-pointer block text-center py-3 px-4 border-2 border-dashed border-[#2E3648] hover:border-emerald-500/50 rounded-lg hover:bg-[#131720] transition-colors bg-[#131720]/40">
                {isUploading ? (
                  <Loader2 className="animate-spin inline mr-2 text-emerald-400" size={16} />
                ) : (
                  <Upload className="inline mr-2 text-emerald-400" size={16} />
                )}
                <span className="text-xs font-semibold text-slate-300">Add Artwork to Gang Run</span>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Live Sheet Viewport */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          {/* Efficiency HUD Pill */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                Output Production
              </span>
              <span className="text-lg font-extrabold text-white">
                {previewData ? (mode === "Sheet" ? `${previewData.stats.pages} Sheet${previewData.stats.pages > 1 ? "s" : ""}` : `${previewData.stats.total_length_m}m Length`) : "—"}
              </span>
            </div>

            <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                Sheet Utilization
              </span>
              <span className="text-lg font-extrabold text-emerald-400">
                {previewData ? `${previewData.stats.avg_efficiency}%` : "—"}
              </span>
            </div>

            <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                Waste Margin
              </span>
              <span className="text-lg font-extrabold text-slate-300">
                {previewData ? `${(100 - previewData.stats.avg_efficiency).toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">
              {error}
            </div>
          )}

          <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex-1 flex flex-col overflow-hidden min-h-[580px] shadow-sm relative">
            {/* Viewport Toolbar */}
            <div className="p-3 border-b border-[#242A38] flex justify-between items-center bg-[#141822]">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-300">Live Press Sheet View</span>
                {isPreviewing && (
                  <span className="text-xs text-emerald-400 flex items-center font-medium">
                    <Loader2 className="animate-spin mr-1.5" size={13} />
                    Calculating N-Up Layout...
                  </span>
                )}
              </div>
              
              {previewData && previewData.preview_pages && previewData.preview_pages.length > 1 && (
                <div className="flex items-center space-x-2 bg-[#1A202C] rounded-lg border border-[#2E3648] px-2 py-1">
                  <button 
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14}/>
                  </button>
                  <span className="text-xs font-mono font-semibold text-white whitespace-nowrap">
                    Sheet {currentPage + 1} / {previewData.preview_pages.length}
                  </span>
                  <button 
                    type="button"
                    disabled={currentPage >= previewData.preview_pages.length - 1}
                    onClick={() => setCurrentPage((p) => Math.min(previewData.preview_pages.length - 1, p + 1))}
                    className="p-1 hover:bg-[#2E3648] rounded text-slate-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14}/>
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
                <div className="text-slate-400 flex flex-col items-center">
                  <SlidersHorizontal size={44} className="mb-3 opacity-30 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-300">Add artwork items to generate imposition</p>
                  <p className="text-xs text-slate-400 mt-1">Real-time dynamic nesting & gap preview</p>
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
                  {previewData.preview_pages[currentPage].boxes.map((box, i) => (
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
                        <>
                          <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", top: "0" }} />
                          <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", top: "-6px" }} />
                          <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", top: "0" }} />
                          <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", top: "-6px" }} />
                          <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", bottom: "0" }} />
                          <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", bottom: "-6px" }} />
                          <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", bottom: "0" }} />
                          <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", bottom: "-6px" }} />
                        </>
                      )}
                      
                      <div 
                        className="absolute inset-0 shadow-sm flex items-center justify-center overflow-hidden bg-slate-50 pointer-events-auto"
                        style={{
                          border: drawBorder ? `1px solid ${borderColor}` : "1px solid #10b981"
                        }}
                      >
                        {box.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={`${API_BASE_URL}/temp_uploads/${box.thumb}`} 
                            className="w-full h-full object-contain"
                            style={{ transform: box.rotated ? "rotate(90deg)" : "none" }}
                            alt="thumb" 
                          />
                        ) : (
                          <span className="text-[8px] text-emerald-700 font-medium rotate-45 opacity-60">Item</span>
                        )}
                      </div>
                    </div>
                  ))}
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
                    if (previewData && previewData.preview_pages && previewData.preview_pages[currentPage]) {
                      const w = previewData.preview_pages[currentPage].w;
                      const h = previewData.preview_pages[currentPage].h;
                      setScale(Math.min(1, 560 / h, 560 / w));
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
