"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  Palette,
  Eye,
  Sliders,
} from "lucide-react";
import type { CustomTag, TagDisplayMode } from "./types";
import {
  AVAILABLE_TAG_ICONS,
  AVAILABLE_TAG_COLORS,
  TagIconComponent,
} from "./tagUtils";

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: CustomTag[];
  displayMode: TagDisplayMode;
  onSaveTag: (tag: CustomTag) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onUpdateDisplayMode: (mode: TagDisplayMode) => Promise<void>;
}

export function TagManagerModal({
  isOpen,
  onClose,
  tags,
  displayMode,
  onSaveTag,
  onDeleteTag,
  onUpdateDisplayMode,
}: TagManagerModalProps) {
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#06b6d4");
  const [icon, setIcon] = useState("Tag");
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingTagId(null);
    setName("");
    setColor("#06b6d4");
    setIcon("Tag");
    setIsCreating(true);
  };

  const startEdit = (tag: CustomTag) => {
    setIsCreating(false);
    setEditingTagId(tag.id);
    setName(tag.name);
    setColor(tag.color);
    setIcon(tag.icon);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingTagId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const tagId = editingTagId || name.toLowerCase().trim().replace(/[^a-z0-9]/g, "-");
      await onSaveTag({
        id: tagId,
        name: name.trim(),
        color,
        icon,
      });
      cancelForm();
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#131720] border border-[#2E3648] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#242A38] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders size={18} className="text-cyan-400" />
            <h2 className="text-base font-bold text-white">Tag Customization & Display</h2>
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
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Display Mode Preference */}
          <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-2.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Eye size={14} className="text-cyan-400" />
              <span>Card Tag Display Mode</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Configure how status tags appear on project cards and boards:
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(
                [
                  { id: "both", label: "Both (Icon + Name)" },
                  { id: "icon", label: "Icon Only" },
                  { id: "name", label: "Name Only" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdateDisplayMode(mode.id)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                    displayMode === mode.id
                      ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm"
                      : "bg-[#11141d] border-[#2E3648] text-slate-400 hover:text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form: Create or Edit Tag */}
          {(isCreating || editingTagId) && (
            <div className="bg-[#181D27] p-4 rounded-xl border border-cyan-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Tag size={13} className="text-cyan-400" />
                  <span>{isCreating ? "Create New Tag" : "Edit Tag"}</span>
                </span>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              {/* Tag Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Urgent, Needs Review"
                  className="w-full bg-[#11141d] border border-[#2E3648] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              {/* Color Palette */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center space-x-1">
                  <Palette size={11} />
                  <span>Tag Color</span>
                </label>
                <div className="flex items-center space-x-2">
                  {AVAILABLE_TAG_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c.hex ? "scale-110 border-white" : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Choose Icon
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.keys(AVAILABLE_TAG_ICONS).map((iconKey) => {
                    const isSelected = icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setIcon(iconKey)}
                        className={`p-2 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                            : "bg-[#11141d] border-[#2E3648] text-slate-400 hover:text-white"
                        }`}
                        title={iconKey}
                      >
                        <TagIconComponent iconName={iconKey} size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="pt-1 flex items-center justify-between border-t border-[#242A38]">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400">Preview:</span>
                  <span
                    className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border"
                    style={{
                      borderColor: `${color}40`,
                      backgroundColor: `${color}15`,
                      color: color,
                    }}
                  >
                    <TagIconComponent iconName={icon} size={14} />
                    <span>{name || "Preview"}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} />
                  <span>{isCreating ? "Create Tag" : "Save Changes"}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Existing Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Existing Tags</span>
              {!isCreating && !editingTagId && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add New Tag</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#181D27] border border-[#242A38] hover:border-slate-700"
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border"
                      style={{
                        borderColor: `${t.color}40`,
                        backgroundColor: `${t.color}15`,
                        color: t.color,
                      }}
                    >
                      <TagIconComponent iconName={t.icon} size={14} />
                      <span>{t.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">id: {t.id}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Edit tag"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTag(t.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete tag"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#242A38] bg-[#11141d] flex justify-end">
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
