"use client";

import React from "react";
import { CropModuleConfig, SplitLine } from "@/types/book_studio";
import { groupSplitLines } from "@/lib/splitLines";
import { SplitLineOverlay } from "./SplitLineOverlay";

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
  activeDrag?: string | null;
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
  activeDrag = null,
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
      style={{ backgroundImage: "radial-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      className={`flex-1 overflow-hidden bg-[#0A0D14] flex items-center justify-center p-8 relative ${
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
          className="max-h-[calc(100vh-14rem)] max-w-full object-contain rounded-sm shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/5 transition-all duration-150"
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
            <div className="absolute top-0 left-0 right-0 bg-black/55 backdrop-blur-[1px] pointer-events-none" style={{ height: `${cropModule.cropBox.y1 * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/55 backdrop-blur-[1px] pointer-events-none" style={{ top: `${cropModule.cropBox.y2 * 100}%` }} />
            <div
              className="absolute left-0 bg-black/55 backdrop-blur-[1px] pointer-events-none"
              style={{ top: `${cropModule.cropBox.y1 * 100}%`, bottom: `${(1 - cropModule.cropBox.y2) * 100}%`, width: `${cropModule.cropBox.x1 * 100}%` }}
            />
            <div
              className="absolute right-0 bg-black/55 backdrop-blur-[1px] pointer-events-none"
              style={{ top: `${cropModule.cropBox.y1 * 100}%`, bottom: `${(1 - cropModule.cropBox.y2) * 100}%`, left: `${cropModule.cropBox.x2 * 100}%` }}
            />
            <div
              className="absolute border-2 border-solid shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_24px_rgba(0,0,0,0.35)] select-none"
              style={{
                borderColor: "var(--app-accent, #f59e0b)",
                top: `${cropModule.cropBox.y1 * 100}%`,
                left: `${cropModule.cropBox.x1 * 100}%`,
                width: `${(cropModule.cropBox.x2 - cropModule.cropBox.x1) * 100}%`,
                height: `${(cropModule.cropBox.y2 - cropModule.cropBox.y1) * 100}%`,
              }}
            >
              {singleVertical && (
                <>
                  <div className="absolute top-1.5 left-1.5 bg-slate-950/85 border text-slate-200 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col" style={{ borderColor: "var(--app-accent, #f59e0b)" }}>
                    <span className="font-bold" style={{ color: "var(--app-accent, #f59e0b)" }}>P1 (LEFT)</span>
                    <div className="text-slate-100 font-bold text-[9px]">{vSegs[0]} × {currentCropHeightMm} mm</div>
                  </div>
                  <div className="absolute top-1.5 right-1.5 bg-slate-950/85 border text-slate-200 px-1.5 py-0.5 rounded shadow text-[8px] font-mono pointer-events-none z-10 flex flex-col items-end text-right" style={{ borderColor: "var(--app-accent, #f59e0b)" }}>
                    <span className="font-bold" style={{ color: "var(--app-accent, #f59e0b)" }}>P2 (RIGHT)</span>
                    <div className="text-slate-100 font-bold text-[9px]">{vSegs[1]} × {currentCropHeightMm} mm</div>
                  </div>
                </>
              )}

              {/* Interior Draggable Area for Moving */}
              <div
                onPointerDown={(e) => onCropPointerDown("move", e)}
                className="absolute inset-2 cursor-move z-10"
                title="Drag interior to move crop box"
              />

              {/* Edge Resize Bars */}
              <div
                onPointerDown={(e) => onCropPointerDown("n", e)}
                className="absolute -top-2 left-2 right-2 h-4 cursor-ns-resize z-20 hover:bg-white/10 transition-colors"
                title="Drag top edge to resize height"
              />
              <div
                onPointerDown={(e) => onCropPointerDown("s", e)}
                className="absolute -bottom-2 left-2 right-2 h-4 cursor-ns-resize z-20 hover:bg-white/10 transition-colors"
                title="Drag bottom edge to resize height"
              />
              <div
                onPointerDown={(e) => onCropPointerDown("w", e)}
                className="absolute top-2 bottom-2 -left-2 w-4 cursor-ew-resize z-20 hover:bg-white/10 transition-colors"
                title="Drag left edge to resize width"
              />
              <div
                onPointerDown={(e) => onCropPointerDown("e", e)}
                className="absolute top-2 bottom-2 -right-2 w-4 cursor-ew-resize z-20 hover:bg-white/10 transition-colors"
                title="Drag right edge to resize width"
              />

              {/* Corner Handles */}
              <div
                onPointerDown={(e) => onCropPointerDown("nw", e)}
                className="absolute -top-2.5 -left-2.5 w-5 h-5 flex items-center justify-center cursor-nwse-resize z-30 group"
                title="Drag corner to resize"
              >
                <div className="w-3 h-3 rounded-full ring-2 ring-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" style={{ backgroundColor: "var(--app-accent, #f59e0b)" }} />
              </div>
              <div
                onPointerDown={(e) => onCropPointerDown("ne", e)}
                className="absolute -top-2.5 -right-2.5 w-5 h-5 flex items-center justify-center cursor-nesw-resize z-30 group"
                title="Drag corner to resize"
              >
                <div className="w-3 h-3 rounded-full ring-2 ring-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" style={{ backgroundColor: "var(--app-accent, #f59e0b)" }} />
              </div>
              <div
                onPointerDown={(e) => onCropPointerDown("sw", e)}
                className="absolute -bottom-2.5 -left-2.5 w-5 h-5 flex items-center justify-center cursor-nesw-resize z-30 group"
                title="Drag corner to resize"
              >
                <div className="w-3 h-3 rounded-full ring-2 ring-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" style={{ backgroundColor: "var(--app-accent, #f59e0b)" }} />
              </div>
              <div
                onPointerDown={(e) => onCropPointerDown("se", e)}
                className="absolute -bottom-2.5 -right-2.5 w-5 h-5 flex items-center justify-center cursor-nwse-resize z-30 group"
                title="Drag corner to resize"
              >
                <div className="w-3 h-3 rounded-full ring-2 ring-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" style={{ backgroundColor: "var(--app-accent, #f59e0b)" }} />
              </div>
              {hasCutLines && lines.map((line, i) => (
                <SplitLineOverlay
                  key={i}
                  line={line}
                  index={i}
                  active={activeDrag === `spine-${i}`}
                  onPointerDown={onCropPointerDown}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
