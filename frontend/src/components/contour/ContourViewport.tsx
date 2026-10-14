"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scissors,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
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
  setArtworkOpacity,
}: ContourViewportProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
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
    <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex-1 flex flex-col overflow-hidden min-h-[720px] h-full shadow-sm relative">
      {/* Canvas Toolbar */}
      <div className="p-2.5 border-b border-[#242A38] flex justify-between items-center bg-[#141822]">
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
              .canvas-svg-container > svg { width: 100% !important; height: 100% !important; max-height: 78vh; pointer-events: none; }
            `}</style>
            <div
              dangerouslySetInnerHTML={{ __html: svgContent }}
              className="canvas-svg-container w-full h-full object-contain"
              style={{ maxHeight: "78vh" }}
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
  );
}
