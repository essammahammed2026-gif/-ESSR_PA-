"use client";

import React from "react";
import { CropModuleConfig, SplitLine } from "@/types/book_studio";
import { groupSplitLines } from "@/lib/splitLines";

export interface PageCanvasProps {
  containerRef: { current: HTMLDivElement | null };
  overlayRef: { current: HTMLDivElement | null };
  imageSrc: string;
  imageAlt: string;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  showGrid: boolean;
  cropModule?: CropModuleConfig;
  splitLines: SplitLine[];
  hideCutLines?: boolean;
  currentCropHeightMm: number;
  currentCropWidthMm: number;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onImageLoad: (w: number, h: number) => void;
  onCropPointerDown: (handle: string, e: React.PointerEvent) => void;
  onCropPointerMove: (e: React.PointerEvent) => void;
  onCropPointerUp: (e: React.PointerEvent) => void;
}

export function PageCanvas({
  containerRef,
  overlayRef,
  imageSrc,
  imageAlt,
  zoom,
  pan,
  isPanning,
  showGrid,
  cropModule,
  splitLines,
  hideCutLines = false,
  currentCropHeightMm,
  currentCropWidthMm,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onImageLoad,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
}: PageCanvasProps) {
  const lines = hideCutLines ? [] : splitLines;
  const hasCutLines = lines.length > 0;
  const { vertical, horizontal } = groupSplitLines(lines);
  const singleVertical = vertical.length === 1 && horizontal.length === 0;
  const vSegs = [0, ...vertical, 1].slice(0, -1).map((s, i) =>
    Math.round(currentCropWidthMm * ([...vertical, 1][i] - s) * 10) / 10);
  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      className={`flex-1 overflow-hidden bg-[#0A0D14] flex items-center justify-center p-6 relative ${
        zoom > 1.0 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
      }`}
    >
      <div
        className="relative transition-transform duration-75 ease-out flex items-center justify-center max-w-full max-h-full"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          onLoad={(e) => onImageLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          className="max-h-[calc(100vh-14rem)] max-w-full object-contain rounded shadow-2xl transition-all duration-150 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] border border-slate-800"
          draggable={false}
        />
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none rounded border border-cyan-500/40 overflow-hidden shadow-inner"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(6, 182, 212, 0.35) 28px)",
              backgroundSize: "100% 28px",
            }}
          />
        )}
        {cropModule?.enabled && (
          <div
            ref={overlayRef}
            onPointerMove={onCropPointerMove}
            onPointerUp={onCropPointerUp}
            onPointerCancel={onCropPointerUp}
            className="absolute inset-0 select-none pointer-events-auto"
          >
            <div className="absolute top-0 left-0 right-0 bg-black/60 pointer-events-none" style={{ height: `${cropModule.cropBox.y1 * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-none" style={{ top: `${cropModule.cropBox.y2 * 100}%` }} />
            <div
              className="absolute left-0 bg-black/60 pointer-events-none"
              style={{ top: `${cropModule.cropBox.y1 * 100}%`, bottom: `${(1 - cropModule.cropBox.y2) * 100}%`, width: `${cropModule.cropBox.x1 * 100}%` }}
            />
            <div
              className="absolute right-0 bg-black/60 pointer-events-none"
              style={{ top: `${cropModule.cropBox.y1 * 100}%`, bottom: `${(1 - cropModule.cropBox.y2) * 100}%`, left: `${cropModule.cropBox.x2 * 100}%` }}
            />
            <div
              className="absolute border-2 border-dashed border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_0_15px_rgba(245,158,11,0.35)]"
              style={{
                top: `${cropModule.cropBox.y1 * 100}%`,
                left: `${cropModule.cropBox.x1 * 100}%`,
                width: `${(cropModule.cropBox.x2 - cropModule.cropBox.x1) * 100}%`,
                height: `${(cropModule.cropBox.y2 - cropModule.cropBox.y1) * 100}%`,
              }}
            >
              {singleVertical && (
                <>
                  <div className="absolute top-1.5 left-1.5 bg-slate-950/85 border border-amber-400/70 text-amber-300 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col">
                    <span className="text-amber-400 font-bold">P1 (LEFT)</span>
                    <div className="text-slate-100 font-bold text-[9px]">{vSegs[0]} × {currentCropHeightMm} mm</div>
                  </div>
                  <div className="absolute top-1.5 right-1.5 bg-slate-950/85 border border-amber-400/70 text-amber-300 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col items-end text-right">
                    <span className="text-amber-400 font-bold">P2 (RIGHT)</span>
                    <div className="text-slate-100 font-bold text-[9px]">{vSegs[1]} × {currentCropHeightMm} mm</div>
                  </div>
                </>
              )}
              <div onPointerDown={(e) => onCropPointerDown("nw", e)} className="absolute -top-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nwse-resize hover:scale-125 hover:bg-amber-300 transition-transform" title="Drag to resize top-left margin" />
              <div onPointerDown={(e) => onCropPointerDown("ne", e)} className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nesw-resize hover:scale-125 hover:bg-amber-300 transition-transform" title="Drag to resize top-right margin" />
              <div onPointerDown={(e) => onCropPointerDown("sw", e)} className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nesw-resize hover:scale-125 hover:bg-amber-300 transition-transform" title="Drag to resize bottom-left margin" />
              <div onPointerDown={(e) => onCropPointerDown("se", e)} className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-black rounded shadow-md cursor-nwse-resize hover:scale-125 hover:bg-amber-300 transition-transform" title="Drag to resize bottom-right margin" />
              <div onPointerDown={(e) => onCropPointerDown("n", e)} className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400 border-2 border-black rounded shadow-md cursor-ns-resize hover:scale-110 hover:bg-amber-300 transition-transform" title="Drag to resize top margin" />
              <div onPointerDown={(e) => onCropPointerDown("s", e)} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400 border-2 border-black rounded shadow-md cursor-ns-resize hover:scale-110 hover:bg-amber-300 transition-transform" title="Drag to resize bottom margin" />
              <div onPointerDown={(e) => onCropPointerDown("w", e)} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-amber-400 border-2 border-black rounded shadow-md cursor-ew-resize hover:scale-110 hover:bg-amber-300 transition-transform" title="Drag to resize left margin" />
              <div onPointerDown={(e) => onCropPointerDown("e", e)} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-amber-400 border-2 border-black rounded shadow-md cursor-ew-resize hover:scale-110 hover:bg-amber-300 transition-transform" title="Drag to resize right margin" />
              {hasCutLines && lines.map((line, i) => (
                line.direction === "horizontal" ? (
                  <div key={i} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${line.pos * 100}%` }}>
                    <div className="absolute left-0 right-0 -mt-[2px] h-[4px] bg-black/75 shadow-sm" />
                    <div className="absolute left-0 right-0 -mt-[1px] h-[2px] border-t-2 border-dashed border-amber-400 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" />
                    <div
                      onPointerDown={(e) => onCropPointerDown(`spine-${i}`, e)}
                      className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-black text-[11px] shadow-[0_4px_18px_rgba(0,0,0,0.85)] border-2 border-black ring-2 ring-amber-400/80 cursor-ns-resize pointer-events-auto flex items-center justify-center whitespace-nowrap select-none hover:scale-105 active:scale-95 transition-all"
                      title={`Drag to position horizontal cut line ${i + 1}`}
                    >
                      <span>{(line.pos * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${line.pos * 100}%` }}>
                    <div className="absolute top-0 bottom-0 -ml-[2px] w-[4px] bg-black/75 shadow-sm" />
                    <div className="absolute top-0 bottom-0 -ml-[1px] w-[2px] border-l-2 border-dashed border-amber-400 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" />
                    <div className="absolute top-0 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-b border-x border-b border-black shadow-md flex items-center justify-center pointer-events-none whitespace-nowrap">
                      <span>▼</span>
                    </div>
                    <div
                      onPointerDown={(e) => onCropPointerDown(`spine-${i}`, e)}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-black text-[11px] shadow-[0_4px_18px_rgba(0,0,0,0.85)] border-2 border-black ring-2 ring-amber-400/80 cursor-ew-resize pointer-events-auto flex items-center justify-center whitespace-nowrap select-none hover:scale-105 active:scale-95 transition-all"
                      title={`Drag to position vertical cut line ${i + 1}`}
                    >
                      <span>{(line.pos * 100).toFixed(1)}%</span>
                    </div>
                    <div className="absolute bottom-0 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-t border-x border-t border-black shadow-md flex items-center justify-center pointer-events-none whitespace-nowrap">
                      <span>▲</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
