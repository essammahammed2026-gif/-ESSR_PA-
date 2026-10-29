"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scissors,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
} from "lucide-react";

export interface ContourViewportProps {
  fileId: string | null;
  svgContent: string | null;
  isGenerating: boolean;
  artworkOpacity: string;
  setArtworkOpacity: React.Dispatch<React.SetStateAction<string>>;
}

export function ContourViewport({
  fileId,
  svgContent,
  isGenerating,
  artworkOpacity,
}: ContourViewportProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanMode, setIsPanMode] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  // Reset pan/zoom whenever a new artwork file is loaded (mirrors the
  // setScale(1)/setPosition reset previously done in the upload handler).
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [fileId]);

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

  const handleMouseUp = () => {
    setIsDragging(false);
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
    <div className="bg-[#14171F] flex-1 flex flex-col overflow-hidden h-full relative">
      {/* Minimal Borderless Top Toolbar: Hand Tool */}
      <div className="px-3 py-1.5 border-b border-[#1E232E] bg-[#14171F] flex items-center justify-center relative select-none z-20 shrink-0">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setIsPanMode((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isPanMode
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
            }`}
            title="Hand Tool (Drag to Pan Canvas)"
          >
            <Hand size={15} />
          </button>
        </div>

        {isGenerating && (
          <span className="absolute right-3 text-[11px] text-pink-400 flex items-center font-medium">
            <Loader2 className="animate-spin mr-1.5" size={12} />
            Tracing Die Lines...
          </span>
        )}
      </div>

      {/* Viewport Canvas */}
      <div
        ref={canvasRef}
        className={`flex-1 bg-[#14171F] flex items-center justify-center p-8 overflow-hidden relative select-none ${
          isPanMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
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
              .canvas-svg-container > svg { width: 100% !important; height: 100% !important; max-height: 78vh; pointer-events: none; }
            `}</style>
            <div
              dangerouslySetInnerHTML={{ __html: svgContent }}
              className="canvas-svg-container w-full h-full object-contain"
              style={{ maxHeight: "78vh" }}
            />
          </div>
        )}

        {/* Floating Bottom Pill HUD Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-[#14171F]/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#242A38] shadow-2xl z-10 text-xs select-none">
          <button
            type="button"
            onClick={() => handleZoom("out")}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={Math.min(400, Math.max(10, Math.round(scale * 100)))}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="w-24 h-1 bg-[#2B3242] rounded-lg appearance-none cursor-pointer accent-blue-500"
            title="Zoom Level"
          />
          <button
            type="button"
            onClick={() => handleZoom("in")}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleFitToViewport}
            className="px-1.5 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer min-w-[42px] text-center"
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleFitToViewport}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
