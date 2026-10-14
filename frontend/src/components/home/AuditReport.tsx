"use client";

import React from "react";
import { Download, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { UniversalAnalysis } from "./types";

export interface AuditReportProps {
  analysis: UniversalAnalysis;
  isExportingPdf: boolean;
  onExportPdf: () => void;
}

export function AuditReport({ analysis, isExportingPdf, onExportPdf }: AuditReportProps) {
  const report = analysis.report;

  return (
    <div className="lg:col-span-8 bg-[#181D27] border border-[#2B3344] rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
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
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.geometry.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.geometry.status === "pass" ? "UNIFORM" : "VARYING SIZES"}
            </span>
          </div>

          <p className="text-[11px] text-slate-300">{report?.checks.geometry.details}</p>

          {/* Itemized Page Size List */}
          {report?.checks.geometry.page_groups && report.checks.geometry.page_groups.length > 0 && (
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
        <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Image Resolution & DPI</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.dpi.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.dpi.status === "pass" ? "300+ DPI PASS" : "LOW DPI DETECTED"}
            </span>
          </div>

          <p className="text-[11px] text-slate-300">{report?.checks.dpi.details}</p>

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
                    <span className="text-slate-300">Page {img.page}</span>
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
            <span className="text-xs font-semibold text-slate-200">Bleed Margins & TrimBox</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                report?.checks.bleed.status === "pass"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                  : "bg-amber-950/80 text-amber-400 border border-amber-800/50"
              }`}
            >
              {report?.checks.bleed.status === "pass"
                ? `${report?.checks.bleed.bleed_mm} MM BLEED`
                : "NO BLEED"}
            </span>
          </div>

          <p className="text-[11px] text-slate-300">{report?.checks.bleed.details}</p>
        </div>

        {/* 4. Color Space & Inks */}
        <div className="p-3 rounded-lg bg-[#141822] border border-[#242A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Color Space & Separation</span>
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

          <p className="text-[11px] text-slate-300">{report?.checks.colorspace.details}</p>
        </div>
      </div>
    </div>
  );
}
