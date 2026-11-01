"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { apiFetch, downloadBlob } from "@/lib/api";
import { LengthUnit, getStoredUnit, setStoredUnit } from "@/lib/units";
import { useDebounce } from "@/lib/useDebounce";
import type {
  SessionSummary,
  UploadedAsset,
  ExportJobSummary,
  WorkshopTelemetry,
  UniversalAnalysis,
  ProjectTag,
  DateFilterPreset,
  CustomTag,
  TagDisplayMode,
} from "@/components/home/types";
import { DEFAULT_TAGS } from "@/components/home/tagUtils";

import { DashboardHeader } from "@/components/home/DashboardHeader";
import { StagedIntakeDropzone } from "@/components/home/StagedIntakeDropzone";
import { StagedAssetWorkbench } from "@/components/home/StagedAssetWorkbench";
import { ProjectRegistryGrid } from "@/components/home/ProjectRegistryGrid";
import { BatchActionsToolbar } from "@/components/home/BatchActionsToolbar";
import { ProjectNotesModal } from "@/components/home/ProjectNotesModal";
import { ExportJobMonitor } from "@/components/home/ExportJobMonitor";
import { FileCombineModal } from "@/components/home/FileCombineModal";
import { RetentionSettingsModal } from "@/components/home/RetentionSettingsModal";
import { AssetPanel } from "@/components/home/AssetPanel";
import { AuditReport } from "@/components/home/AuditReport";

export default function HomePage() {
  const router = useRouter();
  const [unit, setUnitState] = useState<LengthUnit>("mm");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [error, setError] = useState<string | null>(null);

  // Database-backed state & Paginated Lazy Loading
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters & Views
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [customTags, setCustomTags] = useState<CustomTag[]>(DEFAULT_TAGS);
  const [tagDisplayMode, setTagDisplayMode] = useState<TagDisplayMode>("both");
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("today");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [viewMode, setViewMode] = useState<"grid" | "kanban">("kanban");

  // Batch Multi-Select
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  // Telemetry & Export Jobs
  const [telemetry, setTelemetry] = useState<WorkshopTelemetry | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportJobSummary[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [retentionDays, setRetentionDays] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Staged intake state (User drops files -> app does nothing until "Upload" is clicked)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState<boolean>(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [stagedPage, setStagedPage] = useState<number>(1);
  const [stagedPageSize, setStagedPageSize] = useState<number>(12);
  const [stagedTotalPages, setStagedTotalPages] = useState<number>(1);
  const [stagedTotalCount, setStagedTotalCount] = useState<number>(0);
  const [stagedSearchQuery, setStagedSearchQuery] = useState<string>("");
  const debouncedStagedSearch = useDebounce(stagedSearchQuery, 350);
  const [stagedFileType, setStagedFileType] = useState<string>("all");
  const [stagedDatePreset, setStagedDatePreset] = useState<DateFilterPreset>("today");

  // Modals state
  const [notesModalSession, setNotesModalSession] = useState<SessionSummary | null>(null);
  const [combineModalState, setCombineModalState] = useState<{
    isOpen: boolean;
    assets: UploadedAsset[];
  }>({
    isOpen: false,
    assets: [],
  });
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState<boolean>(false);

  // Preflight Analysis / Inspection View
  const [analysis, setAnalysis] = useState<UniversalAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [routingStudio, setRoutingStudio] = useState<string | null>(null);

  // Fetch paginated sessions from backend
  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(viewMode === "kanban" ? 100 : pageSize));

      if (studioFilter === "trash") {
        params.set("status", "trash");
      } else if (studioFilter === "archived") {
        params.set("status", "archived");
      } else {
        if (viewMode === "kanban") {
          params.set("status", "all");
        } else {
          params.set("status", "active");
        }
        if (studioFilter && studioFilter !== "all") {
          params.set("studio_type", studioFilter);
        }
      }

      if (tagFilter && tagFilter !== "all") {
        params.set("tag", tagFilter);
      }
      if (datePreset && datePreset !== "all") {
        params.set("date_preset", datePreset);
        if (datePreset === "custom") {
          if (dateFrom) params.set("date_from", String(new Date(dateFrom).getTime() / 1000));
          if (dateTo) params.set("date_to", String((new Date(dateTo).getTime() + 86400000) / 1000));
        }
      }
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const res = await apiFetch(`/api/sessions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setTotalCount(data.total_count || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch {
      setError("Unable to load project registry.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [page, pageSize, studioFilter, tagFilter, datePreset, dateFrom, dateTo, debouncedSearch, viewMode]);

  // Fetch telemetry & global state
  const fetchDashboardMeta = useCallback(async () => {
    setIsRefreshing(true);
    try {
      apiFetch(`/`)
        .then((res) => res.json())
        .then((data) => setBackendStatus(data.status === "ok" ? "online" : "offline"))
        .catch(() => setBackendStatus("offline"));

      setIsLoadingJobs(true);
      const jobsRes = await apiFetch(`/api/sessions/exports/jobs?limit=50`);
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setExportJobs(jobsData.jobs || []);
      }
      setIsLoadingJobs(false);

      const telemRes = await apiFetch(`/api/sessions/telemetry/stats`);
      if (telemRes.ok) {
        const telemData = await telemRes.json();
        setTelemetry(telemData);
      }

      const settingsRes = await apiFetch(`/api/settings`);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const days = settingsData.storage?.export_retention_days ?? 0;
        setRetentionDays(days);
      }

      const tagsRes = await apiFetch(`/api/settings/tags`);
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        if (Array.isArray(tagsData.tags) && tagsData.tags.length > 0) {
          setCustomTags(tagsData.tags);
        }
        if (tagsData.tag_display_mode) {
          setTagDisplayMode(tagsData.tag_display_mode);
        }
      }
    } catch {
      // Ignore background refresh errors
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch database-persisted staged intake assets
  const fetchIntakeAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(stagedPage));
      params.set("page_size", String(stagedPageSize));
      if (stagedFileType && stagedFileType !== "all") {
        params.set("file_type", stagedFileType);
      }
      if (stagedDatePreset && stagedDatePreset !== "all") {
        params.set("date_preset", stagedDatePreset);
      }
      if (debouncedStagedSearch.trim()) {
        params.set("search", debouncedStagedSearch.trim());
      }

      const res = await apiFetch(`/api/intake/assets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.assets)) {
          setUploadedAssets(data.assets);
          setStagedTotalCount(data.total_count || 0);
          setStagedTotalPages(data.total_pages || 1);
          setSelectedFileIds((prev) => {
            const existingSet = new Set(prev);
            return data.assets
              .map((a: UploadedAsset) => a.file_id)
              .filter((id: string) => existingSet.has(id));
          });
        }
      }
    } catch {
      // non-critical background fetch
    }
  }, [stagedPage, stagedPageSize, stagedFileType, stagedDatePreset, debouncedStagedSearch]);

  const handleRenameStagedAsset = async (fileId: string, newFilename: string) => {
    try {
      const res = await apiFetch(`/api/intake/assets/${encodeURIComponent(fileId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: newFilename }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.asset) {
          setUploadedAssets((prev) =>
            prev.map((a) => (a.file_id === fileId ? data.asset : a))
          );
        }
      }
    } catch {
      setError("Failed to rename staged file");
    }
  };

  useEffect(() => {
    setUnitState(getStoredUnit("mm"));
    void fetchDashboardMeta();
    void fetchIntakeAssets();
  }, [fetchDashboardMeta, fetchIntakeAssets]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleUnitChange = (newUnit: LengthUnit) => {
    setUnitState(newUnit);
    setStoredUnit(newUnit);
  };

  // --- Staged Dropzone Handlers ---
  const handleAddStagedFiles = (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    setStagedFiles((prev) => [...prev, ...fileArray]);
    setError(null);
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearStagedFiles = () => {
    setStagedFiles([]);
  };

  const handleUploadBatch = async () => {
    if (stagedFiles.length === 0) return;
    setIsUploadingBatch(true);
    setError(null);

    const formData = new FormData();
    stagedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await apiFetch(`/api/intake/upload-batch`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        await fetchIntakeAssets();
        setStagedFiles([]);
        void fetchDashboardMeta();
      } else {
        throw new Error("Invalid response from intake upload endpoint");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error uploading files");
    } finally {
      setIsUploadingBatch(false);
    }
  };

  // --- Workbench Handlers ---
  const handleToggleSelectAsset = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSelectAllAssets = () => {
    setSelectedFileIds(uploadedAssets.map((a) => a.file_id));
  };

  const handleDeselectAllAssets = () => {
    setSelectedFileIds([]);
  };

  const handleRemoveAsset = async (fileId: string) => {
    setUploadedAssets((prev) => prev.filter((a) => a.file_id !== fileId));
    setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
    try {
      await apiFetch(`/api/intake/assets/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
    } catch {
      // non-critical error
    }
  };

  const handleClearAllAssets = async () => {
    setUploadedAssets([]);
    setSelectedFileIds([]);
    try {
      await apiFetch(`/api/intake/assets`, {
        method: "DELETE",
      });
    } catch {
      // non-critical error
    }
  };

  const handleDeleteSelected = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;
    setUploadedAssets((prev) => prev.filter((a) => !fileIds.includes(a.file_id)));
    setSelectedFileIds((prev) => prev.filter((id) => !fileIds.includes(id)));
    try {
      await Promise.all(
        fileIds.map((id) =>
          apiFetch(`/api/intake/assets/${encodeURIComponent(id)}`, { method: "DELETE" })
        )
      );
      void fetchIntakeAssets();
      void fetchDashboardMeta();
    } catch {
      setError("Failed to delete selected files");
    }
  };

  const handleUploadDirect = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    try {
      const res = await apiFetch(`/api/intake/upload-batch`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        void fetchIntakeAssets();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to upload files");
    }
  };

  const handleAnalyzeSelected = async (targetAssets: UploadedAsset[]) => {
    if (targetAssets.length === 0) return;
    const primary = targetAssets[0];
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: primary.file_path }),
      });

      if (!res.ok) {
        throw new Error(`Preflight inspection failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error || "Unable to inspect artwork format.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inspecting asset");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRouteSingleToStudio = (studio: string, asset: UploadedAsset) => {
    setRoutingStudio(studio);
    const isBook = asset.page_count > 1;

    setTimeout(() => {
      if (studio === "imposing") {
        const params = new URLSearchParams({
          file_id: asset.file_id,
          name: asset.filename,
          w: String(asset.width_mm),
          h: String(asset.height_mm),
          page_count: String(asset.page_count),
          job_mode: isBook ? "book" : "gang",
        });
        router.push(`/imposing?${params.toString()}`);
      } else if (studio === "book-studio") {
        const params = new URLSearchParams({
          file_path: asset.file_path,
          name: asset.filename,
        });
        router.push(`/book-studio?${params.toString()}`);
      } else {
        const params = new URLSearchParams({
          file_id: asset.file_id,
          name: asset.filename,
        });
        router.push(`/${studio}?${params.toString()}`);
      }
    }, 150);
  };

  const handleRequestCombine = (selectedAssets: UploadedAsset[]) => {
    setCombineModalState({
      isOpen: true,
      assets: selectedAssets.length > 0 ? selectedAssets : uploadedAssets,
    });
  };

  const handleCombineSuccess = (combinedAsset: UploadedAsset) => {
    void fetchIntakeAssets();
    setSelectedFileIds([combinedAsset.file_id]);
  };

  // --- Project Registry Handlers ---
  const handleResumeSession = (session: SessionSummary) => {
    const studioType = session.studio_type;
    const studioRoute = studioType === "book_scan" ? "book-studio" : studioType;
    router.push(`/${studioRoute}?session_id=${session.id}&name=${encodeURIComponent(session.original_filename || session.title)}`);
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, original_filename: newTitle }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, original_filename: newTitle } : s))
        );
      }
    } catch {
      setError("Failed to rename project");
    }
  };

  const handleUpdateTag = async (sessionId: string, newTag: ProjectTag) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: newTag }),
      });
      if (res.ok) {
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to update status tag");
    }
  };

  const handleSaveNotes = async (sessionId: string, notes: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, notes } : s))
        );
      }
    } catch {
      setError("Failed to save project notes");
    }
  };

  const handleToggleArchiveSession = async (sessionId: string, currentStatus: string) => {
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to update archive status");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionId));
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to move project to trash");
    }
  };

  const handleRestoreSession = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to restore project from trash");
    }
  };

  const handleDeletePermanentSession = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}?permanent=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionId));
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to permanently delete project");
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await apiFetch(`/api/sessions/trash/empty`, {
        method: "POST",
      });
      if (res.ok) {
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to empty trash");
    }
  };

  const handleSaveCustomTag = async (tag: CustomTag) => {
    try {
      const res = await apiFetch(`/api/settings/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tag),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomTags(data.tags);
      }
    } catch {
      setError("Failed to save custom tag");
    }
  };

  const handleDeleteCustomTag = async (tagId: string) => {
    try {
      const res = await apiFetch(`/api/settings/tags/${tagId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setCustomTags(data.tags);
        if (tagFilter === tagId) setTagFilter("all");
      }
    } catch {
      setError("Failed to delete tag");
    }
  };

  const handleUpdateTagDisplayMode = async (mode: TagDisplayMode) => {
    try {
      const res = await apiFetch(`/api/settings/tags/display-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_mode: mode }),
      });
      if (res.ok) {
        setTagDisplayMode(mode);
      }
    } catch {
      setError("Failed to update tag display preference");
    }
  };

  // --- Batch Actions ---
  const handleToggleSelectSession = (sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleSelectAllSessions = () => {
    setSelectedSessionIds(sessions.map((s) => s.id));
  };

  const handleDeselectAllSessions = () => {
    setSelectedSessionIds([]);
  };

  const handleBatchTag = async (tag: ProjectTag) => {
    if (selectedSessionIds.length === 0) return;
    try {
      const res = await apiFetch(`/api/sessions/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_ids: selectedSessionIds, tag }),
      });
      if (res.ok) {
        setSelectedSessionIds([]);
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to apply batch status tag");
    }
  };

  const handleBatchArchive = async (status: "archived" | "active") => {
    if (selectedSessionIds.length === 0) return;
    try {
      const res = await apiFetch(`/api/sessions/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_ids: selectedSessionIds, status }),
      });
      if (res.ok) {
        setSelectedSessionIds([]);
        void fetchSessions();
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to apply batch archive");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSessionIds.length === 0) return;
    try {
      await Promise.all(
        selectedSessionIds.map((id) =>
          apiFetch(`/api/sessions/${id}`, { method: "DELETE" })
        )
      );
      setSelectedSessionIds([]);
      void fetchSessions();
      void fetchDashboardMeta();
    } catch {
      setError("Failed to delete selected projects");
    }
  };

  const handleDeleteExportJob = async (jobId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/exports/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExportJobs((prev) => prev.filter((j) => j.jobId !== jobId));
        void fetchDashboardMeta();
      }
    } catch {
      setError("Failed to delete export deliverable");
    }
  };

  const handleLaunchNewStudio = (studio: string) => {
    router.push(`/${studio}`);
  };

  // Preflight report handlers
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

  const handleAnalyzeAnother = () => {
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-16 animate-in fade-in duration-200">
      {/* Top Header & Workshop Telemetry */}
      <DashboardHeader
        telemetry={telemetry}
        backendStatus={backendStatus}
        unit={unit}
        onUnitChange={handleUnitChange}
        onOpenRetentionModal={() => setIsRetentionModalOpen(true)}
        onRefresh={() => {
          void fetchSessions();
          void fetchDashboardMeta();
          void fetchIntakeAssets();
        }}
        isRefreshing={isRefreshing}
      />

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-red-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* If Preflight Inspection is active: Master/Detail Report View */}
      {analysis ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#242A38]">
            <nav className="flex items-center space-x-2 text-xs" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={handleAnalyzeAnother}
                className="font-semibold text-cyan-400 hover:underline cursor-pointer"
              >
                &larr; Return to Command Dashboard
              </button>
              <span className="text-slate-500">/</span>
              <span className="font-semibold text-white">Preflight Inspector</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400 font-mono">{analysis.filename}</span>
            </nav>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <AssetPanel
              analysis={analysis}
              routingStudio={routingStudio}
              unit={unit}
              onRouteToStudio={(studio, item) => {
                const isBook = item.page_count > 1;
                if (studio === "imposing") {
                  router.push(`/imposing?file_id=${item.file_id}&name=${item.filename}&job_mode=${isBook ? "book" : "gang"}`);
                } else if (studio === "book-studio") {
                  router.push(`/book-studio?file_path=${item.file_path}&name=${item.filename}`);
                } else {
                  router.push(`/${studio}?file_id=${item.file_id}&name=${item.filename}`);
                }
              }}
              onAnalyzeAnother={handleAnalyzeAnother}
              formatFileSize={(b) => `${(b / (1024 * 1024)).toFixed(2)} MB`}
            />
            <AuditReport
              analysis={analysis}
              isExportingPdf={isExportingPdf}
              unit={unit}
              onExportPdf={handleExportPdfReport}
            />
          </div>
        </div>
      ) : (
        /* Standard Command Dashboard View */
        <div className="space-y-6">
          {/* Staged File Intake (Dropzone) */}
          <StagedIntakeDropzone
            stagedFiles={stagedFiles}
            onAddFiles={handleAddStagedFiles}
            onRemoveFile={handleRemoveStagedFile}
            onClearFiles={handleClearStagedFiles}
            onUploadBatch={handleUploadBatch}
            isUploading={isUploadingBatch}
            hasStagedAssets={uploadedAssets.length > 0 || stagedTotalCount > 0}
          />

          {/* Staged Asset Workbench (Active Uploaded Artwork) */}
          <StagedAssetWorkbench
            assets={uploadedAssets}
            selectedFileIds={selectedFileIds}
            unit={unit}
            onToggleSelect={handleToggleSelectAsset}
            onSelectAll={handleSelectAllAssets}
            onDeselectAll={handleDeselectAllAssets}
            onRemoveAsset={handleRemoveAsset}
            onDeleteSelected={handleDeleteSelected}
            onUploadFiles={handleUploadDirect}
            onClearAllAssets={handleClearAllAssets}
            onRenameAsset={handleRenameStagedAsset}
            onAnalyzeSelected={handleAnalyzeSelected}
            onRouteSingleToStudio={handleRouteSingleToStudio}
            onRequestCombine={handleRequestCombine}
            searchQuery={stagedSearchQuery}
            onSearchChange={(q) => {
              setStagedSearchQuery(q);
              setStagedPage(1);
            }}
            fileTypeFilter={stagedFileType}
            onFileTypeFilterChange={(t) => {
              setStagedFileType(t);
              setStagedPage(1);
            }}
            datePreset={stagedDatePreset}
            onDatePresetChange={(p) => {
              setStagedDatePreset(p);
              setStagedPage(1);
            }}
            page={stagedPage}
            pageSize={stagedPageSize}
            totalCount={stagedTotalCount}
            totalPages={stagedTotalPages}
            onPageChange={(p) => setStagedPage(p)}
            onPageSizeChange={(s) => {
              setStagedPageSize(s);
              setStagedPage(1);
            }}
          />

          {/* Center Stage: Projects Registry Grid & Kanban (Option A) */}
          <div className="pt-2">
            <ProjectRegistryGrid
              sessions={sessions}
              isLoading={isLoadingSessions}
              unit={unit}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              studioFilter={studioFilter}
              onStudioFilterChange={(st) => {
                setStudioFilter(st);
                setPage(1);
              }}
              tagFilter={tagFilter}
              onTagFilterChange={(tg) => {
                setTagFilter(tg);
                setPage(1);
              }}
              customTags={customTags}
              tagDisplayMode={tagDisplayMode}
              onSaveCustomTag={handleSaveCustomTag}
              onDeleteCustomTag={handleDeleteCustomTag}
              onUpdateTagDisplayMode={handleUpdateTagDisplayMode}
              datePreset={datePreset}
              onDatePresetChange={(dp) => {
                setDatePreset(dp);
                setPage(1);
              }}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onCustomDateChange={(df, dt) => {
                setDateFrom(df);
                setDateTo(dt);
                setPage(1);
              }}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setPage(1);
              }}
              viewMode={viewMode}
              onViewModeChange={(m) => setViewMode(m)}
              selectedSessionIds={selectedSessionIds}
              onToggleSelect={handleToggleSelectSession}
              onResumeSession={handleResumeSession}
              onRenameSession={handleRenameSession}
              onUpdateTag={handleUpdateTag}
              onToggleArchiveSession={handleToggleArchiveSession}
              onDeleteSession={handleDeleteSession}
              onRestoreSession={handleRestoreSession}
              onDeletePermanentSession={handleDeletePermanentSession}
              onEmptyTrash={handleEmptyTrash}
              onOpenNotes={(sess) => setNotesModalSession(sess)}
              onLaunchNewStudio={handleLaunchNewStudio}
            />
          </div>

          {/* Background Export Deliverables Pipeline */}
          <ExportJobMonitor
            jobs={exportJobs}
            isLoading={isLoadingJobs}
            retentionDays={retentionDays}
            onOpenRetentionModal={() => setIsRetentionModalOpen(true)}
            onDeleteJob={handleDeleteExportJob}
            onRefreshJobs={fetchDashboardMeta}
          />
        </div>
      )}

      {/* Floating Batch Actions Toolbar */}
      <BatchActionsToolbar
        selectedCount={selectedSessionIds.length}
        totalCount={totalCount}
        onSelectAll={handleSelectAllSessions}
        onDeselectAll={handleDeselectAllSessions}
        onBatchTag={handleBatchTag}
        onBatchArchive={handleBatchArchive}
        onBatchDelete={handleBatchDelete}
      />

      {/* Project Notes Modal */}
      <ProjectNotesModal
        isOpen={Boolean(notesModalSession)}
        session={notesModalSession}
        onClose={() => setNotesModalSession(null)}
        onSaveNotes={handleSaveNotes}
      />

      {/* Multi-File Combine & Interleave Modal */}
      <FileCombineModal
        isOpen={combineModalState.isOpen}
        onClose={() => setCombineModalState((prev) => ({ ...prev, isOpen: false }))}
        initialAssets={combineModalState.assets}
        allStagedAssets={uploadedAssets}
        unit={unit}
        onCombineSuccess={handleCombineSuccess}
      />

      {/* Export Retention Policy Settings Modal */}
      <RetentionSettingsModal
        isOpen={isRetentionModalOpen}
        onClose={() => setIsRetentionModalOpen(false)}
        currentRetentionDays={retentionDays}
        onSaved={(newDays) => {
          setRetentionDays(newDays);
          void fetchDashboardMeta();
        }}
      />
    </div>
  );
}
