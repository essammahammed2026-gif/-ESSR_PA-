"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Trash2,
  FileCheck,
  RefreshCw,
  Clock,
  Layers,
  FileArchive,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ExportJobSummary } from "./types";
import { apiFetch, downloadBlob } from "@/lib/api";
import { formatBytes } from "@/lib/units";
import { timeAgo } from "./tagUtils";

interface ExportJobMonitorProps {
  jobs?: ExportJobSummary[];
  isLoading?: boolean;
  retentionDays: number;
  onOpenRetentionModal: () => void;
  onDeleteJob?: (jobId: string) => void;
  onRefreshJobs?: () => void;
}

type ExportStatusFilter = "all" | "success" | "fail";

export function ExportJobMonitor({
  retentionDays,
  onOpenRetentionModal,
  onDeleteJob,
  onRefreshJobs,
}: ExportJobMonitorProps) {
  const [statusFilter, setStatusFilter] = useState<ExportStatusFilter>("all");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [jobsList, setJobsList] = useState<ExportJobSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchExportJobs = useCallback(async (targetPage = page, filter = statusFilter, size = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", String(size));
      if (filter !== "all") {
        params.set("status", filter);
      }
      const res = await apiFetch(`/api/sessions/exports/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobsList(data.jobs || []);
        setTotalCount(data.total_count ?? (data.jobs ? data.jobs.length : 0));
        setTotalPages(data.total_pages ?? 1);
      }
    } catch {
      // Ignore background refresh errors
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, pageSize]);

  useEffect(() => {
    void fetchExportJobs(page, statusFilter, pageSize);
  }, [page, statusFilter, pageSize, fetchExportJobs]);

  const handleFilterChange = (newFilter: ExportStatusFilter) => {
    setStatusFilter(newFilter);
    setPage(1);
  };

  const handleDownload = async (job: ExportJobSummary) => {
    const rawName = job.filename || job.outputFilePath?.split(/[/\\]/).pop() || `Export_${job.jobId.slice(0, 8)}.pdf`;
    const cleanName = rawName.replace(/^(?:sync_|export_)?[a-f0-9\-]{8,36}_/, "");
    await downloadBlob(`/api/sessions/exports/${job.jobId}/download`, cleanName);
  };

  const handleDelete = async (jobId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/exports/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        if (onDeleteJob) onDeleteJob(jobId);
        void fetchExportJobs(page, statusFilter, pageSize);
      }
    } catch {
      // Ignore error
    }
  };

  const handleRefresh = () => {
    void fetchExportJobs(page, statusFilter, pageSize);
    if (onRefreshJobs) onRefreshJobs();
  };

  const retentionText =
    retentionDays === 0
      ? "Kept Forever"
      : retentionDays === 1
      ? "Auto-expires in 24h"
      : `Auto-expires in ${retentionDays}d`;

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="bg-[#181D27] border border-[#242A38] rounded-xl p-3.5 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#242A38] gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FileCheck size={16} className="text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Export Log
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
              {totalCount}
            </span>
          </div>

          {/* Status Filters: All / Success / Fail */}
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleFilterChange("all")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("success")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                statusFilter === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              <CheckCircle2 size={11} />
              <span>Success</span>
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("fail")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                statusFilter === "fail"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "text-slate-400 hover:text-red-300"
              }`}
            >
              <XCircle size={11} />
              <span>Fail</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {/* Retention Policy Trigger */}
          <button
            type="button"
            onClick={onOpenRetentionModal}
            className="flex items-center space-x-1 text-[11px] font-semibold text-slate-400 hover:text-cyan-400 bg-[#131720] hover:bg-slate-800 border border-[#2E3648] px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
            title="Configure export retention policy"
          >
            <Clock size={11} />
            <span>{retentionText}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh export log"
          >
            <RefreshCw size={12} className={loading ? "animate-spin text-cyan-400" : ""} />
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {jobsList.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-1">
          <FileText size={20} className="text-slate-600 mb-1" />
          <span>
            {statusFilter === "all"
              ? "No export logs found."
              : `No export logs matching filter "${statusFilter}".`}
          </span>
        </div>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {jobsList.map((job) => {
            const isProcessing = job.status === "processing" || job.status === "queued";
            const isFailed = job.status === "failed";
            const isCompleted = job.status === "completed";
            const rawFilename =
              job.filename ||
              job.outputFilePath?.split(/[/\\]/).pop() ||
              `Export_${job.jobId.slice(0, 8)}`;
            const filename = rawFilename.replace(/^(?:sync_|export_)?[a-f0-9\-]{8,36}_/, "");
            const isZip = filename.toLowerCase().endsWith(".zip");

            return (
              <div
                key={job.jobId}
                className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                  isProcessing
                    ? "bg-cyan-950/20 border-cyan-500/40"
                    : isFailed
                    ? "bg-red-950/20 border-red-500/30"
                    : "bg-[#131720] border-[#242A38] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  {isProcessing ? (
                    <RefreshCw size={15} className="text-cyan-400 animate-spin shrink-0" />
                  ) : isZip ? (
                    <FileArchive size={15} className="text-amber-400 shrink-0" />
                  ) : (
                    <FileText size={15} className="text-emerald-400 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200 truncate" title={filename}>
                        {filename}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          isProcessing
                            ? "bg-cyan-500/20 text-cyan-300"
                            : isFailed
                            ? "bg-red-500/20 text-red-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {isProcessing ? (
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{job.message || "Processing in background..."}</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-cyan-400 h-full transition-all duration-300"
                            style={{ width: `${Math.max(5, job.progress)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center space-x-2 font-mono mt-0.5">
                        {job.fileSizeBytes ? <span>{formatBytes(job.fileSizeBytes)}</span> : null}
                        {job.totalPages ? (
                          <>
                            <span>&bull;</span>
                            <span>{job.totalPages} pages</span>
                          </>
                        ) : null}
                        <span>&bull;</span>
                        <span>Completed {timeAgo(job.created_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleDownload(job)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                      title="Download completed deliverable"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(job.jobId)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete deliverable"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lazy Loading / Pagination Footer */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#242A38] text-[11px] text-slate-400">
          <div className="font-mono">
            Showing <span className="text-white font-semibold">{startItem}</span>&ndash;
            <span className="text-white font-semibold">{endItem}</span> of{" "}
            <span className="text-white font-semibold">{totalCount}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="p-1 rounded bg-[#131720] border border-[#2E3648] hover:border-slate-500 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1 rounded bg-[#131720] border border-[#2E3648] hover:border-slate-500 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next Page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
