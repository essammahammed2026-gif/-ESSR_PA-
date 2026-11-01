"use client";

import React, { useState } from "react";
import {
  X,
  Sliders,
  Copy,
  Check,
  Calendar,
  Layers,
  Folder,
  Lock,
  Tag,
  AlertTriangle,
  FileText,
  HardDrive,
} from "lucide-react";
import type { SessionSummary, CustomTag } from "./types";
import { formatMmInUnit, formatBytes, LengthUnit } from "@/lib/units";
import { resolveTag, TagIconComponent, getStudioInfo, timeAgo, DEFAULT_TAGS } from "./tagUtils";

interface ProjectPropertiesModalProps {
  session: SessionSummary | null;
  unit: LengthUnit;
  isOpen: boolean;
  onClose: () => void;
  onRename: (sessionId: string, newTitle: string) => void;
  customTags?: CustomTag[];
}

export function ProjectPropertiesModal({
  session,
  unit,
  isOpen,
  onClose,
  onRename,
  customTags = DEFAULT_TAGS,
}: ProjectPropertiesModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedDir, setCopiedDir] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

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

  if (!isOpen || !session) return null;

  const rawTitle = session.original_filename || session.title;
  const currentTitle = rawTitle.replace(/^\d+_/, "");
  const studio = getStudioInfo(session.studio_type);
  const StudioIcon = studio.icon;
  const currentTag = resolveTag(session.tag || "in-progress", customTags);

  const handleCopyId = () => {
    navigator.clipboard.writeText(session.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyDir = () => {
    if (session.session_dir) {
      navigator.clipboard.writeText(session.session_dir);
      setCopiedDir(true);
      setTimeout(() => setCopiedDir(false), 2000);
    }
  };

  const handleStartEdit = () => {
    setTitleValue(currentTitle);
    setEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (titleValue.trim() && titleValue.trim() !== currentTitle) {
      onRename(session.id, titleValue.trim());
    }
    setEditingTitle(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#131720] border border-[#2E3648] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#242A38] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders size={18} className="text-cyan-400" />
            <h2 className="text-base font-bold text-white">Project Properties</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* File Name & Rename */}
          <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                <FileText size={13} className="text-cyan-400" />
                <span>Project Name / Original File</span>
              </span>
              {!editingTitle && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  Rename
                </button>
              )}
            </div>

            {editingTitle ? (
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="w-full bg-[#11141d] border border-cyan-400 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Check size={12} />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTitle(false)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="text-sm font-bold text-white truncate" title={currentTitle}>
                {currentTitle}
              </div>
            )}
          </div>

          {/* Session ID */}
          <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Session ID</span>
            <div className="flex items-center justify-between bg-[#11141d] px-3 py-1.5 rounded-lg border border-[#2E3648]">
              <span className="font-mono text-xs text-cyan-300 select-all truncate mr-2">
                {session.id}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white shrink-0 cursor-pointer"
                title="Copy Session ID"
              >
                {copiedId ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Lock Alert if Project is Locked */}
          {session.lock?.is_locked && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-500/20 rounded-lg">
                  <Lock size={15} className="text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Project Locked for Editing</div>
                  <div className="text-[11px] text-amber-300/90">
                    Locked by operator: <span className="font-semibold text-white">{session.lock.operator_name}</span>
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Active Lock
              </span>
            </div>
          )}

          {/* Specifications Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1">
              <span className="text-[11px] text-slate-400">Studio</span>
              <div className="flex items-center space-x-2 font-semibold text-white">
                <div className={`w-2 h-2 rounded-full ${studio.dotColor}`} />
                <StudioIcon size={14} className={studio.textColor} />
                <span>{studio.label}</span>
              </div>
            </div>

            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1">
              <span className="text-[11px] text-slate-400">Status & Tag</span>
              <div className="flex items-center space-x-2 font-semibold text-white">
                <span className="capitalize">{session.status}</span>
                <span className="text-slate-500">&bull;</span>
                <span
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-[#131720] border border-[#2E3648]"
                  style={{ color: currentTag.color }}
                >
                  <TagIconComponent iconName={currentTag.icon} size={13} />
                  <span>{currentTag.name}</span>
                </span>
              </div>
            </div>

            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1">
              <span className="text-[11px] text-slate-400">Total Pages</span>
              <div className="font-mono font-semibold text-white flex items-center space-x-1.5">
                <Layers size={13} className="text-cyan-400" />
                <span>{session.total_pages} {session.total_pages === 1 ? "page" : "pages"}</span>
              </div>
            </div>

            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1">
              <span className="text-[11px] text-slate-400">Trim Dimensions</span>
              <div className="font-mono font-semibold text-white">
                {formatMmInUnit(session.width_mm, unit)} &times; {formatMmInUnit(session.height_mm, unit)}
              </div>
            </div>

            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1 col-span-2">
              <span className="text-[11px] text-slate-400">Original File Size</span>
              <div className="font-mono font-semibold text-white flex items-center space-x-1.5">
                <HardDrive size={13} className="text-cyan-400" />
                <span>{formatBytes(session.file_size || session.file_size_bytes)}</span>
              </div>
            </div>
          </div>

          {/* Timestamp Details */}
          <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-400">
              <Calendar size={13} className="text-cyan-400" />
              <span className="font-semibold">Timeline & Audit</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Created:</span>
                <span className="font-mono text-slate-200">
                  {formatDate(session.created_at)}{" "}
                  <span className="text-slate-500 text-[10px]">({timeAgo(session.created_at)})</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Last Modified:</span>
                <span className="font-mono text-slate-200">
                  {formatDate(session.updated_at)}{" "}
                  <span className="text-cyan-400/90 text-[10px]">({timeAgo(session.updated_at)})</span>
                </span>
              </div>
            </div>
          </div>

          {/* Trash / Warning Details if any */}
          {session.status === "trash" && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-red-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <span className="font-bold">Item in Trash: </span>
                <span>
                  {session.trash_reason === "file_not_found"
                    ? "File not found on disk. The storage asset was missing or moved."
                    : "This project was moved to trash. You can restore it or permanently delete it."}
                </span>
              </div>
            </div>
          )}

          {/* Directory Location */}
          {session.session_dir && (
            <div className="bg-[#181D27] p-3 rounded-xl border border-[#242A38] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                  <Folder size={12} className="text-amber-400" />
                  <span>Session Directory</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyDir}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  {copiedDir ? "Copied" : "Copy Path"}
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-400 truncate bg-[#11141d] p-1.5 rounded select-all">
                {session.session_dir}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#242A38] bg-[#11141d] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
