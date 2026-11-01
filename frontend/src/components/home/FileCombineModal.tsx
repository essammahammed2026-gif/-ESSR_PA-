"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowUpDown,
  Plus,
  Upload,
} from "lucide-react";
import type { UploadedAsset } from "./types";
import { apiFetch } from "@/lib/api";
import { formatMmInUnit, formatBytes, LengthUnit } from "@/lib/units";

interface FileCombineModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAssets: UploadedAsset[];
  allStagedAssets?: UploadedAsset[];
  unit: LengthUnit;
  onCombineSuccess: (combinedAsset: UploadedAsset) => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "tiff", "tif", "bmp"].includes(ext || "")) {
    return <ImageIcon size={15} className="shrink-0 text-amber-400" />;
  }
  return <FileText size={15} className="shrink-0 text-cyan-400" />;
}

export function FileCombineModal({
  isOpen,
  onClose,
  initialAssets,
  allStagedAssets = [],
  unit,
  onCombineSuccess,
}: FileCombineModalProps) {
  const [mode, setMode] = useState<"sequential" | "duplex">(
    initialAssets.length === 2 ? "duplex" : "sequential"
  );
  const [assets, setAssets] = useState<UploadedAsset[]>(initialAssets);
  const [reverseIndices, setReverseIndices] = useState<number[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isUploadingMore, setIsUploadingMore] = useState(false);

  // Duplex configuration
  const [oddsFileId, setOddsFileId] = useState<string>(initialAssets[0]?.file_id || "");
  const [evensFileId, setEvensFileId] = useState<string>(
    initialAssets[1]?.file_id || initialAssets[0]?.file_id || ""
  );
  const [oddsOrder, setOddsOrder] = useState<"forward" | "reverse">("forward");
  const [evensOrder, setEvensOrder] = useState<"reverse" | "forward">("reverse");
  const [startWith, setStartWith] = useState<"odds" | "evens">("odds");
  const [customTitle, setCustomTitle] = useState<string>("");

  const [isCombining, setIsCombining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Re-sync initial assets when modal opens
  useEffect(() => {
    if (isOpen) {
      setAssets(initialAssets);
      setReverseIndices([]);
      setError(null);
      if (initialAssets.length >= 2) {
        setOddsFileId(initialAssets[0].file_id);
        setEvensFileId(initialAssets[1].file_id);
      } else if (initialAssets.length === 1) {
        setOddsFileId(initialAssets[0].file_id);
        setEvensFileId(initialAssets[0].file_id);
      }
      const defaultName = initialAssets[0]?.filename
        ? `${initialAssets[0].filename.replace(/\.[^/.]+$/, "")}_combined.pdf`
        : "combined_document.pdf";
      setCustomTitle(defaultName);
    }
  }, [isOpen, initialAssets]);

  // Close on Escape key
  useEffect(() => {
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

  // Close add dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Staged assets available to be added
  const unselectedStagedAssets = allStagedAssets.filter(
    (sa) => !assets.some((a) => a.file_id === sa.file_id)
  );

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setAssets((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
    setReverseIndices((prev) =>
      prev.map((i) => {
        if (i === index) return index - 1;
        if (i === index - 1) return index;
        return i;
      })
    );
  };

  const handleMoveDown = (index: number) => {
    if (index === assets.length - 1) return;
    setAssets((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
    setReverseIndices((prev) =>
      prev.map((i) => {
        if (i === index) return index + 1;
        if (i === index + 1) return index;
        return i;
      })
    );
  };

  const handleRemoveAsset = (index: number) => {
    if (assets.length <= 1) {
      setError("At least one file is required in the combine list.");
      return;
    }
    setAssets((prev) => prev.filter((_, i) => i !== index));
    setReverseIndices((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  };

  const handleToggleReverse = (index: number) => {
    setReverseIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleAddStagedAsset = (stagedAsset: UploadedAsset) => {
    setAssets((prev) => [...prev, stagedAsset]);
    setShowAddMenu(false);
  };

  const handleUploadMoreFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploadingMore(true);
    setError(null);

    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));

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
        setAssets((prev) => [...prev, ...data.files]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsUploadingMore(false);
      setShowAddMenu(false);
    }
  };

  const handleExecuteCombine = async () => {
    setIsCombining(true);
    setError(null);

    try {
      if (mode === "sequential") {
        if (assets.length === 0) {
          throw new Error("No files selected to combine.");
        }

        const res = await apiFetch(`/api/intake/combine-sequential`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_ids: assets.map((a) => a.file_id),
            reverse_indices: reverseIndices,
            output_title: customTitle.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Sequential combination failed");
        }

        const data = await res.json();
        onCombineSuccess(data);
        onClose();
      } else {
        // Duplex mode
        if (!oddsFileId || !evensFileId) {
          throw new Error("Please select both Odds and Evens source files.");
        }

        const res = await apiFetch(`/api/intake/combine-duplex`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            odds_file_id: oddsFileId,
            evens_file_id: evensFileId,
            odds_order: oddsOrder,
            evens_order: evensOrder,
            start_with: startWith,
            output_title: customTitle.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Duplex scan interleaving failed");
        }

        const data = await res.json();
        onCombineSuccess(data);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCombining(false);
    }
  };

  const totalPagesSum = assets.reduce((acc, a) => acc + (a.page_count || 1), 0);
  const totalBytesSum = assets.reduce((acc, a) => acc + (a.file_size || 0), 0);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,image/*,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
        className="hidden"
        onChange={(e) => {
          void handleUploadMoreFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Compact Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#242A38] bg-[#141923]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Layers size={16} />
            </div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white">Combine Files</h2>
              <span className="text-xs font-mono text-slate-400">
                &bull; {assets.length} files &bull; {totalPagesSum} pgs &bull; {formatBytes(totalBytesSum)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body with Expansive View */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-400 hover:text-white cursor-pointer ml-2 text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Mode Selector & Add Files Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex bg-[#131720] p-0.5 rounded-lg border border-[#242A38] text-xs">
              <button
                type="button"
                onClick={() => setMode("sequential")}
                className={`py-1.5 px-3 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  mode === "sequential"
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers size={13} />
                <span>Sequential Merge</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("duplex")}
                className={`py-1.5 px-3 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  mode === "duplex"
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ArrowUpDown size={13} />
                <span>Duplex Interleave</span>
              </button>
            </div>

            {/* Add Files Dropdown / Upload Control */}
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setShowAddMenu((prev) => !prev)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Files</span>
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-8 z-50 w-64 bg-[#181D27] border border-[#2E3648] rounded-xl shadow-2xl p-2 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploadingMore}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors text-left cursor-pointer"
                  >
                    <Upload size={13} className="text-cyan-400 shrink-0" />
                    <span>Upload From Disk</span>
                  </button>

                  <div className="border-t border-[#242A38] my-1" />

                  <div className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 uppercase tracking-wider">
                    From Staging ({unselectedStagedAssets.length})
                  </div>

                  {unselectedStagedAssets.length === 0 ? (
                    <div className="px-2.5 py-2 text-slate-500 text-[11px] italic">
                      All staged files are in table
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {unselectedStagedAssets.map((sa) => (
                        <button
                          key={sa.file_id}
                          type="button"
                          onClick={() => handleAddStagedAsset(sa)}
                          className="w-full flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left cursor-pointer truncate"
                        >
                          {getFileIcon(sa.filename)}
                          <span className="truncate flex-1" title={sa.filename}>
                            {sa.filename}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {sa.page_count}p
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODE 1: Sequential Merge Table */}
          {mode === "sequential" && (
            <div className="border border-[#242A38] rounded-xl overflow-hidden bg-[#131720]">
              <div className="overflow-x-auto max-h-[420px] min-h-[220px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#242A38] bg-[#161B26] text-slate-400 text-[11px] font-semibold">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Document</th>
                      <th className="py-2.5 px-3 text-center w-20">Pages</th>
                      <th className="py-2.5 px-3 text-center w-32">Trim Size</th>
                      <th className="py-2.5 px-3 text-right w-24">Size</th>
                      <th className="py-2.5 px-2 text-center w-16" title="Reverse page sequence for this file">
                        Rev
                      </th>
                      <th className="py-2.5 px-3 text-right w-28">Order / Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242A38]/50">
                    {assets.map((asset, idx) => {
                      const isReversed = reverseIndices.includes(idx);
                      const widthStr = formatMmInUnit(asset.width_mm, unit);
                      const heightStr = formatMmInUnit(asset.height_mm, unit);

                      return (
                        <tr
                          key={`${asset.file_id}-${idx}`}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Sequence # */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300 border border-slate-700">
                              {idx + 1}
                            </span>
                          </td>

                          {/* File Name & Icon */}
                          <td className="py-2.5 px-3 min-w-[200px]">
                            <div className="flex items-center space-x-2.5">
                              {getFileIcon(asset.filename)}
                              <span
                                className="font-semibold text-slate-200 truncate max-w-sm"
                                title={asset.filename}
                              >
                                {asset.filename}
                              </span>
                            </div>
                          </td>

                          {/* Page count */}
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-300">
                            {asset.page_count}
                          </td>

                          {/* Trim size */}
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {widthStr} &times; {heightStr}
                          </td>

                          {/* File size */}
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400">
                            {formatBytes(asset.file_size)}
                          </td>

                          {/* Reverse toggle */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleReverse(idx)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                isReversed
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-[#181D27] text-slate-500 border-[#2E3648] hover:text-slate-300"
                              }`}
                              title={isReversed ? "Pages inverted (reverse order)" : "Forward order"}
                            >
                              {isReversed ? "REV" : "FWD"}
                            </button>
                          </td>

                          {/* Actions (Up, Down, Delete) */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveUp(idx)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move Up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === assets.length - 1}
                                onClick={() => handleMoveDown(idx)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move Down"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAsset(idx)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer ml-1"
                                title="Remove from list"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE 2: Duplex Scans Interleave */}
          {mode === "duplex" && (
            <div className="space-y-3.5 bg-[#131720] border border-[#242A38] rounded-xl p-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Odds Source (1, 3, 5...)
                  </label>
                  <select
                    value={oddsFileId}
                    onChange={(e) => setOddsFileId(e.target.value)}
                    className="w-full bg-[#181D27] border border-[#2E3648] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {assets.map((a) => (
                      <option key={a.file_id} value={a.file_id}>
                        {a.filename} ({a.page_count} pgs)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Evens Source (2, 4, 6...)
                  </label>
                  <select
                    value={evensFileId}
                    onChange={(e) => setEvensFileId(e.target.value)}
                    className="w-full bg-[#181D27] border border-[#2E3648] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {assets.map((a) => (
                      <option key={a.file_id} value={a.file_id}>
                        {a.filename} ({a.page_count} pgs)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#242A38]/60">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Odds Order</span>
                  <div className="flex bg-[#181D27] p-0.5 rounded-lg border border-[#2E3648]">
                    <button
                      type="button"
                      onClick={() => setOddsOrder("forward")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        oddsOrder === "forward" ? "bg-slate-700 text-white" : "text-slate-400"
                      }`}
                    >
                      Forward
                    </button>
                    <button
                      type="button"
                      onClick={() => setOddsOrder("reverse")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        oddsOrder === "reverse" ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30" : "text-slate-400"
                      }`}
                    >
                      Reverse
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Evens Order</span>
                  <div className="flex bg-[#181D27] p-0.5 rounded-lg border border-[#2E3648]">
                    <button
                      type="button"
                      onClick={() => setEvensOrder("reverse")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        evensOrder === "reverse" ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30" : "text-slate-400"
                      }`}
                    >
                      Reverse (ADF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvensOrder("forward")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        evensOrder === "forward" ? "bg-slate-700 text-white" : "text-slate-400"
                      }`}
                    >
                      Forward
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">First Page</span>
                  <div className="flex bg-[#181D27] p-0.5 rounded-lg border border-[#2E3648]">
                    <button
                      type="button"
                      onClick={() => setStartWith("odds")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        startWith === "odds" ? "bg-slate-700 text-white" : "text-slate-400"
                      }`}
                    >
                      Odds First
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartWith("evens")}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        startWith === "evens" ? "bg-slate-700 text-white" : "text-slate-400"
                      }`}
                    >
                      Evens First
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Output Document Name */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-slate-400 text-xs shrink-0 font-medium">Output Name:</span>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="combined_document.pdf"
              className="flex-1 bg-[#131720] border border-[#242A38] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[#242A38] bg-[#141923]">
          <button
            type="button"
            onClick={onClose}
            disabled={isCombining}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteCombine}
            disabled={isCombining || assets.length === 0}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--app-accent, #06b6d4)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
          >
            {isCombining ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Combining...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Combine &amp; Save to Staging</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
