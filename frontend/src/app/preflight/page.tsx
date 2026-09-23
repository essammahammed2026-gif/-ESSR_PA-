"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  FileCheck, 
  Upload, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Image as ImageIcon, 
  BookOpen, 
  Layers, 
  FileText,
  FileBox,
  RefreshCw
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface PreflightData {
  num_pages: number;
  is_uniform: boolean;
  sizes: [number, number][];
  primary_size: [number, number];
  total_images: number;
  low_dpi_warnings: number;
}

export default function PreflightCenterPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<PreflightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/preflight`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Preflight analysis failed.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Network error communicating with preflight engine.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getVerdict = () => {
    if (!result) return null;
    if (result.low_dpi_warnings > 0 || !result.is_uniform) {
      return {
        status: "WARNING",
        label: "Attention Required Before Plating",
        desc: "Found potential print quality issues (low resolution images or inconsistent page dimensions).",
        color: "border-amber-500/40 bg-amber-500/10 text-amber-400",
        badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        icon: AlertTriangle,
      };
    }
    return {
      status: "PASSED",
      label: "Ready for Print Production",
      desc: "All page dimensions are uniform and all embedded raster images meet the 300+ DPI press standard.",
      color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
      icon: CheckCircle2,
    };
  };

  const verdict = getVerdict();

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#242A38]">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              PDF Preflight Center
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50">
              ISO 12647
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Automated prepress validation for dimensions, image resolutions, and uniformity.
          </p>
        </div>

        {result && (
          <button
            onClick={() => {
              setResult(null);
              setFiles([]);
            }}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-[#181D27] border border-[#242A38] hover:border-slate-600 transition-colors w-fit"
          >
            <RefreshCw size={14} />
            <span>Reset Inspection</span>
          </button>
        )}
      </div>

      {/* Upload Dropzone */}
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-300">
          Upload PDF Artwork for Inspection
        </label>
        
        <div className="border-2 border-dashed border-[#2E3648] hover:border-indigo-500/50 rounded-xl p-8 text-center bg-[#131720]/60 transition-colors">
          <input
            type="file"
            id="pdf-upload"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
            <Upload size={36} className="text-indigo-400 mb-3" />
            <span className="text-sm font-medium text-slate-200">
              Click to select or drag and drop PDF files
            </span>
            <span className="text-xs text-slate-400 mt-1">
              Supports single-sheet proofs or multi-page books
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-300 flex items-center space-x-2">
              <FileText size={16} className="text-indigo-400" />
              <span>
                Selected {files.length} file{files.length > 1 ? "s" : ""}:{" "}
                <span className="font-semibold text-white">
                  {files.map((f) => f.name).join(", ")}
                </span>
              </span>
            </div>

            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center space-x-2 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Analyzing Artwork...</span>
                </>
              ) : (
                <>
                  <FileCheck size={16} />
                  <span>Execute Preflight Check</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 flex items-start space-x-3 text-sm">
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">Preflight Check Error</div>
            <div className="text-xs text-red-300 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Inspection Results Report Card */}
      {result && verdict && (
        <div className="space-y-6">
          {/* Executive Verdict Banner */}
          <div className={`p-5 rounded-xl border ${verdict.color} flex items-start justify-between gap-4`}>
            <div className="flex items-start space-x-3">
              <verdict.icon size={28} className="shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-white">{verdict.label}</h2>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${verdict.badge}`}>
                    {verdict.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {verdict.desc}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Metric Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Pages */}
            <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38]">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Total Pages</span>
                <FileBox size={18} className="text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{result.num_pages}</div>
              <div className="text-xs text-slate-400 mt-1">
                {result.num_pages === 1 ? "Single page sheet" : "Multi-page document"}
              </div>
            </div>

            {/* Page Geometry / Dimensions */}
            <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38]">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Primary Trim Size</span>
                <FileText size={18} className="text-blue-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                {result.primary_size[0]} × {result.primary_size[1]}
                <span className="text-xs font-normal text-slate-400 ml-1">mm</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {((result.primary_size[0] / 25.4).toFixed(2))} × {((result.primary_size[1] / 25.4).toFixed(2))} in
              </div>
            </div>

            {/* Size Uniformity */}
            <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38]">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Size Uniformity</span>
                {result.is_uniform ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-400" />
                )}
              </div>
              <div className={`text-2xl font-extrabold ${result.is_uniform ? "text-emerald-400" : "text-amber-400"}`}>
                {result.is_uniform ? "Uniform" : "Mixed Sizes"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {result.sizes.length} unique dimension{result.sizes.length > 1 ? "s" : ""} detected
              </div>
            </div>

            {/* Raster Images & DPI */}
            <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38]">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Image Resolution</span>
                <ImageIcon size={18} className="text-purple-400" />
              </div>
              <div className={`text-2xl font-extrabold ${result.low_dpi_warnings > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {result.low_dpi_warnings > 0 ? `${result.low_dpi_warnings} Low DPI` : "300+ DPI Pass"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {result.total_images} total embedded image{result.total_images !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Actionable Remediation Shortcuts */}
          <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Recommended Prepress Next Steps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/imposing"
                className="p-4 rounded-lg border border-[#242A38] hover:border-emerald-500/50 bg-[#12151B] transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors flex items-center space-x-2">
                    <Layers size={16} className="text-emerald-400" />
                    <span>Proceed to Imposing Studio</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Layout pages onto press sheets (SRA3, B2, or custom rolls) with marks & bleeds.
                  </div>
                </div>
              </Link>

              <Link
                href="/book-studio"
                className="p-4 rounded-lg border border-[#242A38] hover:border-amber-500/50 bg-[#12151B] transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white text-sm group-hover:text-amber-400 transition-colors flex items-center space-x-2">
                    <BookOpen size={16} className="text-amber-400" />
                    <span>Open in Scanned Book Studio</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Auto-synthesize 3mm missing bleeds, clean dark scan edges, and reorder pages.
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
