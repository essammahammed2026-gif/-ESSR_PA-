"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2,
  RefreshCw,
  HardDrive,
  Sparkles,
  Layers,
  Clock,
  PlayCircle,
  Archive,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  CheckSquare,
  Square,
  Calendar,
  Loader2,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/units";
import type { StorageStatus } from "./types";

interface ModalItem {
  id: string;
  title: string;
  subtitle?: string;
  sizeBytes: number;
  dateStr: string;
  metaBadge?: string;
}

export default function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Uploaded files date pruning state
  const [pruneDate, setPruneDate] = useState<string>("");

  // Manage / Select & Delete Modal State
  const [activeModal, setActiveModal] = useState<"uploaded" | "archived" | "pending" | "in_progress" | null>(null);
  const [modalItems, setModalItems] = useState<ModalItem[]>([]);
  const [loadingModalItems, setLoadingModalItems] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState<boolean>(false);

  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings/storage-status");
      if (res.ok) {
        const data: StorageStatus = await res.json();
        setStatus(data);
      }
    } catch {
      setErrorMsg("Failed to read storage status from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Quick Action: Clear Cache (Safe runtime cache, textures, thumbnails)
  const handleClearCache = async () => {
    setActionLoading("cache");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings/clean-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "safe" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Cache cleared successfully! Freed ${data.freed_human}.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setErrorMsg("Failed to clear cache.");
      }
    } catch {
      setErrorMsg("Network error clearing cache.");
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Action: Clear Build (Next.js & Tauri compilation build cache)
  const handleClearBuild = async () => {
    setActionLoading("build");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings/clean-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "build" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Build cache cleared successfully! Freed ${data.freed_human}.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setErrorMsg("Failed to clear build cache.");
      }
    } catch {
      setErrorMsg("Network error clearing build cache.");
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Action: Empty Trash
  const handleEmptyTrash = async () => {
    const count = status?.breakdown?.trash.count ?? status?.trash_count ?? 0;
    if (count === 0) {
      setSuccessMsg("Trash is already empty.");
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete all ${count} projects in Trash? This cannot be undone.`)) {
      return;
    }

    setActionLoading("trash");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings/empty-trash", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message || "Trash emptied successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setErrorMsg("Failed to empty trash.");
      }
    } catch {
      setErrorMsg("Network error emptying trash.");
    } finally {
      setActionLoading(null);
    }
  };

  // Uploaded Files: Prune by Date
  const handlePruneUploadedByDate = async () => {
    if (!pruneDate) {
      setErrorMsg("Please select a date first.");
      return;
    }
    const targetTimestamp = new Date(pruneDate).getTime() / 1000 + 86400; // End of that day
    if (!confirm(`Permanently delete all uploaded files created on or before ${pruneDate}?`)) {
      return;
    }

    setActionLoading("pruneDate");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/intake/assets/prune-by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before_timestamp: targetTimestamp }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Pruned ${data.deleted_count} files (${formatBytes(data.freed_bytes)} freed).`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setPruneDate("");
        await fetchStatus();
      } else {
        setErrorMsg("Failed to prune uploaded files.");
      }
    } catch {
      setErrorMsg("Network error pruning uploaded files.");
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Action: Clear All Uploaded Files
  const handleClearAllUploaded = async () => {
    const count = status?.breakdown?.uploaded.count ?? 0;
    if (count === 0) return;
    if (!confirm(`Permanently delete all ${count} uploaded files in staging? This cannot be undone.`)) {
      return;
    }

    setActionLoading("clearUploaded");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/intake/assets", { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg(`All ${count} uploaded files removed.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setErrorMsg("Failed to clear uploaded files.");
      }
    } catch {
      setErrorMsg("Network error clearing uploaded files.");
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Action: Delete All Archived Sessions
  const handleClearAllArchived = async () => {
    const count = status?.breakdown?.archived.count ?? 0;
    if (count === 0) return;
    if (!confirm(`Permanently delete all ${count} archived projects? This cannot be undone.`)) {
      return;
    }

    setActionLoading("clearArchived");
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const listRes = await apiFetch("/api/sessions?status=archived&page_size=500");
      if (listRes.ok) {
        const data = await listRes.json();
        const sessionIds = (data.sessions || []).map((s: { id: string }) => s.id);
        if (sessionIds.length > 0) {
          const delRes = await apiFetch("/api/sessions/batch-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_ids: sessionIds, permanent: true }),
          });
          if (delRes.ok) {
            const delData = await delRes.json();
            setSuccessMsg(`Deleted ${delData.deleted_count} archived projects (${formatBytes(delData.freed_bytes)} freed).`);
            setTimeout(() => setSuccessMsg(null), 4000);
            await fetchStatus();
            return;
          }
        }
      }
      setErrorMsg("Failed to delete archived projects.");
    } catch {
      setErrorMsg("Network error deleting archived projects.");
    } finally {
      setActionLoading(null);
    }
  };

  // Open "Select & Delete" Modal for a Category
  const openSelectModal = async (category: "uploaded" | "archived" | "pending" | "in_progress") => {
    setActiveModal(category);
    setSelectedItemIds(new Set());
    setModalSearch("");
    setLoadingModalItems(true);
    setModalItems([]);

    try {
      if (category === "uploaded") {
        const res = await apiFetch("/api/intake/assets?page_size=1000");
        if (res.ok) {
          const data = await res.json();
          const items: ModalItem[] = (data.assets || []).map((a: {
            file_id: string;
            filename: string;
            file_size: number;
            page_count: number;
            created_at: number;
          }) => ({
            id: a.file_id,
            title: a.filename,
            subtitle: `${a.page_count} page${a.page_count === 1 ? "" : "s"}`,
            sizeBytes: a.file_size || 0,
            dateStr: new Date((a.created_at || Date.now() / 1000) * 1000).toLocaleDateString(),
            metaBadge: a.filename.endsWith(".pdf") ? "PDF" : "Image",
          }));
          setModalItems(items);
        }
      } else {
        // Sessions query
        let query = "/api/sessions?page_size=500";
        if (category === "archived") query += "&status=archived";
        else if (category === "pending") query += "&status=active&tag=pending";
        else if (category === "in_progress") query += "&status=active&tag=in-progress";

        const res = await apiFetch(query);
        if (res.ok) {
          const data = await res.json();
          const items: ModalItem[] = (data.sessions || []).map((s: {
            id: string;
            title: string;
            original_filename?: string;
            file_size_bytes: number;
            studio_type: string;
            pages?: unknown[];
            updated_at: number;
          }) => ({
            id: s.id,
            title: s.title || s.original_filename || s.id,
            subtitle: s.studio_type ? `Studio: ${s.studio_type}` : undefined,
            sizeBytes: s.file_size_bytes || 0,
            dateStr: new Date((s.updated_at || Date.now() / 1000) * 1000).toLocaleDateString(),
            metaBadge: s.studio_type || "Session",
          }));
          setModalItems(items);
        }
      }
    } catch {
      setErrorMsg("Failed to load category items.");
    } finally {
      setLoadingModalItems(false);
    }
  };

  // Modal Item Selection Handlers
  const filteredModalItems = useMemo(() => {
    if (!modalSearch.trim()) return modalItems;
    const term = modalSearch.toLowerCase();
    return modalItems.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(term))
    );
  }, [modalItems, modalSearch]);

  const toggleModalItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllModal = () => {
    setSelectedItemIds(new Set(filteredModalItems.map((i) => i.id)));
  };

  const handleDeselectAllModal = () => {
    setSelectedItemIds(new Set());
  };

  // Execute Deletion of Selected Modal Items
  const handleDeleteSelectedModal = async () => {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${ids.length} selected items? This cannot be undone.`)) {
      return;
    }

    setIsDeletingSelected(true);
    setErrorMsg(null);
    try {
      if (activeModal === "uploaded") {
        const res = await apiFetch("/api/intake/assets/batch-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_ids: ids }),
        });
        if (res.ok) {
          const data = await res.json();
          setSuccessMsg(`Deleted ${data.deleted_count} files (${formatBytes(data.freed_bytes)} freed).`);
          setTimeout(() => setSuccessMsg(null), 4000);
          setModalItems((prev) => prev.filter((i) => !selectedItemIds.has(i.id)));
          setSelectedItemIds(new Set());
          await fetchStatus();
        } else {
          setErrorMsg("Failed to delete selected files.");
        }
      } else {
        const res = await apiFetch("/api/sessions/batch-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_ids: ids, permanent: true }),
        });
        if (res.ok) {
          const data = await res.json();
          setSuccessMsg(`Deleted ${data.deleted_count} sessions (${formatBytes(data.freed_bytes)} freed).`);
          setTimeout(() => setSuccessMsg(null), 4000);
          setModalItems((prev) => prev.filter((i) => !selectedItemIds.has(i.id)));
          setSelectedItemIds(new Set());
          await fetchStatus();
        } else {
          setErrorMsg("Failed to delete selected sessions.");
        }
      }
    } catch {
      setErrorMsg("Network error deleting items.");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const selectedTotalBytes = useMemo(() => {
    return modalItems
      .filter((i) => selectedItemIds.has(i.id))
      .reduce((acc, curr) => acc + curr.sizeBytes, 0);
  }, [modalItems, selectedItemIds]);

  const bd = status?.breakdown;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in duration-150">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center space-x-2 animate-in fade-in duration-150">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="bg-[#181D27] border border-[#242A38] rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242A38]">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <HardDrive size={18} className="text-cyan-400" />
              <h2 className="text-base font-bold text-white tracking-wide">Storage & Cleanup</h2>
            </div>
            <p className="text-xs text-slate-400">
              Manage workspace disk usage, intake artwork, working sessions, and system caches.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Total Tracked:</span>
            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-[#131720] border border-[#2E3648] font-mono">
              {status?.total_human || "0 B"}
            </span>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Storage Status"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
            </button>
          </div>
        </div>

        {/* Top 3 Quick Action Buttons: Clear Cache, Clear Build, Empty Trash */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Clear Cache */}
          <button
            type="button"
            onClick={handleClearCache}
            disabled={actionLoading !== null}
            className="flex items-center justify-between p-3 rounded-xl bg-[#131720] hover:bg-[#1A202E] border border-[#2E3648] hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-white">Clear Cache</div>
                <div className="text-[11px] text-slate-400">Thumbnails & textures</div>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
              {bd?.cache.size_human || status?.safe_cleanable_human || "0 B"}
            </span>
          </button>

          {/* Clear Build */}
          <button
            type="button"
            onClick={handleClearBuild}
            disabled={actionLoading !== null}
            className="flex items-center justify-between p-3 rounded-xl bg-[#131720] hover:bg-[#1A202E] border border-[#2E3648] hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                <Layers size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-white">Clear Build</div>
                <div className="text-[11px] text-slate-400">Next.js & Tauri cache</div>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/20">
              {bd?.build.size_human || status?.build_cleanable_human || "0 B"}
            </span>
          </button>

          {/* Empty Trash */}
          <button
            type="button"
            onClick={handleEmptyTrash}
            disabled={actionLoading !== null || (bd?.trash.count ?? status?.trash_count ?? 0) === 0}
            className="flex items-center justify-between p-3 rounded-xl bg-red-950/15 hover:bg-red-950/30 border border-red-500/30 hover:border-red-500/60 text-left transition-all cursor-pointer group shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:scale-105 transition-transform">
                <Trash2 size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-red-300 group-hover:text-red-200">Empty Trash</div>
                <div className="text-[11px] text-red-400/80">Purge soft-deleted</div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-red-300 bg-red-900/40 px-2 py-0.5 rounded border border-red-500/30">
              {bd?.trash.count ?? status?.trash_count ?? 0} items
            </span>
          </button>
        </div>
      </div>

      {/* 4 Main Storage Categories: Uploaded Files, Archived Files, Pending Files, In-Progress Files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Uploaded Files (Staged Intake Artwork) */}
        <div className="bg-[#181D27] border border-[#242A38] rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <UploadCloud size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Uploaded Files</h3>
                  <p className="text-[11px] text-slate-400">Raw PDF & image uploads in originals storage</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                  {bd?.uploaded.size_human || "0 B"}
                </span>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {bd?.uploaded.count ?? 0} files
                </div>
              </div>
            </div>

            {/* Date-picker prune control */}
            <div className="p-3 bg-[#131720] border border-[#242A38] rounded-xl space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                <Calendar size={13} className="text-cyan-400" />
                <span>Delete files uploaded before:</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={pruneDate}
                  onChange={(e) => setPruneDate(e.target.value)}
                  className="flex-1 bg-[#181D27] border border-[#2E3648] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handlePruneUploadedByDate}
                  disabled={!pruneDate || actionLoading !== null}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prune
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#242A38]/70">
            <button
              type="button"
              onClick={() => openSelectModal("uploaded")}
              className="px-3 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Select & Delete...
            </button>
            <button
              type="button"
              onClick={handleClearAllUploaded}
              disabled={(bd?.uploaded.count ?? 0) === 0}
              className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer disabled:opacity-30 disabled:no-underline"
            >
              Clear All Uploads
            </button>
          </div>
        </div>

        {/* 2. Archived Files */}
        <div className="bg-[#181D27] border border-[#242A38] rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-slate-500/10 text-slate-300">
                  <Archive size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Archived Files</h3>
                  <p className="text-[11px] text-slate-400">Completed jobs marked as done or archived</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-700">
                  {bd?.archived.size_human || "0 B"}
                </span>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {bd?.archived.count ?? 0} projects
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Archived projects hold exported deliverables and working slice files. You can safely purge them to reclaim local disk space.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#242A38]/70">
            <button
              type="button"
              onClick={() => openSelectModal("archived")}
              className="px-3 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Select & Delete...
            </button>
            <button
              type="button"
              onClick={handleClearAllArchived}
              disabled={(bd?.archived.count ?? 0) === 0}
              className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer disabled:opacity-30 disabled:no-underline"
            >
              Delete All Archived
            </button>
          </div>
        </div>

        {/* 3. Pending Files */}
        <div className="bg-[#181D27] border border-[#242A38] rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pending Files</h3>
                  <p className="text-[11px] text-slate-400">Projects in queue waiting to be processed</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  {bd?.pending.size_human || "0 B"}
                </span>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {bd?.pending.count ?? 0} projects
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Active intake jobs tagged as Pending. Review and selectively clean up unneeded or duplicate queued tasks.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#242A38]/70">
            <button
              type="button"
              onClick={() => openSelectModal("pending")}
              className="px-3 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Select & Delete...
            </button>
            <span className="text-[11px] text-slate-500">Granular control</span>
          </div>
        </div>

        {/* 4. In-Progress Files */}
        <div className="bg-[#181D27] border border-[#242A38] rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <PlayCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">In-Progress Files</h3>
                  <p className="text-[11px] text-slate-400">Active projects currently undergoing editing</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                  {bd?.in_progress.size_human || "0 B"}
                </span>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {bd?.in_progress.count ?? 0} projects
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Working projects containing active edits, layer settings, and sliced pages. Delete abandoned drafts safely.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#242A38]/70">
            <button
              type="button"
              onClick={() => openSelectModal("in_progress")}
              className="px-3 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Select & Delete...
            </button>
            <span className="text-[11px] text-slate-500">Granular control</span>
          </div>
        </div>
      </div>

      {/* Advanced Snapshots & Raw Targets Accordion */}
      <div className="border border-[#242A38] rounded-2xl bg-[#181D27]/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center space-x-2">
            <Database size={14} className="text-slate-500" />
            <span>Database Snapshots & Directory Details</span>
          </div>
          {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-[#242A38] space-y-4 text-xs animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {status?.items.map((it) => (
                <div
                  key={it.key}
                  className="p-3 rounded-xl bg-[#131720] border border-[#242A38] flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white">{it.label}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{it.display_path}</div>
                  </div>
                  <span className="font-mono text-slate-300 text-xs px-2 py-0.5 rounded bg-[#181D27] border border-[#242A38]">
                    {it.size_human}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Select & Delete Modal Dialog */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#242A38] flex items-center justify-between bg-[#131720]">
              <div className="flex items-center space-x-2">
                <Trash2 size={16} className="text-red-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Manage & Delete:{" "}
                  {activeModal === "uploaded" && "Uploaded Files"}
                  {activeModal === "archived" && "Archived Projects"}
                  {activeModal === "pending" && "Pending Projects"}
                  {activeModal === "in_progress" && "In-Progress Projects"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1E2433] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Search & Selection Toolbar */}
            <div className="px-5 py-3 border-b border-[#242A38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#151922]">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter items..."
                  className="w-full bg-[#181D27] border border-[#2E3648] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllModal}
                  className="px-2.5 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#1E2433] border border-[#2E3648] text-slate-300 hover:text-white font-medium cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllModal}
                  className="px-2.5 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#1E2433] border border-[#2E3648] text-slate-300 hover:text-white font-medium cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Modal Body / Items List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-2 min-h-[250px]">
              {loadingModalItems ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <Loader2 size={20} className="animate-spin text-cyan-400" />
                  <span>Loading items...</span>
                </div>
              ) : filteredModalItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs italic">
                  No items found matching the filter.
                </div>
              ) : (
                filteredModalItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleModalItem(item.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "bg-red-950/20 border-red-500/40 text-white"
                          : "bg-[#131720] border-[#242A38] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="shrink-0 text-slate-400">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-red-400" />
                          ) : (
                            <Square size={16} className="text-slate-600" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-semibold truncate text-white">{item.title}</div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                            {item.subtitle && <span>{item.subtitle}</span>}
                            <span>•</span>
                            <span>{item.dateStr}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-2 pl-3">
                        {item.metaBadge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#181D27] border border-[#2E3648] text-slate-400">
                            {item.metaBadge}
                          </span>
                        )}
                        <span className="font-mono text-xs text-slate-300">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#242A38] bg-[#131720] flex items-center justify-between text-xs">
              <div className="text-slate-400">
                Selected: <span className="font-bold text-white">{selectedItemIds.size}</span> item{selectedItemIds.size === 1 ? "" : "s"}{" "}
                {selectedItemIds.size > 0 && (
                  <span className="text-cyan-400 font-mono">({formatBytes(selectedTotalBytes)})</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#1E2433] border border-[#2E3648] text-slate-300 hover:text-white font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedModal}
                  disabled={selectedItemIds.size === 0 || isDeletingSelected}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {isDeletingSelected ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  <span>Delete Selected ({selectedItemIds.size})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
