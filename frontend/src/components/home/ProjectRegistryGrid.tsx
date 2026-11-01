"use client";

import React, { useState } from "react";
import {
  Layers,
  Search,
  BookOpen,
  LayoutGrid,
  Scissors,
  Archive,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Kanban,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Tag,
  Sliders,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  SessionSummary,
  ProjectTag,
  DateFilterPreset,
  CustomTag,
  TagDisplayMode,
} from "./types";
import { ProjectCard } from "./ProjectCard";
import { ProjectKanbanBoard } from "./ProjectKanbanBoard";
import { TagManagerModal } from "./TagManagerModal";
import { ProjectPropertiesModal } from "./ProjectPropertiesModal";
import { LengthUnit } from "@/lib/units";
import { DEFAULT_TAGS } from "./tagUtils";

interface ProjectRegistryGridProps {
  sessions: SessionSummary[];
  isLoading: boolean;
  unit: LengthUnit;
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  studioFilter: string;
  onStudioFilterChange: (studio: string) => void;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
  customTags?: CustomTag[];
  tagDisplayMode?: TagDisplayMode;
  onSaveCustomTag?: (tag: CustomTag) => Promise<void>;
  onDeleteCustomTag?: (tagId: string) => Promise<void>;
  onUpdateTagDisplayMode?: (mode: TagDisplayMode) => Promise<void>;
  datePreset: DateFilterPreset;
  onDatePresetChange: (preset: DateFilterPreset) => void;
  dateFrom: string;
  dateTo: string;
  onCustomDateChange: (from: string, to: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: "grid" | "kanban";
  onViewModeChange: (mode: "grid" | "kanban") => void;
  selectedSessionIds: string[];
  onToggleSelect: (sessionId: string) => void;
  onResumeSession: (session: SessionSummary) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onUpdateTag: (sessionId: string, newTag: ProjectTag) => void;
  onToggleArchiveSession: (sessionId: string, currentStatus: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreSession?: (sessionId: string) => void;
  onDeletePermanentSession?: (sessionId: string) => void;
  onEmptyTrash?: () => void;
  onOpenNotes: (session: SessionSummary) => void;
  onLaunchNewStudio: (studio: string) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export function ProjectRegistryGrid({
  sessions,
  isLoading,
  unit,
  page,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  studioFilter,
  onStudioFilterChange,
  tagFilter,
  onTagFilterChange,
  customTags = DEFAULT_TAGS,
  tagDisplayMode = "both",
  onSaveCustomTag,
  onDeleteCustomTag,
  onUpdateTagDisplayMode,
  datePreset,
  onDatePresetChange,
  dateFrom,
  dateTo,
  onCustomDateChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  selectedSessionIds,
  onToggleSelect,
  onResumeSession,
  onRenameSession,
  onUpdateTag,
  onToggleArchiveSession,
  onDeleteSession,
  onRestoreSession,
  onDeletePermanentSession,
  onEmptyTrash,
  onOpenNotes,
  onLaunchNewStudio,
}: ProjectRegistryGridProps) {
  // Modal states
  const [propertiesSession, setPropertiesSession] = useState<SessionSummary | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<{ id: string; title: string } | null>(null);
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false);

  const isTrashView = studioFilter === "trash";

  const confirmSoftDelete = () => {
    if (pendingDelete) {
      onDeleteSession(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  const confirmPermanentDelete = () => {
    if (pendingPermanentDelete) {
      onDeletePermanentSession?.(pendingPermanentDelete.id);
      setPendingPermanentDelete(null);
    }
  };

  const confirmEmptyTrash = () => {
    onEmptyTrash?.();
    setPendingEmptyTrash(false);
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-3.5">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 text-xs">
        {/* Left: Compact Studio Filter Tabs + Search in the Same Row */}
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          {/* Compact Studio Filter Tabs */}
          <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg p-0.5 text-[11px] gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onStudioFilterChange("all")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                studioFilter === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onStudioFilterChange("book_scan")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                studioFilter === "book_scan"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen size={11} />
              <span>Book</span>
            </button>
            <button
              type="button"
              onClick={() => onStudioFilterChange("imposing")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                studioFilter === "imposing"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={11} />
              <span>Imposing</span>
            </button>
            <button
              type="button"
              onClick={() => onStudioFilterChange("contour")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                studioFilter === "contour"
                  ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scissors size={11} />
              <span>Contour</span>
            </button>
            <button
              type="button"
              onClick={() => onStudioFilterChange("archived")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                studioFilter === "archived"
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Archive size={11} />
              <span>Archived</span>
            </button>
            <button
              type="button"
              onClick={() => onStudioFilterChange("trash")}
              className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                isTrashView
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "text-slate-500 hover:text-red-400"
              }`}
            >
              <Trash2 size={11} />
              <span>Trash</span>
            </button>
          </div>

          {/* Deep Search Bar - Shared in the Same Row */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-[#131720] border border-[#242A38] rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
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
        </div>

        {/* Right: Tag Filter, Date Preset, View Switcher & Actions */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap sm:flex-nowrap shrink-0">
          {/* Tag Filter & Manager Trigger */}
          <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1 text-xs">
            <Tag size={12} className="text-slate-400 mr-1.5 shrink-0" />
            <select
              value={tagFilter}
              onChange={(e) => onTagFilterChange(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-[#181D27] text-white">All Tags</option>
              {customTags.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#181D27] text-white">
                  {t.name}
                </option>
              ))}
            </select>
            {onSaveCustomTag && (
              <button
                type="button"
                onClick={() => setTagManagerOpen(true)}
                className="p-0.5 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors ml-0.5 cursor-pointer"
                title="Customize Tags & Display Preference"
              >
                <Sliders size={11} />
              </button>
            )}
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1 text-xs">
            <Calendar size={12} className="text-slate-400 mr-1.5 shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => onDatePresetChange(e.target.value as DateFilterPreset)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#181D27] text-white">All Time</option>
              <option value="today" className="bg-[#181D27] text-white">Today</option>
              <option value="week" className="bg-[#181D27] text-white">Past Week</option>
              <option value="month" className="bg-[#181D27] text-white">Past Month</option>
              <option value="custom" className="bg-[#181D27] text-white">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex items-center space-x-1.5 bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1 text-xs">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onCustomDateChange(e.target.value, dateTo)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none"
              />
              <span className="text-slate-500">&rarr;</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onCustomDateChange(dateFrom, e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none"
              />
            </div>
          )}

          {/* View Mode Toggle: Grid vs Kanban (Disabled in Trash View) */}
          {!isTrashView && (
            <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={`p-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                  viewMode === "grid"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Grid View"
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline text-[11px]">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("kanban")}
                className={`p-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
                  viewMode === "kanban"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Kanban Board View"
              >
                <Kanban size={13} />
                <span className="hidden sm:inline text-[11px]">Kanban</span>
              </button>
            </div>
          )}

          {/* Empty Trash Button (when viewing Trash) */}
          {isTrashView && sessions.length > 0 && onEmptyTrash && (
            <button
              type="button"
              onClick={() => setPendingEmptyTrash(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all cursor-pointer shadow-sm"
            >
              <Trash2 size={12} />
              <span>Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View Area: Grid vs Kanban */}
      {isLoading ? (
        <div className="p-14 text-center bg-[#131720]/40 border border-[#242A38] rounded-2xl flex flex-col items-center justify-center space-y-2">
          <RefreshCw size={22} className="animate-spin text-cyan-400" />
          <span className="text-xs text-slate-400">Loading project registry...</span>
        </div>
      ) : viewMode === "kanban" && !isTrashView ? (
        <ProjectKanbanBoard
          sessions={sessions}
          selectedSessionIds={selectedSessionIds}
          unit={unit}
          searchQuery={searchQuery}
          customTags={customTags}
          tagDisplayMode={tagDisplayMode}
          onToggleSelect={onToggleSelect}
          onResumeSession={onResumeSession}
          onRenameSession={onRenameSession}
          onUpdateTag={onUpdateTag}
          onToggleArchiveSession={onToggleArchiveSession}
          onDeleteSession={(id, title) => setPendingDelete({ id, title })}
          onOpenNotes={onOpenNotes}
          onOpenProperties={(s) => setPropertiesSession(s)}
          onRestoreSession={onRestoreSession}
          onDeletePermanent={(id, title) => setPendingPermanentDelete({ id, title })}
        />
      ) : sessions.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sessions.map((session) => (
              <ProjectCard
                key={session.id}
                session={session}
                unit={unit}
                isSelected={selectedSessionIds.includes(session.id)}
                searchQuery={searchQuery}
                customTags={customTags}
                tagDisplayMode={tagDisplayMode}
                onToggleSelect={onToggleSelect}
                onResume={onResumeSession}
                onRename={onRenameSession}
                onUpdateTag={onUpdateTag}
                onOpenNotes={onOpenNotes}
                onOpenProperties={(s) => setPropertiesSession(s)}
                onToggleArchive={onToggleArchiveSession}
                onDelete={(id, title) => setPendingDelete({ id, title })}
                onRestore={onRestoreSession}
                onDeletePermanent={(id, title) => setPendingPermanentDelete({ id, title })}
              />
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#242A38] text-xs text-slate-400">
            {/* Results Per Page */}
            <div className="flex items-center space-x-2">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size} className="bg-[#181D27] text-white">
                    {size} per page
                  </option>
                ))}
              </select>
              <span className="text-slate-500 font-mono">
                Showing {startRecord}&ndash;{endRecord} of {totalCount}
              </span>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded-lg bg-[#131720] border border-[#242A38] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="font-mono text-slate-300 px-2 font-medium">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded-lg bg-[#131720] border border-[#242A38] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-10 text-center bg-[#181D27]/40 border border-dashed border-[#242A38] rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            {isTrashView ? <Trash2 size={18} /> : <Layers size={18} />}
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-bold text-slate-200">
              {isTrashView ? "Trash is Empty" : "No Projects Found"}
            </h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
              {isTrashView
                ? "No deleted or missing files in trash."
                : searchQuery
                ? `No projects match "${searchQuery}". Clear your search query.`
                : studioFilter === "archived"
                ? "No archived projects."
                : "Drop artwork files into the intake zone above or launch a studio directly."}
            </p>
          </div>

          {!searchQuery && studioFilter !== "archived" && !isTrashView && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => onLaunchNewStudio("book-studio")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold transition-colors cursor-pointer"
              >
                <BookOpen size={13} />
                <span>New Book Project</span>
              </button>
              <button
                type="button"
                onClick={() => onLaunchNewStudio("imposing")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-semibold transition-colors cursor-pointer"
              >
                <LayoutGrid size={13} />
                <span>New Imposition Sheet</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Soft Delete (Move to Trash) Confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181D27] border border-[#2E3648] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2 bg-amber-500/15 rounded-xl border border-amber-500/30">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Move to Trash?</h4>
                <p className="text-xs text-slate-400">Item can be restored later.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Move <span className="font-semibold text-white">&quot;{pendingDelete.title}&quot;</span> to trash? You can view or restore it from the Trash tab.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSoftDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer shadow-lg"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {pendingPermanentDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181D27] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2 bg-red-500/15 rounded-xl border border-red-500/30">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Permanently?</h4>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Permanently delete <span className="font-semibold text-white">&quot;{pendingPermanentDelete.title}&quot;</span>? All stored files and database records will be permanently purged.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingPermanentDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer shadow-lg"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Dialog */}
      {pendingEmptyTrash && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181D27] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2 bg-red-500/15 rounded-xl border border-red-500/30">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Empty Entire Trash?</h4>
                <p className="text-xs text-slate-400">Permanent and irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete all items in trash and purge their storage assets from disk?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingEmptyTrash(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEmptyTrash}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer shadow-lg"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Customization Modal */}
      {onSaveCustomTag && onDeleteCustomTag && onUpdateTagDisplayMode && (
        <TagManagerModal
          isOpen={tagManagerOpen}
          onClose={() => setTagManagerOpen(false)}
          tags={customTags}
          displayMode={tagDisplayMode}
          onSaveTag={onSaveCustomTag}
          onDeleteTag={onDeleteCustomTag}
          onUpdateDisplayMode={onUpdateTagDisplayMode}
        />
      )}

      {/* Project Properties Modal */}
      <ProjectPropertiesModal
        session={propertiesSession}
        unit={unit}
        isOpen={Boolean(propertiesSession)}
        onClose={() => setPropertiesSession(null)}
        onRename={onRenameSession}
        customTags={customTags}
      />
    </div>
  );
}
