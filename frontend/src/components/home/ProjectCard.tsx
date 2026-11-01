"use client";

import React, { useState } from "react";
import {
  BookOpen,
  LayoutGrid,
  Scissors,
  Book,
  MoreVertical,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  Lock,
  ArrowRight,
  MessageSquare,
  Square,
  CheckSquare,
  ChevronDown,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Check,
} from "lucide-react";
import type { SessionSummary, ProjectTag, CustomTag, TagDisplayMode } from "./types";
import { formatMmInUnit, formatBytes, LengthUnit } from "@/lib/units";
import {
  resolveTag,
  TagIconComponent,
  getStudioInfo,
  timeAgo,
  DEFAULT_TAGS,
} from "./tagUtils";

interface ProjectCardProps {
  session: SessionSummary;
  unit: LengthUnit;
  isSelected?: boolean;
  searchQuery?: string;
  customTags?: CustomTag[];
  tagDisplayMode?: TagDisplayMode;
  onToggleSelect?: (sessionId: string) => void;
  onResume: (session: SessionSummary) => void;
  onRename: (sessionId: string, newTitle: string) => void;
  onUpdateTag: (sessionId: string, newTag: ProjectTag) => void;
  onOpenNotes: (session: SessionSummary) => void;
  onOpenProperties?: (session: SessionSummary) => void;
  onToggleArchive: (sessionId: string, currentStatus: string) => void;
  onDelete: (sessionId: string, title: string) => void;
  onRestore?: (sessionId: string) => void;
  onDeletePermanent?: (sessionId: string, title: string) => void;
}

export function ProjectCard({
  session,
  unit,
  isSelected = false,
  searchQuery = "",
  customTags = DEFAULT_TAGS,
  tagDisplayMode = "both",
  onToggleSelect,
  onResume,
  onRename,
  onUpdateTag,
  onOpenNotes,
  onOpenProperties,
  onToggleArchive,
  onDelete,
  onRestore,
  onDeletePermanent,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const studio = getStudioInfo(session.studio_type);
  const StudioIcon = studio.icon;
  const currentTag = resolveTag(session.tag || "in-progress", customTags);
  const isArchived = session.status === "archived";
  const isTrash = session.status === "trash";
  const isFileNotFound = isTrash && session.trash_reason === "file_not_found";

  const rawName = session.original_filename || session.title;
  const displayName = rawName.replace(/^\d+_/, "");

  const handleStartRename = () => {
    setIsRenaming(true);
    setRenameValue(displayName);
    setMenuOpen(false);
  };

  const handleSaveRename = () => {
    if (renameValue.trim() && renameValue.trim() !== displayName) {
      onRename(session.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  // Check if search matches the note content
  const matchesNotes = Boolean(
    searchQuery.trim() &&
      session.notes &&
      session.notes.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      className={`group bg-[#181D27] hover:bg-[#1C2230] border rounded-xl p-3.5 transition-all flex flex-col justify-between shadow-md relative ${
        isSelected
          ? "border-cyan-500 bg-[#162234]"
          : isFileNotFound
          ? "border-red-500/40 bg-red-950/10"
          : isTrash
          ? "border-amber-500/40 opacity-80"
          : isArchived
          ? "border-[#242A38] opacity-75"
          : "border-[#242A38] hover:border-slate-600 hover:shadow-cyan-950/20"
      }`}
      title={`${displayName} • ${session.id}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-1.5 pb-1">
        {/* Left: Checkbox & Minimal Studio Icon (Tooltipped with name on hover) */}
        <div className="flex items-center space-x-2 min-w-0">
          {onToggleSelect && !isTrash && (
            <button
              type="button"
              onClick={() => onToggleSelect(session.id)}
              className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-cyan-400" />
              ) : (
                <Square size={16} className="text-slate-500 group-hover:text-slate-400" />
              )}
            </button>
          )}

          {/* Studio Icon Only: Tooltip on hover tells the studio name */}
          <div
            className="flex items-center justify-center p-1 rounded-md bg-[#131720] border border-[#2E3648] hover:border-slate-500 transition-colors cursor-help shrink-0"
            title={`Studio: ${studio.label}`}
          >
            <StudioIcon size={14} className={studio.textColor} />
          </div>

          {/* File Not Found or Trash Badges */}
          {isFileNotFound ? (
            <span
              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 shrink-0"
              title="Physical source file missing on disk"
            >
              <AlertTriangle size={11} className="text-red-400" />
              <span>File Not Found</span>
            </span>
          ) : isTrash ? (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              <Trash2 size={10} />
              <span>Trash</span>
            </span>
          ) : null}

          {session.lock?.is_locked && (
            <span
              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0"
              title={`Locked by ${session.lock.operator_name}`}
            >
              <Lock size={10} />
              <span>Locked</span>
            </span>
          )}

          {isArchived && !isTrash && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded shrink-0">
              Archived
            </span>
          )}
        </div>

        {/* Right: Sleek Status Selector & Action Controls */}
        <div className="flex items-center space-x-0.5 shrink-0">
          {/* Status Tag Selector (Respects tagDisplayMode: both / icon / name) */}
          {!isTrash && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                title={`Status: ${currentTag.name} (Click to change)`}
              >
                {tagDisplayMode !== "name" && (
                  <TagIconComponent
                    iconName={currentTag.icon}
                    size={14}
                    style={{ color: currentTag.color }}
                  />
                )}
                {tagDisplayMode !== "icon" && (
                  <span style={{ color: currentTag.color }}>{currentTag.name}</span>
                )}
                <ChevronDown size={11} className="text-slate-500" />
              </button>

              {tagDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setTagDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-6 z-50 w-36 bg-[#131720] border border-[#2E3648] rounded-xl shadow-xl py-1 text-xs backdrop-blur-md">
                    {customTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTagDropdownOpen(false);
                          onUpdateTag(session.id, t.id);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 font-medium text-[11px] cursor-pointer flex items-center space-x-2"
                        style={{ color: t.color }}
                      >
                        <TagIconComponent iconName={t.icon} size={13} />
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes Button */}
          <button
            type="button"
            onClick={() => onOpenNotes(session)}
            className={`p-1 rounded transition-colors cursor-pointer relative ${
              session.notes
                ? "text-cyan-400 hover:bg-slate-800/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            }`}
            title={session.notes ? "View project notes" : "Add project notes"}
          >
            <MessageSquare size={14} />
            {session.notes && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
          </button>

          {/* Action Menu (Includes "Properties") */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="More actions"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-6 z-50 w-40 bg-[#131720] border border-[#2E3648] rounded-xl shadow-xl py-1 text-xs">
                  {/* Properties Option */}
                  {onOpenProperties && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenProperties(session);
                      }}
                      className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer font-medium"
                    >
                      <Sliders size={12} className="text-cyan-400" />
                      <span>Properties</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleStartRename}
                    className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Edit2 size={12} className="text-slate-400" />
                    <span>Rename</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenNotes(session);
                    }}
                    className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <MessageSquare size={12} />
                    <span>Edit Notes</span>
                  </button>

                  {!isTrash && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleArchive(session.id, session.status);
                      }}
                      className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer"
                    >
                      {isArchived ? (
                        <>
                          <ArchiveRestore size={12} />
                          <span>Unarchive</span>
                        </>
                      ) : (
                        <>
                          <Archive size={12} />
                          <span>Archive</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="border-t border-[#242A38] my-1" />

                  {isTrash ? (
                    <>
                      {onRestore && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onRestore(session.id);
                          }}
                          className="w-full text-left px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/10 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>Restore</span>
                        </button>
                      )}
                      {onDeletePermanent && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onDeletePermanent(session.id, displayName);
                          }}
                          className="w-full text-left px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center space-x-1.5 cursor-pointer font-semibold"
                        >
                          <Trash2 size={12} />
                          <span>Delete Forever</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(session.id, displayName);
                      }}
                      className="w-full text-left px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Move to Trash</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle Card Content: Original File Name / Inline Rename */}
      <div className="my-2 min-w-0">
        {isRenaming ? (
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              autoFocus
              className="w-full bg-[#131720] border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveRename}
              className="p-1 text-cyan-400 hover:text-white cursor-pointer shrink-0"
              title="Save name"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <h3
            onClick={() => onOpenProperties?.(session)}
            className="text-sm font-semibold text-slate-100 hover:text-cyan-400 truncate cursor-pointer transition-colors"
            title={`Click to view properties: ${displayName}`}
          >
            {displayName}
          </h3>
        )}

        {/* Note search match indicator if present */}
        {matchesNotes && (
          <div className="mt-1">
            <span className="text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/25 inline-block truncate">
              Notes match: &quot;{searchQuery}&quot;
            </span>
          </div>
        )}
      </div>

      {/* Bottom CTA Row */}
      <div className="pt-2 border-t border-[#222838] flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono truncate">
          <span>{timeAgo(session.updated_at)}</span>
          {(session.file_size || session.file_size_bytes) ? (
            <>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400 font-medium">
                {formatBytes(session.file_size || session.file_size_bytes)}
              </span>
            </>
          ) : null}
        </div>

        {isTrash ? (
          <div className="flex items-center space-x-1.5">
            {onRestore && (
              <button
                type="button"
                onClick={() => onRestore(session.id)}
                className="flex items-center space-x-1 py-1 px-2.5 rounded-lg text-xs font-semibold bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                title="Restore project from trash"
              >
                <RotateCcw size={11} />
                <span>Restore</span>
              </button>
            )}
            {onDeletePermanent && (
              <button
                type="button"
                onClick={() => onDeletePermanent(session.id, displayName)}
                className="py-1 px-2 rounded-lg text-xs font-semibold bg-red-600/15 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all cursor-pointer"
                title="Delete permanently"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onResume(session)}
            className="flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-cyan-600/20 text-slate-200 hover:text-cyan-300 border border-slate-700/60 hover:border-cyan-500/40 transition-all cursor-pointer group/btn"
          >
            <span>Resume</span>
            <ArrowRight size={13} className="text-cyan-400 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
