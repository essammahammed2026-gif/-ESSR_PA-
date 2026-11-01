"use client";

import React, { useState } from "react";
import { X, Clock, ShieldCheck, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface RetentionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRetentionDays: number;
  onSaved: (newDays: number) => void;
}

const RETENTION_OPTIONS = [
  { value: 0, label: "Keep Forever (Permanent)", description: "Never automatically delete exports. Retains all PDF & ZIP deliverables indefinitely." },
  { value: 30, label: "30 Days Retention", description: "Automatically prune export deliverables older than 1 month." },
  { value: 14, label: "14 Days Retention", description: "Automatically prune export deliverables older than 2 weeks." },
  { value: 7, label: "7 Days Retention", description: "Keep export deliverables for 1 week." },
  { value: 1, label: "24 Hours Retention", description: "Aggressive cleanup for high-volume kiosks & production pipelines." },
];

export function RetentionSettingsModal({
  isOpen,
  onClose,
  currentRetentionDays,
  onSaved,
}: RetentionSettingsModalProps) {
  const [selectedDays, setSelectedDays] = useState<number>(currentRetentionDays);
  const [isSaving, setIsSaving] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/settings/retention`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          export_retention_days: selectedDays,
          auto_clean_temp_hours: 24,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update retention policy");
      }

      onSaved(selectedDays);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePruneNow = async () => {
    setIsPruning(true);
    setPruneResult(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/settings/retention-prune`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention_days: selectedDays }),
      });

      if (res.ok) {
        const data = await res.json();
        setPruneResult(data.message || `Pruned ${data.pruned_files} deliverables.`);
      } else {
        throw new Error("Failed to execute retention prune");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPruning(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242A38]">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-amber-400" />
            <h2 className="text-sm md:text-base font-bold text-white">
              Export Deliverables Retention Policy
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Control how long compiled PDF and ZIP deliverables remain in disk storage (<code className="text-slate-300 font-mono">backend/data/storage/exports</code>) before being pruned.
          </p>

          {error && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {pruneResult && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{pruneResult}</span>
            </div>
          )}

          {/* Retention Options */}
          <div className="space-y-2">
            {RETENTION_OPTIONS.map((opt) => {
              const isSelected = selectedDays === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#162234] border-cyan-500/50 shadow-sm"
                      : "bg-[#131720] border-[#242A38] hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="retentionPolicy"
                    checked={isSelected}
                    onChange={() => setSelectedDays(opt.value)}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>{opt.label}</span>
                      {opt.value === 0 && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Manual Prune Button */}
          {selectedDays > 0 && (
            <div className="pt-2 border-t border-[#242A38] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Want to prune expired items now?</span>
              <button
                type="button"
                onClick={handlePruneNow}
                disabled={isPruning}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPruning ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                <span>Prune Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#242A38] bg-[#131720]/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
            style={{
              backgroundColor: "var(--app-accent, #06b6d4)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Saving Policy...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Save Retention Policy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
