"use client";

import React, { useState } from "react";
import {
  LucideIcon,
  Clock,
  PlayCircle,
  Archive,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import type { SessionSummary, ProjectTag, CustomTag, TagDisplayMode } from "./types";
import { ProjectCard } from "./ProjectCard";
import { LengthUnit } from "@/lib/units";
import { DEFAULT_TAGS } from "./tagUtils";

interface ProjectKanbanBoardProps {
  sessions: SessionSummary[];
  selectedSessionIds: string[];
  unit: LengthUnit;
  searchQuery: string;
  customTags?: CustomTag[];
  tagDisplayMode?: TagDisplayMode;
  onToggleSelect: (sessionId: string) => void;
  onResumeSession: (session: SessionSummary) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onUpdateTag: (sessionId: string, newTag: ProjectTag) => void;
  onToggleArchiveSession: (sessionId: string, currentStatus: string) => void;
  onDeleteSession: (sessionId: string, title: string) => void;
  onOpenNotes: (session: SessionSummary) => void;
  onOpenProperties?: (session: SessionSummary) => void;
  onRestoreSession?: (sessionId: string) => void;
  onDeletePermanent?: (sessionId: string, title: string) => void;
}

interface ColumnDef {
  id: "pending" | "in-progress" | "archived";
  title: string;
  icon: LucideIcon;
  accentColor: string;
  borderColor: string;
  bgHeader: string;
}

const KANBAN_COLUMNS: ColumnDef[] = [
  {
    id: "pending",
    title: "Pending Intake",
    icon: Clock,
    accentColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgHeader: "bg-amber-500/10",
  },
  {
    id: "in-progress",
    title: "In-Progress",
    icon: PlayCircle,
    accentColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    bgHeader: "bg-cyan-500/10",
  },
  {
    id: "archived",
    title: "Archived",
    icon: Archive,
    accentColor: "text-slate-400",
    borderColor: "border-slate-600/30",
    bgHeader: "bg-slate-800/40",
  },
];

export function ProjectKanbanBoard({
  sessions,
  selectedSessionIds,
  unit,
  searchQuery,
  customTags = DEFAULT_TAGS,
  tagDisplayMode = "both",
  onToggleSelect,
  onResumeSession,
  onRenameSession,
  onUpdateTag,
  onToggleArchiveSession,
  onDeleteSession,
  onOpenNotes,
  onOpenProperties,
  onRestoreSession,
  onDeletePermanent,
}: ProjectKanbanBoardProps) {
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Lazy loading per column to prevent UI freezing with large libraries
  const PAGE_CHUNK = 12;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({
    pending: PAGE_CHUNK,
    "in-progress": PAGE_CHUNK,
    archived: PAGE_CHUNK,
  });

  const handleLoadMore = (colId: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [colId]: (prev[colId] || PAGE_CHUNK) + PAGE_CHUNK,
    }));
  };

  // Sort sessions into the 3 columns, excluding trash
  const getSessionsForColumn = (colId: string) => {
    return sessions.filter((s) => {
      if (s.status === "trash") return false;
      if (colId === "archived") {
        return s.status === "archived" || s.tag === "done";
      }
      if (colId === "pending") {
        return s.status !== "archived" && s.tag === "pending";
      }
      if (colId === "in-progress") {
        return s.status !== "archived" && s.tag !== "done" && s.tag !== "pending";
      }
      return false;
    });
  };

  const handleDropOnColumn = (targetColId: string) => {
    if (!draggedSessionId) return;
    const session = sessions.find((s) => s.id === draggedSessionId);
    if (!session) return;

    if (targetColId === "archived") {
      onUpdateTag(session.id, "done");
      if (session.status !== "archived") {
        onToggleArchiveSession(session.id, "active");
      }
    } else if (targetColId === "pending") {
      if (session.status === "archived") {
        onToggleArchiveSession(session.id, "archived");
      }
      onUpdateTag(session.id, "pending");
    } else if (targetColId === "in-progress") {
      if (session.status === "archived") {
        onToggleArchiveSession(session.id, "archived");
      }
      onUpdateTag(session.id, "in-progress");
    }

    setDraggedSessionId(null);
    setDragOverColId(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start animate-in fade-in duration-200">
      {KANBAN_COLUMNS.map((col) => {
        const colSessions = getSessionsForColumn(col.id);
        const visibleLimit = visibleCounts[col.id] || PAGE_CHUNK;
        const renderedSessions = colSessions.slice(0, visibleLimit);
        const remainingCount = Math.max(0, colSessions.length - visibleLimit);
        const ColIcon = col.icon;
        const isColumnDragOver = dragOverColId === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverColId !== col.id) {
                setDragOverColId(col.id);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverColId(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnColumn(col.id);
            }}
            className={`border rounded-2xl flex flex-col max-h-[820px] overflow-hidden shadow-lg transition-all duration-150 ${
              isColumnDragOver
                ? "bg-[#162234] border-cyan-400 ring-2 ring-cyan-500/30"
                : "bg-[#131720]/80 border-[#242A38]"
            }`}
          >
            {/* Column Header */}
            <div
              className={`px-4 py-3 border-b border-[#242A38] flex items-center justify-between select-none ${col.bgHeader}`}
            >
              <div className="flex items-center space-x-2">
                <ColIcon size={15} className={col.accentColor} />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {col.title}
                </h3>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border bg-[#181D27] ${col.borderColor} ${col.accentColor}`}
              >
                {colSessions.length}
              </span>
            </div>

            {/* Column Body Cards / Drop Area with Infinite Scroll Lazy Loading */}
            <div
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 120 && colSessions.length > visibleLimit) {
                  handleLoadMore(col.id);
                }
              }}
              className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[320px] relative"
            >
              {/* Drag Over Hint Overlay */}
              {isColumnDragOver && (
                <div className="p-3 rounded-xl border-2 border-dashed border-cyan-400/80 bg-cyan-950/20 text-cyan-300 text-xs font-bold flex items-center justify-center space-x-1.5 animate-pulse mb-2">
                  <ArrowDown size={14} />
                  <span>Drop to move into {col.title}</span>
                </div>
              )}

              {colSessions.length > 0 ? (
                <>
                  {renderedSessions.map((session) => (
                    <div
                      key={session.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", session.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedSessionId(session.id);
                      }}
                      onDragEnd={() => {
                        setDraggedSessionId(null);
                        setDragOverColId(null);
                      }}
                      className={`relative group/kanban transition-all cursor-grab active:cursor-grabbing ${
                        draggedSessionId === session.id
                          ? "opacity-35 scale-[0.98] border-cyan-500/50"
                          : "opacity-100"
                      }`}
                    >
                      <ProjectCard
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
                        onOpenProperties={onOpenProperties}
                        onToggleArchive={onToggleArchiveSession}
                        onDelete={onDeleteSession}
                        onRestore={onRestoreSession}
                        onDeletePermanent={onDeletePermanent}
                      />
                    </div>
                  ))}

                  {/* Load More Button if remaining */}
                  {remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleLoadMore(col.id)}
                      className="w-full py-2 px-3 rounded-xl border border-[#242A38] bg-[#181D27] hover:bg-[#1E2433] text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <span>Load more (+{Math.min(PAGE_CHUNK, remainingCount)})</span>
                      <span className="text-[10px] text-slate-500 font-mono font-normal">({remainingCount} remaining)</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-44 text-center text-slate-600 border border-dashed border-[#242A38] rounded-xl p-4 select-none">
                  <ColIcon size={22} className="opacity-30 mb-2" />
                  <span className="text-xs font-medium">No projects in this stage</span>
                  <span className="text-[10px] text-slate-600 mt-1">
                    Drag cards here to update status
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
