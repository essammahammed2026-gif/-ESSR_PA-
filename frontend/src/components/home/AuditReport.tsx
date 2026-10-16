"use client";

import React from "react";
import { Download, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { formatMmInUnit, LengthUnit } from "@/lib/units";
import type { UniversalAnalysis } from "./types";

export interface AuditReportProps {
  analysis: UniversalAnalysis;
  isExportingPdf: boolean;
  unit?: LengthUnit;
  onExportPdf: () => void;
}

export function AuditReport({
  analysis,
  isExportingPdf,
  unit = "mm",
  onExportPdf,
}: AuditReportProps) {
  const report = analysis.report;

  const formattedPrimaryTrim =
    unit && unit !== "mm"
      ? `${formatMmInUnit(analysis.width_mm, unit)} × ${formatMmInUnit(analysis.height_mm, unit)}`
      : `${analysis.width_mm} × ${analysis.height_mm} mm`;

  const standardName = report?.checks.geometry.page_groups?.[0]?.standard_name;

  const formattedBleed =
    report?.checks.bleed.status === "pass"
      ? (unit && unit !== "mm"
          ? `${formatMmInUnit(report.checks.bleed.bleed_mm, unit)} Bleed`
          : `${report.checks.bleed.bleed_mm} mm Bleed`)
      : "No Bleed";

  return (
    <div className="lg:col-span-8 bg-[#181D27] border border-[#2B3344] rounded-xl p-4 md:p-5 space-y-3.5 shadow-sm">
      {/* Report Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242A38]">
        <div className="flex items-center space-x-2.5">
          <h2 className="text-sm font-bold text-white">Prepress Audit Report</h2>
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
          onClick={onExportPdf}
          disabled={isExportingPdf}
          className="px-3.5 py-1.5 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm self-start sm:self-auto shrink-0 cursor-pointer hover:brightness-110"
          style={{ backgroundColor: "var(--app-accent, #06b6d4)" }}
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

      {/* 4 Core Inspection Cards (Minimal, Zero-Duplication Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. Trim & Geometry */}
        <div className="p-3.5 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Trim & Geometry</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.geometry.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.geometry.status === "pass" ? "UNIFORM" : "MIXED SIZES"}
            </span>
          </div>

          <div className="text-sm font-bold text-white font-mono">
            {formattedPrimaryTrim}
            {standardName && standardName !== formattedPrimaryTrim && (
              <span className="text-xs font-normal text-slate-400 ml-1.5 font-sans">
                ({standardName})
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            {analysis.page_count} {analysis.page_count === 1 ? "page" : "pages"}
          </div>

          {/* Mixed Size Itemized Groups (Only when non-uniform) */}
          {report?.checks.geometry.page_groups && report.checks.geometry.page_groups.length > 1 && (
            <div className="pt-1.5 space-y-1">
              {report.checks.geometry.page_groups.map((group, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] bg-[#10131A] px-2.5 py-1.5 rounded border border-[#1E2432] font-mono"
                >
                  <span className="text-slate-300">Pages {group.pages}</span>
                  <span className="text-cyan-400 font-semibold">
                    {group.dimensions} ({group.standard_name})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Image Resolution & DPI */}
        <div className="p-3.5 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Image Resolution</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.dpi.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.dpi.status === "pass"
                ? "300+ DPI PASS"
                : `${report?.checks.dpi.low_dpi_count ?? 0} LOW DPI`}
            </span>
          </div>

          <div className="text-sm font-bold text-white">
            {(report?.checks.dpi.low_dpi_count ?? 0) > 0 ? (
              <span className="text-amber-400">{report?.checks.dpi.low_dpi_count} low-DPI image(s)</span>
            ) : (
              <span className="text-emerald-400">Press Ready</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            {report?.checks.dpi.total_images ?? 0} embedded raster{" "}
            {report?.checks.dpi.total_images === 1 ? "image" : "images"}
          </div>

          {/* Low DPI Itemized Table (Only when low DPI exists) */}
          {report?.checks.dpi.low_dpi_images && report.checks.dpi.low_dpi_images.length > 0 && (
            <div className="pt-1.5 space-y-1">
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {report.checks.dpi.low_dpi_images.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] bg-[#10131A] px-2.5 py-1 rounded border border-[#1E2432] font-mono"
                  >
                    <span className="text-slate-300">p.{img.page}</span>
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
        <div className="p-3.5 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Bleed Margins</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                report?.checks.bleed.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {formattedBleed}
            </span>
          </div>

          <div className="text-sm font-bold text-white">
            {report?.checks.bleed.status === "pass" ? (
              <span className="text-emerald-400">{report?.checks.bleed.bleed_mm} mm BleedBox</span>
            ) : (
              <span className="text-amber-400">Missing Trim Margins</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            {report?.checks.bleed.status === "pass"
              ? "TrimBox defined with safe margins"
              : "3 mm bleed recommended for finishing"}
          </div>
        </div>

        {/* 4. Color Separation */}
        <div className="p-3.5 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Color Separation</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.colorspace.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.colorspace.primary}
            </span>
          </div>

          <div className="text-sm font-bold text-white">
            {report?.checks.colorspace.status === "pass" ? (
              <span className="text-emerald-400">CMYK / Press Profile</span>
            ) : (
              <span className="text-amber-400">RGB Elements Detected</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            {report?.checks.colorspace.spot_colors && report.checks.colorspace.spot_colors.length > 0
              ? `${report.checks.colorspace.spot_colors.length} spot plate(s)`
              : "Process colors"}
          </div>

          {/* Spot Color Plates List (Only if present) */}
          {report?.checks.colorspace.spot_colors && report.checks.colorspace.spot_colors.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {report.checks.colorspace.spot_colors.map((spot, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block mr-1.5 shrink-0" />
                  {spot}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
