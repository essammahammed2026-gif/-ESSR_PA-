"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  FolderOpen,
  ChevronDown,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { StorageStatus, StorageItem } from "./types";

export default function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cleaning, setCleaning] = useState<boolean>(false);
  const [inspectingKey, setInspectingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    fetchStatus();
  }, [fetchStatus]);

  const handleClean = async (target: string = "runtime") => {
    setCleaning(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings/clean-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Cleaned successfully! Freed ${data.freed_human}.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setErrorMsg("Failed to clean storage.");
      }
    } catch {
      setErrorMsg("Network error cleaning storage.");
    } finally {
      setCleaning(false);
    }
  };

  const handleInspect = async (key: string) => {
    setInspectingKey(key);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Opened in file explorer: ${data.path}`);
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setErrorMsg("Failed to open folder in file explorer.");
      }
    } catch {
      setErrorMsg("Error communicating with system file manager.");
    } finally {
      setInspectingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                Temporary Files & Disk Cleanup
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Purge processed uploads, cached page thumbnails, and build artifacts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchStatus();
            }}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 transition shrink-0 cursor-pointer"
            title="Refresh folder sizes"
          >
            <RefreshCw size={12} className={loading ? "animate-spin text-purple-500" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center space-x-2 text-xs">
            <CheckCircle2 size={15} className="shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl flex items-center space-x-2 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* Action Button & Metric Banner */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div>
              <span className="text-gray-400 dark:text-gray-500 block text-[10px] font-sans uppercase font-bold">Runtime Temp</span>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {status?.total_runtime_human ?? "..."}
              </span>
            </div>
            <div className="h-7 w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <span className="text-gray-400 dark:text-gray-500 block text-[10px] font-sans uppercase font-bold">Total Storage Used</span>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {status?.total_human ?? "..."}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleClean("runtime")}
              disabled={cleaning || loading}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
              title="Deletes temporary session PDFs, extracted spreads, and thumbnails"
            >
              {cleaning ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>Clean Temporary Files</span>
            </button>
          </div>
        </div>

        {/* Beneath Button: Expandable Dropdown / Accordion */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-700/50 transition cursor-pointer text-left"
          >
            <div className="flex items-center space-x-2">
              <div className={`transition-transform duration-150 text-gray-500 ${expanded ? "rotate-0" : "-rotate-90"}`}>
                <ChevronDown size={15} />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Inspect Folders & Storage Breakdown
              </span>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {status?.items.length ?? 0} Folders
              </span>
            </div>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
              {expanded ? "Hide Details" : "View & Inspect"}
            </span>
          </button>

          {/* Expanded Folder List */}
          {expanded && status && (
            <div className="mt-3 space-y-2.5">
              {status.items.map((item: StorageItem) => (
                <div
                  key={item.key}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {item.label}
                      </span>
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          item.category === "runtime"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {item.category === "runtime" ? "Runtime Temp" : "Build Cache"}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>

                    <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">
                      <span>📁 {item.display_path}</span>
                      <span>•</span>
                      <span>{item.count} items</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200 min-w-[60px] text-right">
                      {item.size_human}
                    </span>

                    {/* Button to inspect folder in system file explorer */}
                    <button
                      type="button"
                      onClick={() => handleInspect(item.key)}
                      disabled={inspectingKey === item.key}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium transition cursor-pointer"
                      title={`Open ${item.display_path} in system file manager`}
                    >
                      {inspectingKey === item.key ? (
                        <RefreshCw size={11} className="animate-spin text-purple-400" />
                      ) : (
                        <FolderOpen size={12} className="text-purple-500" />
                      )}
                      <span>Inspect</span>
                      <ExternalLink size={10} className="opacity-50" />
                    </button>

                    {/* Single folder cleanup button */}
                    <button
                      type="button"
                      onClick={() => handleClean(item.key)}
                      disabled={cleaning || item.size_bytes === 0}
                      className="p-1.5 rounded-lg border border-transparent hover:border-rose-300 dark:hover:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={`Clear ${item.label}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
