"use client";

import React, { useEffect, useMemo } from "react";
import { X, Download } from "lucide-react";
import { ExportFormat, TiffCompression } from "@/types/book_studio";

export interface ExportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: ExportFormat;
  onFormatChange: (fmt: ExportFormat) => void;
  dpi: number;
  onDpiChange: (dpi: number) => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  tiffCompression: TiffCompression;
  onTiffCompressionChange: (comp: TiffCompression) => void;
  onExport: () => void;
  pagesCount: number;
  isExporting?: boolean;
}

const PRESETS: { id: string; label: string; format: ExportFormat; dpi: number; quality: number; tiffCompression?: TiffCompression }[] = [
  { id: "press", label: "Press (300 DPI)", format: "pdf", dpi: 300, quality: 95 },
  { id: "proof", label: "Proof (150 DPI)", format: "pdf", dpi: 150, quality: 80 },
  { id: "archive", label: "Archive (TIFF)", format: "tiff", dpi: 300, quality: 92, tiffCompression: "lzw" },
];

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "pdf_split", label: "PDF (Pages)" },
  { id: "tiff", label: "TIFF" },
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPEG" },
];

export function ExportConfigModal({
  isOpen,
  onClose,
  format,
  onFormatChange,
  dpi,
  onDpiChange,
  quality,
  onQualityChange,
  tiffCompression,
  onTiffCompressionChange,
  onExport,
  pagesCount,
  isExporting = false,
}: ExportConfigModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isExporting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  const activePreset = useMemo(() => {
    const match = PRESETS.find((p) => {
      if (p.format !== format || p.dpi !== dpi) return false;
      if (p.format === "tiff") return (tiffCompression || "lzw") === (p.tiffCompression || "lzw");
      return quality === p.quality;
    });
    return match?.id ?? null;
  }, [format, dpi, quality, tiffCompression]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl overflow-hidden text-xs"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#242A38] bg-[#181D27] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-white">Export</span>
            <span className="text-[10px] font-mono text-slate-400 bg-[#242A38] px-1.5 py-0.5 rounded">
              {pagesCount} {pagesCount === 1 ? "page" : "pages"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-30"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Format */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Format
            </label>
            <div className="grid grid-cols-5 gap-1 p-0.5 bg-[#181D27] border border-[#242A38] rounded-lg">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFormatChange(f.id)}
                  className={`py-1.5 text-center font-semibold rounded transition-colors cursor-pointer ${
                    format === f.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Preset
            </label>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#181D27] border border-[#242A38] rounded-lg">
              {PRESETS.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onFormatChange(p.format);
                      onDpiChange(p.dpi);
                      onQualityChange(p.quality);
                      if (p.tiffCompression) onTiffCompressionChange(p.tiffCompression);
                    }}
                    className={`py-1 text-center font-medium rounded transition-colors cursor-pointer truncate px-1 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DPI & Quality */}
          <div className="grid grid-cols-2 gap-3">
            {/* DPI */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                DPI
              </label>
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#181D27] border border-[#242A38] rounded-lg">
                {[150, 200, 300, 400].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDpiChange(d)}
                    className={`py-1 font-mono font-semibold rounded transition-colors cursor-pointer ${
                      dpi === d ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality / Compression */}
            <div className="space-y-1">
              {format === "tiff" ? (
                <>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Compression
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#181D27] border border-[#242A38] rounded-lg">
                    {(["lzw", "deflate", "none"] as TiffCompression[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onTiffCompressionChange(c)}
                        className={`py-1 font-mono font-semibold uppercase rounded transition-colors cursor-pointer ${
                          tiffCompression === c ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Quality
                    </label>
                    <span className="font-mono text-amber-400 font-bold">{quality}%</span>
                  </div>
                  <div className="pt-1">
                    <input
                      type="range"
                      min="60"
                      max="100"
                      step="2"
                      value={quality}
                      onChange={(e) => onQualityChange(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#242A38] bg-[#181D27] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg border border-[#242A38] hover:bg-slate-800 text-slate-300 font-medium transition-colors cursor-pointer disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || pagesCount === 0}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold shadow transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
