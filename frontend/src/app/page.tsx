"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Cpu, Loader2 } from "lucide-react";
import { apiFetch, downloadBlob } from "@/lib/api";
import { LengthUnit, UNIT_OPTIONS, getStoredUnit, setStoredUnit } from "@/lib/units";
import type { UniversalAnalysis } from "@/components/home/types";
import { DropzonePanel } from "@/components/home/DropzonePanel";
import { AssetPanel } from "@/components/home/AssetPanel";
import { AuditReport } from "@/components/home/AuditReport";

export default function HomePage() {
  const router = useRouter();
  const [unit, setUnitState] = useState<LengthUnit>("mm");
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
    apiFetch(`/`)
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus(data.status === "ok" ? "online" : "offline");
      })
      .catch(() => setBackendStatus("offline"));

    // Load stored length unit preference
    setUnitState(getStoredUnit("mm"));

    // Load recent files from session storage and sanitize legacy studio entries
    try {
      const stored = sessionStorage.getItem("flint_recent_jobs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map((j: UniversalAnalysis) => ({
            ...j,
            suggested_studios: (j.suggested_studios || []).filter((s) => s.studio !== "preflight"),
          }));
          setRecentJobs(sanitized);
          sessionStorage.setItem("flint_recent_jobs", JSON.stringify(sanitized));
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const handleUnitChange = (newUnit: LengthUnit) => {
    setUnitState(newUnit);
    setStoredUnit(newUnit);
  };

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
      const res = await apiFetch(`/api/inspect`, {
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

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleSelectRecent = (job: UniversalAnalysis) => {
    const sanitized: UniversalAnalysis = {
      ...job,
      suggested_studios: (job.suggested_studios || []).filter((s) => s.studio !== "preflight"),
    };
    setAnalysis(sanitized);
  };

  const handleClearRecent = () => {
    sessionStorage.removeItem("flint_recent_jobs");
    setRecentJobs([]);
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
      } else if (studio === "book-studio") {
        const params = new URLSearchParams({
          file_path: item.file_path,
          name: item.filename,
        });
        router.push(`/book-studio?${params.toString()}`);
      } else {
        const params = new URLSearchParams({
          file_id: item.file_id,
          name: item.filename,
        });
        router.push(`/${studio}?${params.toString()}`);
      }
    }, 150);
  };

  // Export Technical Audit Report as PDF
  const handleExportPdfReport = async () => {
    if (!analysis) return;
    setIsExportingPdf(true);
    try {
      const safeName = analysis.filename.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
      await downloadBlob(`/api/inspect/export-report-pdf`, `Prepress_Audit_Report_${safeName}.pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, file_id: analysis.file_id }),
      });
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

  const handleAnalyzeAnother = () => {
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="flex items-center justify-between pb-3 border-b border-[#242A38]">
        <div className="flex items-center space-x-2 text-sm">
          {!analysis ? (
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center space-x-2">
              <span>Home</span>
            </h1>
          ) : (
            <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={handleAnalyzeAnother}
                className="font-medium hover:underline transition-all flex items-center space-x-1 cursor-pointer"
                style={{ color: "var(--app-accent, #06b6d4)" }}
                title="Return to Home dropzone"
              >
                <span>Home</span>
              </button>
              <span className="text-slate-500">/</span>
              <span className="font-semibold text-white">Inspector</span>
              <span className="text-slate-500">/</span>
              <span
                className="text-xs font-mono text-slate-400 truncate max-w-[200px] sm:max-w-xs"
                title={analysis.filename}
              >
                {analysis.filename}
              </span>
            </nav>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Global Length Unit Dropdown */}
          <div className="flex items-center space-x-1.5 bg-[#181D27] border border-[#242A38] rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500">Unit</span>
            <select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value as LengthUnit)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              title="Global length unit (applied across inspections and studio launches)"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#181D27] text-slate-200">
                  {opt.label} ({opt.short})
                </option>
              ))}
            </select>
          </div>

          {/* Engine Heartbeat */}
          <div className="flex items-center space-x-2 bg-[#181D27] px-2.5 py-1 rounded-lg border border-[#242A38] text-xs">
            <Cpu
              size={14}
              style={{ color: backendStatus === "online" ? "var(--app-accent, #06b6d4)" : undefined }}
              className={backendStatus !== "online" ? "text-slate-500" : ""}
            />
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
      </div>

      {/* Upload Drop Zone (Shown when no analysis active) */}
      {!analysis && (
        <DropzonePanel
          isDragging={isDragging}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
          analysisStatusText={analysisStatusText}
          recentJobs={recentJobs}
          unit={unit}
          fileInputRef={fileInputRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onBrowseClick={handleBrowseClick}
          onFileInput={handleFileInput}
          onSelectRecent={handleSelectRecent}
          onClearRecent={handleClearRecent}
        />
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
            <div
              className="p-2.5 rounded-lg border text-xs flex items-center space-x-2.5 animate-in fade-in"
              style={{
                backgroundColor: "var(--app-accent-15, rgba(6, 182, 212, 0.15))",
                borderColor: "var(--app-accent, #06b6d4)",
                color: "var(--app-accent, #06b6d4)",
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-white font-medium">Loading artwork into studio...</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column (4 cols): Artwork Profile & Studio Launch */}
            <AssetPanel
              analysis={analysis}
              routingStudio={routingStudio}
              unit={unit}
              onRouteToStudio={handleRouteToStudio}
              onAnalyzeAnother={handleAnalyzeAnother}
              formatFileSize={formatFileSize}
            />

            {/* Right Column (8 cols): Detailed Technical Prepress Audit Report */}
            <AuditReport
              analysis={analysis}
              isExportingPdf={isExportingPdf}
              unit={unit}
              onExportPdf={handleExportPdfReport}
            />
          </div>
        </div>
      )}
    </div>
  );
}
