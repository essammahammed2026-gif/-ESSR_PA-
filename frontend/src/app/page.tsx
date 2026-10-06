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
  SlidersHorizontal,
  Compass,
  Zap
} from "lucide-react";
import { API_BASE_URL, getApiUrl } from "@/lib/api";

interface StudioOption {
  studio: string;
  name: string;
  badge: string;
  reason: string;
  primary: boolean;
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
}

export default function DashboardHub() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<UniversalAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<UniversalAnalysis[]>([]);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Engine API health
  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
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
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/inspect`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Engine returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.analysis) {
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
      setError(err instanceof Error ? err.message : "Network error inspecting asset.");
    } finally {
      setIsAnalyzing(false);
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
    if (studio === "imposing") {
      const isBook = item.page_count > 1;
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
      router.push(`/flipbook`);
    } else if (studio === "preflight") {
      router.push(`/preflight`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-8 animate-in fade-in duration-200">
      {/* Precision Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242A38]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white flex items-center space-x-2">
            <span>Prepress Triage Desk</span>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 font-mono">
              Auto-Routing
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Drop any commercial print asset (PDF, PNG, JPG, TIFF) to analyze dimensions, ink color and dispatch directly into production.
          </p>
        </div>

        {/* Engine Heartbeat */}
        <div className="flex items-center space-x-2.5 bg-[#181D27] px-3 py-1.5 rounded-lg border border-[#242A38] shrink-0 self-start sm:self-auto">
          <Cpu size={14} className={backendStatus === "online" ? "text-cyan-400" : "text-slate-500"} />
          <span className="text-xs text-slate-400">Core Engine:</span>
          {backendStatus === "online" ? (
            <div className="flex items-center space-x-1.5 text-xs font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ready</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-xs font-medium text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Connecting</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Intelligent Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
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

        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/15 transition-all mb-3.5 shadow-sm">
          {isAnalyzing ? (
            <RefreshCw size={26} className="animate-spin text-cyan-400" />
          ) : (
            <Upload size={26} />
          )}
        </div>

        <div className="space-y-1 max-w-md">
          <p className="text-sm font-semibold text-white">
            {isAnalyzing ? "Analyzing Prepress Geometry..." : "Drop commercial print artwork here"}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Accepts single & multi-page <span className="text-slate-200 font-medium">PDF</span>, high-res <span className="text-slate-200 font-medium">PNG</span>, <span className="text-slate-200 font-medium">JPG</span>, and vectors. Inspects trim box, color space, and prepares studio states.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500 font-mono">
          <span className="px-2 py-0.5 rounded bg-[#12151B] border border-[#242A38]">PDF</span>
          <span className="px-2 py-0.5 rounded bg-[#12151B] border border-[#242A38]">PNG w/ Alpha</span>
          <span className="px-2 py-0.5 rounded bg-[#12151B] border border-[#242A38]">JPEG</span>
          <span className="px-2 py-0.5 rounded bg-[#12151B] border border-[#242A38]">TIFF</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
          <AlertCircle size={16} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Analysis & Dispatch Panel */}
      {analysis && (
        <div className="bg-[#181D27] border border-[#2B3344] rounded-2xl p-5 space-y-5 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#242A38]">
            <div className="flex items-center space-x-3 min-w-0">
              {analysis.thumbnail_url ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#2E3648] bg-black/40 shrink-0 relative flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={getApiUrl(analysis.thumbnail_url)} 
                    alt="Preview" 
                    className="w-full h-full object-contain" 
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#12151B] border border-[#2E3648] flex items-center justify-center text-slate-400 shrink-0">
                  <FileText size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md" title={analysis.filename}>
                    {analysis.filename}
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#12151B] text-slate-400 border border-[#2E3648]">
                    {analysis.extension.replace(".", "")}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span className="font-mono text-cyan-300 font-medium">
                    {analysis.width_mm} × {analysis.height_mm} mm
                  </span>
                  <span>•</span>
                  <span>{analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"}</span>
                  <span>•</span>
                  <span>{formatFileSize(analysis.size_bytes)}</span>
                  <span>•</span>
                  <span className="font-mono">{analysis.color_space}</span>
                  {analysis.has_transparency && (
                    <>
                      <span>•</span>
                      <span className="text-pink-400 font-medium">Alpha Mask</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setAnalysis(null);
                setError(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#12151B] border border-[#242A38] transition-colors self-start md:self-center"
            >
              Analyze Another File
            </button>
          </div>

          {/* Intelligent Studio Dispatch Actions */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <Zap size={14} className="text-amber-400" />
              <span>Recommended Studio Workflows for this Artwork:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {analysis.suggested_studios.map((option) => (
                <div
                  key={option.studio}
                  onClick={() => handleRouteToStudio(option.studio, analysis)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    option.primary
                      ? "bg-gradient-to-br from-cyan-950/40 to-[#181D27] border-cyan-500/40 hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-950/30"
                      : "bg-[#131720] border-[#242A38] hover:border-slate-500 hover:bg-[#181E29]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative group/name inline-block min-w-0">
                      <span
                        className="text-xs font-bold text-white group-hover/name:text-cyan-300 transition-colors cursor-help truncate block"
                        title={option.reason}
                      >
                        {option.name}
                      </span>
                      {option.reason && (
                        <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                          {option.reason}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${
                      option.primary
                        ? "bg-cyan-900/60 text-cyan-300 border-cyan-700/60"
                        : "bg-[#181D27] text-slate-400 border-[#2E3648]"
                    }`}>
                      {option.badge}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#242A38] flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Ready with artwork</span>
                    <span className="text-cyan-400 font-medium flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Launch</span>
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Session Jobs */}
      {recentJobs.length > 0 && !analysis && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <FolderOpen size={14} className="text-slate-400" />
              <span>Recent Ingested Files</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentJobs.map((job, idx) => (
              <div
                key={idx}
                onClick={() => setAnalysis(job)}
                className="p-3 bg-[#181D27] hover:bg-[#1E2432] border border-[#242A38] hover:border-slate-500 rounded-xl transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium text-white truncate" title={job.filename}>
                    {job.filename}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {job.width_mm} × {job.height_mm} mm • {job.page_count}p
                  </p>
                </div>
                <span className="text-xs text-cyan-400 font-medium shrink-0 flex items-center space-x-1">
                  <span>Reopen</span>
                  <ArrowRight size={12} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Studios Quick Index */}
      <div className="space-y-3 pt-2 border-t border-[#242A38]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <Compass size={14} className="text-slate-400" />
            <span>Dedicated Production Studios</span>
          </h2>
          <span className="text-[11px] text-slate-500">Standalone Workspaces</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/imposing"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-emerald-500/50 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Layers size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-emerald-300 transition-colors cursor-help truncate"
                  title="Sheet & roll layout with crop marks"
                >
                  Imposing Studio
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  Sheet & roll layout with crop marks
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            href="/contour"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-pink-500/50 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 shrink-0">
                <Scissors size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-pink-300 transition-colors cursor-help truncate"
                  title="Cutlines & white ink underbase"
                >
                  Contour Cut Studio
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  Cutlines & white ink underbase
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            href="/book-studio"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-amber-500/50 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <BookOpen size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-amber-300 transition-colors cursor-help truncate"
                  title="Spread split, deskew & bleed synthesis"
                >
                  Scanned Book Studio
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  Spread split, deskew & bleed synthesis
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            href="/preflight"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-blue-500/50 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <FileCheck size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-blue-300 transition-colors cursor-help truncate"
                  title="TrimBox, BleedBox & DPI validation"
                >
                  PDF Preflight Center
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  TrimBox, BleedBox & DPI validation
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            href="/flipbook"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-indigo-500/50 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-indigo-300 transition-colors cursor-help truncate"
                  title="3D interactive page-turn proofing"
                >
                  Flipbook Studio
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  3D interactive page-turn proofing
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            href="/settings"
            className="p-3 bg-[#161A24] hover:bg-[#1B202D] border border-[#242A38] hover:border-slate-500 rounded-xl transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 rounded-lg bg-slate-500/10 text-slate-300 shrink-0">
                <SlidersHorizontal size={18} />
              </div>
              <div className="relative group/name inline-block min-w-0">
                <h3
                  className="text-xs font-bold text-white group-hover/name:text-slate-200 transition-colors cursor-help truncate"
                  title="Press sheets, roll media & presets"
                >
                  Stocks & Settings
                </h3>
                <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150 z-30 w-48 p-2 text-[11px] leading-tight text-slate-200 bg-[#0D1017] border border-[#2B3344] rounded-lg shadow-xl shadow-black/80">
                  Press sheets, roll media & presets
                </div>
              </div>
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
