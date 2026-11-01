"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  MessageSquare,
  Clock,
  Calendar,
} from "lucide-react";
import type { SessionSummary, SessionNote } from "./types";

interface ProjectNotesModalProps {
  isOpen: boolean;
  session: SessionSummary | null;
  onClose: () => void;
  onSaveNotes: (sessionId: string, notesJson: string) => Promise<void> | void;
}

function parseNotes(raw?: string): SessionNote[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return [
    {
      id: "legacy",
      text: raw.trim(),
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    },
  ];
}

function formatNoteTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProjectNotesModal({
  isOpen,
  session,
  onClose,
  onSaveNotes,
}: ProjectNotesModalProps) {
  const [notesList, setNotesList] = useState<SessionNote[]>([]);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setNotesList(parseNotes(session.notes));
      setNewText("");
      setEditingId(null);
    }
  }, [session]);

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

  if (!isOpen || !session) return null;

  const displayName = session.original_filename || session.title;

  const persistNotes = async (updatedList: SessionNote[]) => {
    setNotesList(updatedList);
    const serialized = JSON.stringify(updatedList);
    await onSaveNotes(session.id, serialized);
  };

  const handleCreateNote = async () => {
    if (!newText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = Date.now() / 1000;
      const newNote: SessionNote = {
        id: Math.random().toString(36).substring(2, 11),
        text: newText.trim(),
        created_at: now,
        updated_at: now,
      };
      const updated = [newNote, ...notesList];
      await persistNotes(updated);
      setNewText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (note: SessionNote) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editText.trim()) return;
    const now = Date.now() / 1000;
    const updated = notesList.map((n) =>
      n.id === noteId ? { ...n, text: editText.trim(), updated_at: now } : n
    );
    await persistNotes(updated);
    setEditingId(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notesList.filter((n) => n.id !== noteId);
    await persistNotes(updated);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#181D27] border border-[#2E3648] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242A38]">
          <div className="flex items-center space-x-2.5">
            <MessageSquare size={17} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white truncate max-w-sm">
                Notes & Timeline: {displayName}
              </h2>
              <span className="text-[10px] font-mono text-slate-500">ID: {session.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Create Note Box */}
          <div className="bg-[#131720] border border-[#2E3648] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Plus size={13} className="text-cyan-400" />
                <span>Add Note</span>
              </span>
              <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                <Clock size={10} />
                <span>Timestamp recorded automatically</span>
              </span>
            </div>

            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Type note or instruction (e.g. Spiral binding check, 3mm bleed verified, reprint page 4)..."
              rows={3}
              className="w-full bg-[#181D27] border border-[#2E3648] focus:border-cyan-400 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none transition-colors"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">
                Indexed for keyword search in the dashboard
              </span>
              <button
                type="button"
                onClick={handleCreateNote}
                disabled={isSubmitting || !newText.trim()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Plus size={13} />
                <span>Create Note</span>
              </button>
            </div>
          </div>

          {/* Previous Notes Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Calendar size={13} className="text-cyan-400" />
                <span>Note History ({notesList.length})</span>
              </span>
            </div>

            {notesList.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-[#131720]/40 rounded-xl border border-dashed border-[#242A38]">
                No notes recorded yet. Type a note above to record the first entry.
              </div>
            ) : (
              <div className="space-y-2.5">
                {notesList.map((note) => {
                  const isEditing = editingId === note.id;
                  return (
                    <div
                      key={note.id}
                      className="bg-[#131720] border border-[#2E3648] rounded-xl p-3 text-xs space-y-2"
                    >
                      {/* Note Header: Timestamp and Actions */}
                      <div className="flex items-center justify-between border-b border-[#242A38] pb-1.5">
                        <span className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                          <Clock size={11} className="text-slate-500" />
                          <span>{formatNoteTime(note.created_at)}</span>
                          {note.updated_at > note.created_at + 1 && (
                            <span className="text-[10px] text-slate-500 italic ml-1">
                              (edited)
                            </span>
                          )}
                        </span>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(note)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="Edit note"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 transition-colors"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Note Body */}
                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="w-full bg-[#181D27] border border-cyan-400 rounded-lg p-2 text-xs text-white focus:outline-none resize-none"
                            autoFocus
                          />
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(note.id)}
                              className="px-2.5 py-1 rounded text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 flex items-center space-x-1"
                            >
                              <Check size={12} />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
                          {note.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#242A38] bg-[#131720]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
