import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";

export const toUnit = (mm: number, unit: string) => {
  if (unit === "cm") return +(mm / 10).toFixed(2);
  if (unit === "in") return +(mm / 25.4).toFixed(3);
  return +mm.toFixed(2);
};

export const toMm = (val: number, unit: string) => {
  if (unit === "cm") return val * 10;
  if (unit === "in") return val * 25.4;
  return val;
};

export interface NumberControlProps {
  label: string;
  value_mm: number;
  unit: string;
  min_mm: number;
  max_mm: number;
  step: number;
  onChange: (val: number) => void;
}

export const NumberControl: React.FC<NumberControlProps> = ({ 
  label, value_mm, unit, min_mm, max_mm, step, onChange 
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

export const ArtworkColorPicker = ({ fileId, pageNum = 0, onSelect }: { fileId: string, pageNum?: number, onSelect: (color: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const ext = fileId.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') {
      img.src = `${API_BASE_URL}/api/imposing/thumbnail/${fileId}/${pageNum}`;
    } else {
      img.src = `${API_BASE_URL}/temp_uploads/${fileId}`;
    }
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  }, [fileId, pageNum]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = "#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    onSelect(hex);
  };

  return (
    <div className="cursor-crosshair border border-[#2E3648] rounded-lg hover:border-emerald-500 transition-colors bg-black/40 flex items-center justify-center p-2 w-full">
      <canvas ref={canvasRef} onClick={handleClick} className="max-w-full object-contain max-h-[60vh] rounded shadow-sm" />
    </div>
  );
};
