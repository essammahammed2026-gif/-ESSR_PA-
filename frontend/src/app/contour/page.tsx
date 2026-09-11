"use client";

import { useState, useEffect, useRef } from "react";
import { Scissors, Upload, Download, Loader2, Sparkles } from "lucide-react";

const PRESET_COLORS = [
  { name: "CutContour (Magenta)", value: "#FF00FF" },
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#00FF00" },
  { name: "Blue", value: "#0000FF" },
  { name: "Black", value: "#000000" },
];

const NumberControl = ({ label, value, min, max, step, onChange }: any) => {
  const handleDec = () => onChange(String(Math.max(Number(min), Number(value) - Number(step))));
  const handleInc = () => onChange(String(Math.min(Number(max), Number(value) + Number(step))));
  
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center space-x-1">
          <button onClick={handleDec} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold">-</button>
          <input 
            type="number" min={min} max={max} step={step} 
            value={value} onChange={(e) => onChange(e.target.value)} 
            className="w-14 text-sm border p-0.5 rounded-md text-center dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button onClick={handleInc} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold">+</button>
        </div>
      </div>
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} onChange={(e) => onChange(e.target.value)} 
        className="w-full accent-pink-500"
      />
    </div>
  );
};

export default function ContourStudio() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings
    const [offsetVal, setOffsetVal] = useState("0");
  const [threshold, setThreshold] = useState("20");
  const [smoothing, setSmoothing] = useState("2");
  const [keepHoles, setKeepHoles] = useState(false);
  const [addWhiteMatte, setAddWhiteMatte] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FF00FF");
  
  // UI Only Controls
  const [artworkOpacity, setArtworkOpacity] = useState("100");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevents the whole web page from scrolling!
      
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsGenerating(true);
    setError(null);
    setSvgContent(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/contour/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setFileId(data.file_id);
        // Trigger first generation
        generateContour(data.file_id, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
      } else {
        setError(data.error);
        setIsGenerating(false);
      }
    } catch (err: any) {
      setError("Failed to upload file");
      setIsGenerating(false);
    }
  };

  const generateContour = async (
    id: string, offset: string, 
    thresh: string, smooth: string, holes: boolean, matte: boolean, color: string
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
      const res = await fetch("http://localhost:8000/api/contour/generate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSvgContent(data.svg);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Failed to generate contour");
    } finally {
      setIsGenerating(false);
    }
  };

  // Debounce settings changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!fileId) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    
    typingTimeout.current = setTimeout(() => {
      generateContour(fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
    }, 400);

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor]);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cut_contour.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-center space-x-3 pb-4 border-b dark:border-gray-700">
        <Scissors className="text-pink-500" size={32} />
        <div>
          <h1 className="text-2xl font-bold">Contour Cut Studio</h1>
          <p className="text-sm text-gray-500">Generate flawless plotter-ready cut lines with physical scaling.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border dark:border-gray-700 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">Upload Artwork</label>
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="w-full text-sm border p-2 rounded-md" />
            </div>

            

            <NumberControl label="Offset (mm)" value={offsetVal} min="-10" max="10" step="0.5" onChange={setOffsetVal} />

            <NumberControl label="Edge Smoothing (0-15)" value={smoothing} min="0" max="15" step="1" onChange={setSmoothing} />
            
            <NumberControl label="Tolerance" value={threshold} min="0" max="100" step="1" onChange={setThreshold} />
            
            <div className="pt-4 border-t dark:border-gray-700">
              <label className="block text-sm font-medium mb-2">Stroke Color</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map(c => (
                  <button 
                    key={c.value} 
                    title={c.name}
                    onClick={() => setStrokeColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 ${strokeColor === c.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-110'} transition-transform shadow-sm`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <div title="Custom Color" className="relative w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer hover:scale-110 transition-transform shadow-sm flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <input 
                    type="color" 
                    value={strokeColor} 
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0"
                  />
                  <span className="text-[10px] font-bold">+</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono">{strokeColor.toUpperCase()}</div>
            </div>

            <div className="pt-4 border-t dark:border-gray-700 space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={keepHoles} onChange={(e) => setKeepHoles(e.target.checked)} className="rounded text-pink-500 focus:ring-pink-500" />
                <span className="text-sm font-medium">Keep Internal Holes</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={addWhiteMatte} onChange={(e) => setAddWhiteMatte(e.target.checked)} className="rounded text-pink-500 focus:ring-pink-500" />
                <span className="text-sm font-medium">Add White Matte Base</span>
              </label>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-3 flex flex-col">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[600px]">
            <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center space-x-4">
                <h3 className="font-medium text-sm">Interactive Canvas</h3>
                {isGenerating && <span className="text-xs text-pink-500 flex items-center"><Loader2 className="animate-spin mr-1" size={14}/> Tracing...</span>}
              </div>
              
              <div className="flex items-center space-x-4">
                <button onClick={() => { setScale(1); setPosition({x:0, y:0}); }} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 mr-4">Reset View</button>
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-medium text-gray-500">Artwork Opacity:</label>
                  <input 
                    type="range" min="0" max="100" 
                    value={artworkOpacity} onChange={(e) => setArtworkOpacity(e.target.value)} 
                    className="w-24 accent-gray-500"
                  />
                </div>
                <button 
                  onClick={handleDownload}
                  disabled={!svgContent}
                  className="px-4 py-1.5 bg-pink-600 text-white rounded-md text-sm font-medium flex items-center space-x-2 hover:bg-pink-700 transition-colors disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>Download SVG</span>
                </button>
              </div>
            </div>
            
            <div 
              ref={canvasRef}
              className="flex-1 bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-8 overflow-hidden relative cursor-grab active:cursor-grabbing"
              
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {!svgContent && !isGenerating && (
                <div className="text-gray-400 flex flex-col items-center">
                  <Scissors size={48} className="mb-4 opacity-30" />
                  <p>Upload a file to generate cut lines.</p>
                </div>
              )}
              
              {svgContent && (
                <div 
                  className="drop-shadow-2xl transition-opacity duration-200"
                  style={{ 
                    opacity: isGenerating ? 0.5 : 1,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: 'center',
                    willChange: 'transform',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                >
                  {/* We use dangerouslySetInnerHTML to render the SVG directly. 
                      We inject a CSS style string to control the #Artwork opacity dynamically without server calls! */}
                  <style>{`#Artwork { opacity: ${Number(artworkOpacity) / 100}; transition: opacity 0.1s; } .canvas-svg-container > svg { width: 100% !important; height: 100% !important; max-height: 70vh; pointer-events: none; }`}</style>
                  <div dangerouslySetInnerHTML={{ __html: svgContent }} className="canvas-svg-container w-full h-full object-contain" style={{ maxHeight: '70vh' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
