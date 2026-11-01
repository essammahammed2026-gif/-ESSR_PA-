"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  CheckSquare,
  Square,
  BookOpen,
  LayoutGrid,
  Scissors,
  Book,
  SearchCheck,
  Trash2,
  Layers,
  Search,
  X,
  MoreVertical,
  Edit2,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Plus,
  Info,
  Copy,
  Calendar,
} from "lucide-react";
import type { UploadedAsset, DateFilterPreset } from "./types";
import { formatMmInUnit, formatBytes, LengthUnit } from "@/lib/units";

interface StagedAssetWorkbenchProps {
  assets: UploadedAsset[];
  selectedFileIds: string[];
  unit: LengthUnit;
  onToggleSelect: (fileId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemoveAsset: (fileId: string) => void;
  onDeleteSelected?: (fileIds: string[]) => void;
  onUploadFiles?: (files: FileList | File[]) => void;
  onClearAllAssets: () => void;
  onRenameAsset?: (fileId: string, newFilename: string) => void;
  onAnalyzeSelected: (assets: UploadedAsset[]) => void;
  onRouteSingleToStudio: (studio: string, asset: UploadedAsset) => void;
  onRequestCombine: (selectedAssets: UploadedAsset[]) => void;
  // Search, Filters & Pagination
  searchQuery: string;
  onSearchChange: (q: string) => void;
  fileTypeFilter: string;
  onFileTypeFilterChange: (type: string) => void;
  datePreset?: DateFilterPreset;
  onDatePresetChange?: (preset: DateFilterPreset) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

function getFileIcon(name: string, size = 14) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "tiff", "tif", "bmp"].includes(ext || "")) {
    return <ImageIcon size={size} className="shrink-0 text-amber-400" />;
  }
  return <FileText size={size} className="shrink-0 text-cyan-400" />;
}

export function StagedAssetWorkbench({
  assets,
  selectedFileIds,
  unit,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onRemoveAsset,
  onDeleteSelected,
  onUploadFiles,
  onClearAllAssets,
  onRenameAsset,
  onAnalyzeSelected,
  onRouteSingleToStudio,
  onRequestCombine,
  searchQuery,
  onSearchChange,
  fileTypeFilter,
  onFileTypeFilterChange,
  datePreset = "today",
  onDatePresetChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: StagedAssetWorkbenchProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [propertiesAsset, setPropertiesAsset] = useState<UploadedAsset | null>(null);
  const [showActionNotice, setShowActionNotice] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeMenuRef = useRef<HTMLDivElement>(null);
  const actionNoticeRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking anywhere outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (activeMenuRef.current && !activeMenuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
        setOpenSubmenuId(null);
      }
      if (actionNoticeRef.current && !actionNoticeRef.current.contains(e.target as Node)) {
        setShowActionNotice(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenuId(null);
        setOpenSubmenuId(null);
        setShowActionNotice(false);
        setPropertiesAsset(null);
        setRenamingAssetId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuId]);

  const selectedAssets = useMemo(
    () => assets.filter((a) => selectedFileIds.includes(a.file_id)),
    [assets, selectedFileIds]
  );

  const allSelected = assets.length > 0 && selectedAssets.length === assets.length;

  if (totalCount === 0 && !searchQuery.trim() && fileTypeFilter === "all") {
    return null;
  }

  const handleStartRename = (asset: UploadedAsset) => {
    setRenamingAssetId(asset.file_id);
    setRenameValue(asset.filename);
    setActiveMenuId(null);
    setOpenSubmenuId(null);
  };

  const handleSaveRename = (fileId: string) => {
    if (renameValue.trim() && onRenameAsset) {
      onRenameAsset(fileId, renameValue.trim());
    }
    setRenamingAssetId(null);
  };

  const handleDeleteSelectedClick = () => {
    if (selectedFileIds.length === 0) return;
    if (onDeleteSelected) {
      onDeleteSelected(selectedFileIds);
    } else {
      selectedFileIds.forEach((id) => onRemoveAsset(id));
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onUploadFiles) {
        onUploadFiles(e.dataTransfer.files);
      }
    }
  };

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#181D27] border rounded-xl p-3 space-y-3 shadow-lg animate-in fade-in duration-200 relative transition-colors ${
        isDraggingOver
          ? "border-cyan-400 bg-cyan-950/20 ring-2 ring-cyan-500/30"
          : "border-[#242A38]"
      }`}
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-[#131720]/85 backdrop-blur-xs rounded-xl flex items-center justify-center border-2 border-dashed border-cyan-400 pointer-events-none">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs sm:text-sm animate-pulse">
            <Plus size={18} />
            <span>Drop files here to upload directly into staging</span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,image/*,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            if (onUploadFiles) {
              onUploadFiles(e.target.files);
            }
            e.target.value = "";
          }
        }}
      />

      {/* Top Panel Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#242A38]">
        {/* Selection Controller */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare size={15} className="text-cyan-400" />
            ) : (
              <Square size={15} className="text-slate-500" />
            )}
            <span>
              {allSelected ? "Deselect All" : "Select All"} ({selectedAssets.length}/{totalCount})
            </span>
          </button>

          <span className="text-slate-600 font-mono text-xs">|</span>
          <span className="text-[11px] font-medium text-slate-400">
            Staging ({totalCount})
          </span>
        </div>

        {/* Panel Toolbar Actions: Add Files, Combine, Action, Delete */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {/* Add Files Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
            title="Upload artwork or scan files directly into staging area"
          >
            <Plus size={13} />
            <span>Add Files</span>
          </button>

          {/* Combine Button */}
          <button
            type="button"
            onClick={() => onRequestCombine(selectedAssets.length > 0 ? selectedAssets : assets)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--app-accent, #06b6d4)",
              color: "var(--app-accent-fg, #0f172a)",
            }}
            title="Open Table Combiner to merge selected files"
          >
            <Layers size={13} />
            <span>Combine {selectedAssets.length > 0 ? `(${selectedAssets.length})` : ""}</span>
          </button>

          {/* Action Button (Placeholder for Automated Operation Sequences) */}
          <div className="relative" ref={actionNoticeRef}>
            <button
              type="button"
              onClick={() => setShowActionNotice((prev) => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#2E3648] text-slate-200 hover:text-white font-semibold transition-colors cursor-pointer"
              title="Automated operation sequences placeholder"
            >
              <Sparkles size={12} className="text-amber-400" />
              <span>Action</span>
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Preset
              </span>
            </button>

            {/* Action Placeholder Popover */}
            {showActionNotice && (
              <div className="absolute right-0 top-9 z-50 w-72 bg-[#181D27] border border-[#2E3648] rounded-xl shadow-2xl p-3 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                  <Sparkles size={14} />
                  <span>Action Sequences (Coming Soon)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The <strong className="text-slate-200">Action</strong> button will be used to trigger pre-configured multi-step sequences of operations on selected files.
                </p>
                <div className="pt-1 border-t border-[#242A38] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowActionNotice(false)}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete Button (Deletes Selected Files) */}
          <button
            type="button"
            disabled={selectedAssets.length === 0}
            onClick={handleDeleteSelectedClick}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Delete selected files from staging area"
          >
            <Trash2 size={13} />
            <span>Delete {selectedAssets.length > 0 ? `(${selectedAssets.length})` : ""}</span>
          </button>
        </div>
      </div>

      {/* Search & File Type Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-[#131720] border border-[#242A38] rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Filter Pills */}
          {onDatePresetChange && (
            <div className="flex bg-[#131720] p-0.5 rounded-lg border border-[#242A38] text-[11px]">
              {(["today", "week", "month", "all"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onDatePresetChange(preset)}
                  className={`px-2 py-0.5 rounded font-semibold capitalize transition-all cursor-pointer ${
                    datePreset === preset
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {preset === "all" ? "All Time" : preset}
                </button>
              ))}
            </div>
          )}

          {/* File Type Filter Pills */}
          <div className="flex bg-[#131720] p-0.5 rounded-lg border border-[#242A38] text-[11px]">
            <button
              type="button"
              onClick={() => onFileTypeFilterChange("all")}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                fileTypeFilter === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onFileTypeFilterChange("pdf")}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                fileTypeFilter === "pdf"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => onFileTypeFilterChange("image")}
              className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                fileTypeFilter === "image"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Images
            </button>
          </div>
        </div>
      </div>

      {/* Reduced-Size Asset Cards Grid */}
      {assets.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-xs italic bg-[#131720]/40 rounded-xl border border-dashed border-[#242A38]">
          No staged files matching search and filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {assets.map((asset) => {
            const isSelected = selectedFileIds.includes(asset.file_id);
            const isMenuOpen = activeMenuId === asset.file_id;
            const isSubmenuOpen = openSubmenuId === asset.file_id;
            const isRenaming = renamingAssetId === asset.file_id;

            return (
              <div
                key={asset.file_id}
                onClick={() => onToggleSelect(asset.file_id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 group relative select-none ${
                  isSelected
                    ? "bg-[#162234] border-cyan-500/60 shadow-sm"
                    : "bg-[#131720] border-[#242A38] hover:border-slate-600 hover:bg-[#161B26]"
                }`}
              >
                {/* Card Top: Checkbox, Icon, Filename, 3-dots */}
                <div className="flex items-center justify-between space-x-1.5">
                  <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(asset.file_id);
                      }}
                      className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare size={14} className="text-cyan-400" />
                      ) : (
                        <Square size={14} className="text-slate-500" />
                      )}
                    </button>

                    <div className="shrink-0">{getFileIcon(asset.filename, 14)}</div>

                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div
                          className="flex items-center space-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(asset.file_id);
                              if (e.key === "Escape") setRenamingAssetId(null);
                            }}
                            autoFocus
                            className="w-full bg-[#181D27] border border-cyan-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(asset.file_id)}
                            className="p-0.5 text-cyan-400 hover:text-white cursor-pointer"
                          >
                            <Check size={11} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors"
                          title={asset.filename}
                        >
                          {asset.filename}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3-dots Context Menu Button */}
                  <div
                    className="relative shrink-0"
                    ref={isMenuOpen ? activeMenuRef : undefined}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : asset.file_id);
                        setOpenSubmenuId(null);
                      }}
                      className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-700/60 opacity-60 group-hover:opacity-100 transition-all cursor-pointer"
                      title="More options"
                    >
                      <MoreVertical size={13} />
                    </button>

                    {/* Context Dropdown Menu: Properties, Audit, Rename, Open with, Delete */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-5 z-50 w-40 bg-[#181D27] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 text-xs animate-in fade-in zoom-in-95 duration-100"
                      >
                        {/* Option 1: Properties */}
                        <button
                          type="button"
                          onMouseEnter={() => setOpenSubmenuId(null)}
                          onClick={() => {
                            setActiveMenuId(null);
                            setOpenSubmenuId(null);
                            setPropertiesAsset(asset);
                          }}
                          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors text-left cursor-pointer"
                        >
                          <Info size={13} className="text-cyan-400" />
                          <span>Properties</span>
                        </button>

                        {/* Option 2: Audit */}
                        <button
                          type="button"
                          onMouseEnter={() => setOpenSubmenuId(null)}
                          onClick={() => {
                            setActiveMenuId(null);
                            setOpenSubmenuId(null);
                            onAnalyzeSelected([asset]);
                          }}
                          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors text-left cursor-pointer"
                        >
                          <SearchCheck size={13} className="text-cyan-400" />
                          <span>Audit</span>
                        </button>

                        {/* Option 3: Rename */}
                        <button
                          type="button"
                          onMouseEnter={() => setOpenSubmenuId(null)}
                          onClick={() => handleStartRename(asset)}
                          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors text-left cursor-pointer"
                        >
                          <Edit2 size={13} className="text-slate-400" />
                          <span>Rename</span>
                        </button>

                        {/* Option 4: Open with (Submenu: Book, Imposition, Contour, Flipbook) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubmenuId(isSubmenuOpen ? null : asset.file_id)
                            }
                            onMouseEnter={() => setOpenSubmenuId(asset.file_id)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors text-left cursor-pointer"
                          >
                            <span className="flex items-center space-x-2">
                              <BookOpen size={13} className="text-amber-400" />
                              <span>Open with</span>
                            </span>
                            <ChevronLeft size={12} className="text-slate-400" />
                          </button>

                          {/* Submenu: Opens to the left to avoid off-screen clipping */}
                          {isSubmenuOpen && (
                            <div
                              onMouseLeave={() => setOpenSubmenuId(null)}
                              className="absolute right-full top-0 mr-1 z-50 w-36 bg-[#181D27] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 text-xs animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setOpenSubmenuId(null);
                                  onRouteSingleToStudio("book-studio", asset);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
                              >
                                <BookOpen size={12} className="text-amber-400" />
                                <span>Book</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setOpenSubmenuId(null);
                                  onRouteSingleToStudio("imposing", asset);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
                              >
                                <LayoutGrid size={12} className="text-cyan-400" />
                                <span>Imposition</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setOpenSubmenuId(null);
                                  onRouteSingleToStudio("contour", asset);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
                              >
                                <Scissors size={12} className="text-fuchsia-400" />
                                <span>Contour</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setOpenSubmenuId(null);
                                  onRouteSingleToStudio("flipbook", asset);
                                }}
                                className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer"
                              >
                                <Book size={12} className="text-emerald-400" />
                                <span>Flipbook</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-[#242A38] my-1" />

                        {/* Option 5: Delete */}
                        <button
                          type="button"
                          onMouseEnter={() => setOpenSubmenuId(null)}
                          onClick={() => {
                            setActiveMenuId(null);
                            setOpenSubmenuId(null);
                            onRemoveAsset(asset.file_id);
                          }}
                          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors text-left cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Specs: ONLY Number of Pages and File Size */}
                <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono pt-0.5 border-t border-[#242A38]/50">
                  <span className="text-slate-300 font-semibold">
                    {asset.page_count} {asset.page_count === 1 ? "page" : "pages"}
                  </span>
                  <span>&bull;</span>
                  <span>{formatBytes(asset.file_size)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-[#242A38] text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-slate-200">{startRecord}</span> to{" "}
            <span className="font-mono text-slate-200">{endRecord}</span> of{" "}
            <span className="font-mono text-slate-200">{totalCount}</span> staged files
          </div>

          <div className="flex items-center space-x-3">
            {/* Page size selector */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-[11px] text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-[#131720] border border-[#242A38] rounded-md px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-400"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>

            {/* Prev / Next controls */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1 rounded bg-[#131720] border border-[#2E3648] text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="px-1.5 text-xs font-mono text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="p-1 rounded bg-[#131720] border border-[#2E3648] text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Properties Modal */}
      {propertiesAsset && (
        <div
          onClick={() => setPropertiesAsset(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#242A38]">
              <div className="flex items-center space-x-2">
                <Info size={17} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Staged File Properties</h3>
              </div>
              <button
                type="button"
                onClick={() => setPropertiesAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">File Name</label>
                <div className="font-semibold text-slate-200 bg-[#131720] border border-[#242A38] rounded-lg p-2.5 break-all">
                  {propertiesAsset.filename}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#131720] border border-[#242A38] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">Total Pages</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {propertiesAsset.page_count}
                  </span>
                </div>

                <div className="bg-[#131720] border border-[#242A38] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">File Size</span>
                  <span className="text-sm font-mono font-bold text-white">
                    {formatBytes(propertiesAsset.file_size)}
                  </span>
                </div>

                <div className="bg-[#131720] border border-[#242A38] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">Trim Dimensions</span>
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    {formatMmInUnit(propertiesAsset.width_mm, unit)} &times;{" "}
                    {formatMmInUnit(propertiesAsset.height_mm, unit)}
                  </span>
                </div>

                <div className="bg-[#131720] border border-[#242A38] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">Uploaded</span>
                  <span className="text-xs font-mono text-slate-300">
                    {new Date(propertiesAsset.uploaded_at * 1000).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Storage Path on Disk</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPath(propertiesAsset.file_path)}
                    className="flex items-center space-x-1 text-cyan-400 hover:underline cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedPath ? "Copied" : "Copy Path"}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 bg-[#131720] border border-[#242A38] rounded-lg p-2 break-all select-all">
                  {propertiesAsset.file_path}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#242A38] flex justify-end">
              <button
                type="button"
                onClick={() => setPropertiesAsset(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
