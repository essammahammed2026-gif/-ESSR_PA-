"use client";

import { useState, useEffect, useRef } from "react";
import { Grid, Upload, Download, Loader2, Trash2, Link, Unlink, ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";

// Reusable Number Control

const toUnit = (mm: number, unit: string) => {
  if (unit === 'cm') return +(mm / 10).toFixed(2);
  if (unit === 'in') return +(mm / 25.4).toFixed(3);
  return +(mm).toFixed(2);
};
const toMm = (val: number, unit: string) => {
  if (unit === 'cm') return val * 10;
  if (unit === 'in') return val * 25.4;
  return val;
};

const NumberControl = ({ label, value_mm, unit, min_mm, max_mm, step, onChange }: any) => {
  const [localVal, setLocalVal] = useState(toUnit(value_mm, unit).toString());
  
  useEffect(() => { setLocalVal(toUnit(value_mm, unit).toString()); }, [value_mm, unit]);

  const handleChange = (e: any) => {
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
    const newVal = parseFloat((parsed + parseFloat(step)).toFixed(3));
    const mm_val = Math.round(toMm(newVal, unit) * 1000) / 1000;
    if (mm_val <= max_mm) {
      setLocalVal(newVal.toString()); onChange(mm_val);
    }
  };
  const handleDec = () => {
    const parsed = parseFloat(localVal) || 0;
    const newVal = parseFloat((parsed - parseFloat(step)).toFixed(3));
    const mm_val = Math.round(toMm(newVal, unit) * 1000) / 1000;
    if (mm_val >= min_mm) {
      setLocalVal(newVal.toString()); onChange(mm_val);
    }
  };

  return (
    <div className="mb-3">
      <label className="text-sm font-medium block mb-1">{label}</label>
      <div className="flex items-center space-x-2">
        <button onClick={handleDec} className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold transition-colors">-</button>
        <input 
          type="number" value={localVal} onChange={handleChange}
          className="flex-1 min-w-0 text-sm border p-1.5 rounded-lg text-center dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button onClick={handleInc} className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold transition-colors">+</button>
      </div>
    </div>
  );
};

export default function ImposingStudio() {
  const [items, setItems] = useState<any[]>([]);
  const [mode, setMode] = useState("Sheet");
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

  // Dynamic presets from settings API
  const [dbSheets, setDbSheets] = useState<{name: string, width: number, height: number}[]>([]);
  const [dbRolls, setDbRolls] = useState<{name: string, width: number}[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/settings")
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
  
  const [previewData, setPreviewData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  
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

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleMouseDown = (e: any) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: any) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => { setIsDragging(false); };
  const handleMouseLeave = () => { setIsDragging(false); };
  
  // Fit to screen when new preview generates
  useEffect(() => {
    if (previewData && previewData.preview_pages && previewData.preview_pages[currentPage]) {
       const w = previewData.preview_pages[currentPage].w;
       const h = previewData.preview_pages[currentPage].h;
       // initial fit
       const initScale = Math.min(1, 600 / h, 600 / w);
       setScale(initScale);
       setPosition({ x: 0, y: 0 });
    }
  }, [previewData, currentPage]);

  const [error, setError] = useState<string|null>(null);

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
      // In Roll mode, do not override sheetH. It will act as the max segment length limit.
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
      const res = await fetch("http://localhost:8000/api/imposing/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setItems([...items, { file_id: data.file_id, name: data.name, w: data.w, h: data.h, copies: 1, ratio: data.w/data.h, locked: true, origW: data.w, origH: data.h, scale: 100 }]);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Failed to upload file");
    } finally {
      setIsUploading(false);
      e.target.value = '';
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
  
  const updateItemSize = (idx: number, field: string, valUnit: number) => {
    const newItems = [...items];
    const it = newItems[idx];
    const mmVal = toMm(valUnit, unit);
    if (field === 'w') {
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

  const handlePreview = async () => {
    if (items.length === 0) return;
    setIsPreviewing(true);
    setError(null);
    
    try {
      const res = await fetch("http://localhost:8000/api/imposing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, mode, sheet_w: sheetW, sheet_h: sheetH, margin, gap, draw_border: drawBorder, border_color: borderColor, crop_marks: cropMarks, align, auto_rotate_sheet: autoRotateSheet
        })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
        setCurrentPage(0);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Failed to generate preview");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExport = async () => {
    if (items.length === 0) return;
    setIsExporting(true);
    setError(null);
    
    try {
      const res = await fetch("http://localhost:8000/api/imposing/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, mode, sheet_w: sheetW, sheet_h: sheetH, margin, gap, draw_border: drawBorder, border_color: borderColor, crop_marks: cropMarks, align, auto_rotate_sheet: autoRotateSheet
        })
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Imposed_${mode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Auto-refresh preview when settings change
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (items.length === 0) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { handlePreview(); }, 600);
    return () => { if (typingTimeout.current) clearTimeout(typingTimeout.current); };
  }, [items, mode, sheetW, sheetH, margin, gap, align, drawBorder, borderColor, cropMarks, autoRotateSheet]);


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-center space-x-3 pb-4 border-b dark:border-gray-700">
        <Grid className="text-purple-500" size={32} />
        <div>
          <h1 className="text-2xl font-bold">Imposing Studio</h1>
          <p className="text-sm text-gray-500">Step & Repeat auto-nesting for Sheets and Rolls.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-sm">Target Media</h3>
              <select value={unit} onChange={(e)=>setUnit(e.target.value)} className="text-xs border p-1 rounded bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 outline-none">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">inch</option>
              </select>
            </div>
            
            <div className="flex space-x-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
              <button 
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${mode === "Sheet" ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                onClick={() => { setMode("Sheet"); setSheetPreset("320,450"); }}
              >
                Sheet
              </button>
              <button 
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${mode === "Roll" ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                onClick={() => { setMode("Roll"); setSheetPreset("600"); }}
              >
                Roll
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Preset Size (mm)</label>
              <select 
                value={sheetPreset} 
                onChange={(e) => setSheetPreset(e.target.value)} 
                className="w-full text-sm border p-1.5 rounded-md dark:bg-gray-900 dark:border-gray-600"
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
                        {s.name} ({s.width} x {s.height} mm)
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
                        {r.name} ({r.width}mm)
                      </option>
                    ))}
                  </>
                )}
                <option value="custom">Custom Size...</option>
              </select>
              
              <div className="flex items-end gap-2 mt-3">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Width</label>
                  <input type="number" value={toUnit(sheetW, unit)} onChange={(e) => { setSheetPreset("custom"); setSheetW(toMm(parseFloat(e.target.value)||1, unit)); }} className="w-full min-w-0 text-sm border p-1.5 rounded-lg dark:bg-gray-900 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                {mode === "Sheet" && (
                  <button onClick={() => { setSheetPreset("custom"); setSheetW(sheetH); setSheetH(sheetW); }} className="p-2 mb-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors" title="Swap W/H">
                    <ArrowRightLeft size={16} />
                  </button>
                )}
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">
                    {mode === "Sheet" ? "Height" : "Max Roll Length"}
                  </label>
                  <input type="number" value={toUnit(sheetH, unit)} onChange={(e) => { setSheetPreset("custom"); setSheetH(toMm(parseFloat(e.target.value)||1, unit)); }} className="w-full min-w-0 text-sm border p-1.5 rounded-lg dark:bg-gray-900 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              </div>
            </div>

            <NumberControl label={`Margin (${unit})`} value_mm={margin} unit={unit} min_mm={0} max_mm={100} step={unit==="cm"?0.25:unit==="in"?0.1:2.5} onChange={setMargin} />
            <NumberControl label={`Gap (${unit})`} value_mm={gap} unit={unit} min_mm={0} max_mm={50} step={unit==="cm"?0.25:unit==="in"?0.1:2.5} onChange={setGap} />
            
            <div className="pt-3 border-t dark:border-gray-700 space-y-3">
              
              <div>
                <label className="block text-xs font-medium mb-1">Alignment</label>
                <select value={align} onChange={(e) => setAlign(e.target.value)} className="w-full text-sm border p-1.5 rounded-md dark:bg-gray-900 dark:border-gray-600">
                  <option value="Left">Left</option>
                  <option value="Center">Center</option>
                  <option value="Right">Right</option>
                </select>
              </div>
              
              {mode === "Sheet" && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={autoRotateSheet} onChange={(e) => setAutoRotateSheet(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm font-medium">Auto-Rotate Sheet (Fit More)</span>
                </label>
              )}
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
                <span className="text-sm font-medium">Add Crop Marks</span>
              </label>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={drawBorder} onChange={(e) => setDrawBorder(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm font-medium">Draw Item Border</span>
                </label>
                {drawBorder && (
                  <div className="flex items-center space-x-2 ml-6">
                    <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500 font-mono uppercase">{borderColor}</span>
                  </div>
                )}
              </div>
            </div>
            
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="font-bold text-sm">Artwork Items</h3>
            
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-start pr-6">
                    <p className="text-xs font-semibold truncate" title={it.name}>{it.name}</p>
                  </div>
                  <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                  
                  <div className="flex items-center space-x-2 mt-3">
                    <div className="w-14 shrink-0 flex flex-col">
                      <label className="text-[10px] text-gray-500 mb-1">% Scale</label>
                      <input type="number" value={Math.round(it.scale || 100)} onChange={(e) => scaleItem(idx, parseFloat(e.target.value) || 100)} className="w-full min-w-0 text-xs border p-1.5 rounded-md bg-purple-50 text-purple-700 font-semibold dark:bg-purple-900/30 dark:border-purple-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <div className="flex-1 flex flex-col pl-1 min-w-0">
                      <label className="text-[10px] text-gray-500 w-full flex justify-between mb-1">
                        <span>W</span>
                        <button onClick={() => toggleLock(idx)} className={`px-1 rounded flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${it.locked ? 'text-purple-600' : 'text-gray-400'}`}>{it.locked ? <Link size={12}/> : <Unlink size={12}/>}</button>
                        <span>H</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <input type="number" value={toUnit(it.w, unit)} onChange={(e) => { updateItemSize(idx, 'w', parseFloat(e.target.value) || 1); }} className="w-full min-w-0 text-xs border p-1.5 rounded-md dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="text-gray-400 text-xs shrink-0">×</span>
                        <input type="number" value={toUnit(it.h, unit)} onChange={(e) => { updateItemSize(idx, 'h', parseFloat(e.target.value) || 1); }} className="w-full min-w-0 text-xs border p-1.5 rounded-md dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-3 pt-3 border-t dark:border-gray-700">
                    <label className="text-xs font-semibold mr-3 shrink-0">Copies:</label>
                    <input 
                      type="number" 
                      value={it.copies} 
                      onChange={(e) => updateItemCopies(idx, parseInt(e.target.value) || 1)}
                      className="w-full min-w-0 text-sm font-semibold border p-1.5 rounded-md dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="cursor-pointer block text-center py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                {isUploading ? <Loader2 className="animate-spin inline mr-2" size={16}/> : <Upload className="inline mr-2" size={16}/>}
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Add PDF or Image</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
              </label>
            </div>
          </div>
          
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col items-center">
              <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Output Size</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {previewData ? (mode === "Sheet" ? `${previewData.stats.pages} Pages` : `${previewData.stats.total_length_m}m Length`) : "-"}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col items-center">
              <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Efficiency</span>
              <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {previewData ? `${previewData.stats.avg_efficiency}%` : "-"}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex items-center justify-center">
              <button 
                onClick={handleExport}
                disabled={items.length === 0 || isExporting}
                className="w-full h-full bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center space-x-2 hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isExporting ? <Loader2 className="animate-spin" size={20}/> : <Download size={20}/>}
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[600px]">
            <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-sm">Layout Preview</h3>
                {isPreviewing && <span className="text-xs text-purple-500 flex items-center"><Loader2 className="animate-spin mr-1" size={14}/> Calculating...</span>}
              </div>
              
              {previewData && previewData.preview_pages && previewData.preview_pages.length > 1 && (
                <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 px-2 py-1 shadow-sm">
                  <button 
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 transition-colors"
                  ><ChevronLeft size={16}/></button>
                  <span className="text-xs font-semibold whitespace-nowrap">Page {currentPage + 1} of {previewData.preview_pages.length}</span>
                  <button 
                    disabled={currentPage >= previewData.preview_pages.length - 1}
                    onClick={() => setCurrentPage(Math.min(previewData.preview_pages.length - 1, currentPage + 1))}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 transition-colors"
                  ><ChevronRight size={16}/></button>
                </div>
              )}
            </div>
            
            <div 
              ref={canvasRef}
              className="flex-1 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              
              {!previewData && (
                <div className="text-gray-400 flex flex-col items-center">
                  <Grid size={48} className="mb-4 opacity-30" />
                  <p>Add artworks to preview imposition layout.</p>
                </div>
              )}
              
              {previewData && previewData.preview_pages && previewData.preview_pages[currentPage] && (
                <div 
                  className="bg-white shadow-xl relative"
                  style={{ 
                    width: `${previewData.preview_pages[currentPage].w}px`, 
                    height: `${previewData.preview_pages[currentPage].h}px`,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.05s ease-out"
                  }}
                >
                  <div className="absolute border border-red-300 border-dashed" style={{
                    top: `${margin}px`, left: `${margin}px`,
                    right: `${margin}px`, bottom: `${margin}px`,
                  }}/>

                  {previewData.preview_pages[currentPage].boxes.map((box: any, i: number) => (
                    <div key={i} className="absolute pointer-events-none" style={{ left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` }}>
                      {cropMarks && (
                        <>
                          <div className="absolute bg-gray-400" style={{ width: '4px', height: '1px', left: '-5px', top: '0' }} />
                          <div className="absolute bg-gray-400" style={{ width: '1px', height: '4px', left: '0', top: '-5px' }} />
                          <div className="absolute bg-gray-400" style={{ width: '4px', height: '1px', right: '-5px', top: '0' }} />
                          <div className="absolute bg-gray-400" style={{ width: '1px', height: '4px', right: '0', top: '-5px' }} />
                          <div className="absolute bg-gray-400" style={{ width: '4px', height: '1px', left: '-5px', bottom: '0' }} />
                          <div className="absolute bg-gray-400" style={{ width: '1px', height: '4px', left: '0', bottom: '-5px' }} />
                          <div className="absolute bg-gray-400" style={{ width: '4px', height: '1px', right: '-5px', bottom: '0' }} />
                          <div className="absolute bg-gray-400" style={{ width: '1px', height: '4px', right: '0', bottom: '-5px' }} />
                        </>
                      )}
                    <div 
                      className="absolute inset-0 shadow-sm flex items-center justify-center overflow-hidden bg-white pointer-events-auto"
                      style={{
                        border: drawBorder ? `1px solid ${borderColor}` : '1px solid #d8b4fe'
                      }}
                    >
                      {box.thumb ? (
                        <img 
                          src={`http://localhost:8000/temp_uploads/${box.thumb}`} 
                          className="w-full h-full object-contain"
                          style={{ transform: box.rotated ? 'rotate(90deg)' : 'none' }}
                          alt="thumb" 
                        />
                      ) : (
                        <span className="text-[8px] text-purple-700 font-medium rotate-45 opacity-50">Item</span>
                      )}
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
