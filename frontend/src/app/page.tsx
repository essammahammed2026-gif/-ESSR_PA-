"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FileCheck, 
  Layers, 
  BookOpen, 
  Scissors, 
  Upload, 
  ArrowRight,
  Sparkles,
  FileText,
  AlertCircle,
  Cpu,
  RefreshCw,
  FolderOpen,
  Compass,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { API_BASE_URL, getApiUrl } from "@/lib/api";

interface StudioOption {
  studio: string;
  name: string;
  badge: string;
  reason: string;
  primary: boolean;
}

interface PageGroup {
  pages: string;
  dimensions: string;
  standard_name: string;
  count: number;
}

interface LowDpiImage {
  page: number;
  dpi: number;
  dimensions: string;
  status: string;
}

interface PrepressReport {
  overall_status: "pass" | "warning";
  summary: {
    page_count: number;
    primary_size: string;
    color_profile: string;
    total_images: number;
    low_dpi_count: number;
    has_bleed: boolean;
    bleed_mm: number;
  };
  checks: {
    geometry: {
      status: "pass" | "warning";
      is_uniform: boolean;
      page_groups: PageGroup[];
      details: string;
    };
    dpi: {
      status: "pass" | "warning";
      total_images: number;
      low_dpi_count: number;
      low_dpi_pages: number[];
      low_dpi_images: LowDpiImage[];
      details: string;
    };
    bleed: {
      status: "pass" | "warning";
      has_bleed: boolean;
      bleed_mm: number;
      pages_missing_bleed: number[];
      details: string;
    };
    colorspace: {
      status: "pass" | "warning";
      primary: string;
      has_rgb: boolean;
      rgb_pages: number[];
      spot_colors: string[];
      details: string;
    };
  };
}

interface UniversalAnalysis {
  filename: string;
  extension: string;
  size_bytes: number;
  page_count: number;
  width_mm: number;
  height_mm: number;
  aspect_ratio: number;
  color_space: string;
  has_transparency: boolean;
  is_multi_page: boolean;
  suggested_studios: StudioOption[];
  warnings: string[];
  thumbnail_url?: string;
  file_id: string;
  file_path: string;
  report?: PrepressReport;
}

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatusText, setAnalysisStatusText] = useState("");
  const [analysis, setAnalysis] = useState<UniversalAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<UniversalAnalysis[]>([]);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [routingStudio, setRoutingStudio] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Engine API health
  useEffect(() => {
    fetch(API_BASE_URL)
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus(data.status === "ok" ? "online" : "offline");
      })
      .catch(() => setBackendStatus("offline"));

    // Load recent files from session storage
    try {
      const stored = sessionStorage.getItem("flint_recent_jobs");
      if (stored) {
        setRecentJobs(JSON.parse(stored));
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const handleProcessFile = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisProgress(15);
    setAnalysisStatusText("Uploading artwork file...");
    setError(null);

    const progressTimer1 = setTimeout(() => {
      setAnalysisProgress(40);
      setAnalysisStatusText("Inspecting page boxes & geometry...");
    }, 400);

    const progressTimer2 = setTimeout(() => {
      setAnalysisProgress(75);
      setAnalysisStatusText("Scanning image resolutions (DPI) & colorspace...");
    }, 900);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/inspect`, {
        method: "POST",
        body: formData,
      });

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);

      if (!res.ok) {
        throw new Error(`Engine returned HTTP ${res.status}`);
      }

      setAnalysisProgress(95);
      setAnalysisStatusText("Compiling technical audit report...");

      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisProgress(100);
        const result: UniversalAnalysis = data.analysis;
        setAnalysis(result);

        // Update recent jobs cache in session
        setRecentJobs((prev) => {
          const updated = [result, ...prev.filter((j) => j.filename !== result.filename)].slice(0, 5);
          try {
            sessionStorage.setItem("flint_recent_jobs", JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      } else {
        setError(data.error || "Unable to inspect artwork format.");
      }
    } catch (err: unknown) {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      setError(err instanceof Error ? err.message : "Network error inspecting asset.");
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStatusText("");
      }, 300);
    }
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Launch pre-configured studio with this analyzed file
  const handleRouteToStudio = (studio: string, item: UniversalAnalysis) => {
    setRoutingStudio(studio);
    const isBook = item.page_count > 1;

    setTimeout(() => {
      if (studio === "imposing") {
        const params = new URLSearchParams({
          file_id: item.file_id,
          name: item.filename,
          w: String(item.width_mm),
          h: String(item.height_mm),
          page_count: String(item.page_count),
          job_mode: isBook ? "book" : "gang",
        });
        router.push(`/imposing?${params.toString()}`);
      } else if (studio === "contour") {
        const params = new URLSearchParams({
          file_id: item.file_id,
        });
        router.push(`/contour?${params.toString()}`);
      } else if (studio === "book-studio") {
        const params = new URLSearchParams({
          file_path: item.file_path,
          name: item.filename,
        });
        router.push(`/book-studio?${params.toString()}`);
      } else if (studio === "flipbook") {
        const params = new URLSearchParams({
          file_id: item.file_id,
          name: item.filename,
        });
        router.push(`/flipbook?${params.toString()}`);
      } else if (studio === "preflight") {
        const params = new URLSearchParams({
          file_id: item.file_id,
          name: item.filename,
        });
        router.push(`/preflight?${params.toString()}`);
      }
    }, 150);
  };

  // Export Technical Audit Report as PDF
  const handleExportPdfReport = async () => {
    if (!analysis) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/inspect/export-report-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, file_id: analysis.file_id }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = analysis.filename.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
      a.download = `Prepress_Audit_Report_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error exporting PDF report");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const report = analysis?.report;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#242A38]">
        <div>
          <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Home</span>
          </h1>
        </div>

        {/* Engine Heartbeat */}
        <div className="flex items-center space-x-2 bg-[#181D27] px-2.5 py-1 rounded-lg border border-[#242A38] text-xs">
          <Cpu size={14} className={backendStatus === "online" ? "text-cyan-400" : "text-slate-500"} />
          <span className="text-slate-400 text-[11px]">Core Engine:</span>
          {backendStatus === "online" ? (
            <span className="text-emerald-400 font-medium text-[11px] flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse mr-1" />
              Ready
            </span>
          ) : (
            <span className="text-rose-400 font-medium text-[11px] flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block mr-1" />
              Connecting
            </span>
          )}
        </div>
      </div>

      {/* Upload Drop Zone (Shown when no analysis active) */}
      {!analysis && (
        <div className="space-y-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
              isDragging
                ? "border-cyan-400 bg-cyan-950/20 shadow-xl shadow-cyan-950/30 scale-[0.995]"
                : "border-[#2B3344] bg-[#161A24] hover:bg-[#1A1F2C] hover:border-slate-500 shadow-sm"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:bg-cyan-500/15 transition-all mb-3 shadow-sm">
              {isAnalyzing ? (
                <RefreshCw size={22} className="animate-spin text-cyan-400" />
              ) : (
                <Upload size={22} />
              )}
            </div>

            <div className="space-y-1 max-w-sm">
              <p className="text-xs md:text-sm font-semibold text-white">
                {isAnalyzing ? "Inspecting Prepress File..." : "Drop print artwork here or click to browse"}
              </p>
              <p className="text-[11px] text-slate-400">
                PDF, PNG, JPG, TIFF, WEBP
              </p>
            </div>

            {/* Active Analysis Progress Bar */}
            {isAnalyzing && (
              <div className="w-full max-w-xs mt-4 space-y-1.5 animate-in fade-in">
                <div className="w-full bg-[#12151B] h-2 rounded-full overflow-hidden border border-[#2B3344]">
                  <div 
                    className="bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{analysisStatusText}</span>
                  <span>{analysisProgress}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle size={15} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Analyzed Result View: Master / Detail (Left = Artwork & Studios, Right = Detailed Report) */}
      {analysis && (
        <div className="space-y-4">
          {/* Routing Progress Overlay Indicator */}
          {routingStudio && (
            <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span>Loading artwork into studio...</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column (4 cols): Artwork Profile & Studio Launch */}
            <div className="lg:col-span-4 space-y-3">
              {/* Asset Card */}
              <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-3.5 shadow-sm">
                <div className="flex items-start space-x-3">
                  {analysis.thumbnail_url ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#2E3648] bg-black/40 shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={getApiUrl(analysis.thumbnail_url)} 
                        alt="Preview" 
                        className="w-full h-full object-contain" 
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#12151B] border border-[#2E3648] flex items-center justify-center text-slate-400 shrink-0">
                      <FileText size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white truncate" title={analysis.filename}>
                      {analysis.filename}
                    </h3>
                    <p className="text-[11px] font-mono text-cyan-400 font-semibold mt-0.5">
                      {analysis.width_mm} × {analysis.height_mm} mm
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"} • {formatFileSize(analysis.size_bytes)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#242A38] flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#12151B] text-slate-400 border border-[#2E3648]">
                    {analysis.color_space}
                  </span>
                  <button
                    onClick={() => {
                      setAnalysis(null);
                      setError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#12151B] border border-[#242A38] hover:border-slate-500 transition-colors"
                  >
                    Analyze Another
                  </button>
                </div>
              </div>

              {/* Dedicated Studio Launchpad */}
              <div className="bg-[#181D27] border border-[#2B3344] rounded-xl p-4 space-y-2.5 shadow-sm">
                <div className="text-xs font-semibold text-slate-300">
                  Open in Studio
                </div>

                <div className="space-y-1.5">
                  {analysis.suggested_studios.map((option) => (
                    <button
                      key={option.studio}
                      disabled={routingStudio !== null}
                      onClick={() => handleRouteToStudio(option.studio, analysis)}
                      className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-center justify-between group ${
                        option.primary
                          ? "bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400 text-white"
                          : "bg-[#141822] border-[#242A38] hover:border-slate-500 text-slate-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {option.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {option.reason}
                        </div>
                      </div>
                      <ArrowRight size={13} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (8 cols): Detailed Technical Prepress Audit Report */}
            <div className="lg:col-span-8 bg-[#181D27] border border-[#2B3344] rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
              {/* Report Header & Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242A38]">
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-sm font-bold text-white">
                    Prepress Audit Report
                  </h2>
                  {report?.overall_status === "pass" ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                      <CheckCircle2 size={11} className="mr-1" />
                      All Checks Passed
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/60 flex items-center space-x-1">
                      <AlertTriangle size={11} className="mr-1" />
                      Attention Needed
                    </span>
                  )}
                </div>

                {/* PDF Export Button */}
                <button
                  onClick={handleExportPdfReport}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm self-start sm:self-auto shrink-0"
                  title="Download printable A4 Prepress Quality Audit Report"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>Export Report as PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Inspection Details Section */}
              <div className="space-y-3">
                {/* 1. Page Geometry & Dimensions */}
                <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Page Geometry & Trim Uniformity
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      report?.checks.geometry.status === "pass"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                    }`}>
                      {report?.checks.geometry.status === "pass" ? "UNIFORM" : "VARYING SIZES"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {report?.checks.geometry.details}
                  </p>

                  {/* Itemized Page Size List */}
                  {report?.checks.geometry.page_groups && report.checks.geometry.page_groups.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      {report.checks.geometry.page_groups.map((group, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between text-[11px] bg-[#10131A] px-2.5 py-1.5 rounded border border-[#1E2432] font-mono"
                        >
                          <span className="text-slate-300">
                            Pages {group.pages}
                          </span>
                          <span className="text-cyan-400 font-semibold">
                            {group.dimensions} ({group.standard_name})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Image Resolution & DPI */}
                <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Image Resolution & DPI
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      report?.checks.dpi.status === "pass"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                    }`}>
                      {report?.checks.dpi.status === "pass" ? "300+ DPI PASS" : "LOW DPI DETECTED"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {report?.checks.dpi.details}
                  </p>

                  {/* Low DPI Itemized Table */}
                  {report?.checks.dpi.low_dpi_images && report.checks.dpi.low_dpi_images.length > 0 && (
                    <div className="pt-1.5 space-y-1">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        Low Resolution Images (&lt;300 DPI):
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {report.checks.dpi.low_dpi_images.map((img, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between text-[11px] bg-[#10131A] px-2.5 py-1.5 rounded border border-[#1E2432] font-mono"
                          >
                            <span className="text-slate-300">
                              Page {img.page}
                            </span>
                            <span className="text-amber-400 font-semibold">
                              {img.dpi} DPI ({img.dimensions})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Bleed Allowance */}
                <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Bleed Margins & TrimBox
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      report?.checks.bleed.status === "pass"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                    }`}>
                      {report?.checks.bleed.status === "pass" ? `${report?.checks.bleed.bleed_mm} MM BLEED` : "NO BLEED"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {report?.checks.bleed.details}
                  </p>
                </div>

                {/* 4. Color Space & Inks */}
                <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Color Space & Separation
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      report?.checks.colorspace.status === "pass"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                    }`}>
                      {report?.checks.colorspace.primary}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {report?.checks.colorspace.details}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Files (Shown when no analysis active) */}
      {recentJobs.length > 0 && !analysis && (
        <div className="space-y-2.5 pt-2 border-t border-[#242A38]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <FolderOpen size={13} className="text-slate-400" />
              <span>Recent Files</span>
            </h2>
            <button
              onClick={() => {
                sessionStorage.removeItem("flint_recent_jobs");
                setRecentJobs([]);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {recentJobs.map((job, idx) => (
              <div
                key={idx}
                onClick={() => setAnalysis(job)}
                className="p-2.5 bg-[#181D27] hover:bg-[#1E2432] border border-[#242A38] hover:border-slate-500 rounded-lg transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium text-white truncate" title={job.filename}>
                    {job.filename}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {job.width_mm} × {job.height_mm} mm • {job.page_count}p
                  </p>
                </div>
                <span className="text-[11px] text-cyan-400 font-medium shrink-0 flex items-center space-x-1">
                  <span>Open</span>
                  <ArrowRight size={11} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Studios Quick Launch (Shown when no analysis active) */}
      {!analysis && (
        <div className="space-y-2.5 pt-2 border-t border-[#242A38]">
          <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
            <Compass size={13} className="text-slate-400" />
            <span>Studios</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <Link
              href="/imposing"
              className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-emerald-500/50 rounded-lg transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-2">
                <Layers size={16} />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                Imposing Studio
              </div>
            </Link>

            <Link
              href="/contour"
              className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-pink-500/50 rounded-lg transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 w-fit mb-2">
                <Scissors size={16} />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                Contour Studio
              </div>
            </Link>

            <Link
              href="/book-studio"
              className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-amber-500/50 rounded-lg transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 w-fit mb-2">
                <BookOpen size={16} />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                Book Studio
              </div>
            </Link>

            <Link
              href="/preflight"
              className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-blue-500/50 rounded-lg transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-2">
                <FileCheck size={16} />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                Preflight Studio
              </div>
            </Link>

            <Link
              href="/flipbook"
              className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-indigo-500/50 rounded-lg transition-all flex flex-col justify-between group"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit mb-2">
                <Sparkles size={16} />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                Flipbook Studio
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
