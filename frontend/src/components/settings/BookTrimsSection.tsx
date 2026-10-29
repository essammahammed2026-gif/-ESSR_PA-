"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, BookOpen } from "lucide-react";
import type { BookTrim } from "./types";

interface BookTrimsSectionProps {
  trims?: BookTrim[];
  onTrimsChange: (trims: BookTrim[]) => void;
}

export default function BookTrimsSection({ trims = [], onTrimsChange }: BookTrimsSectionProps) {
  const [newTrimName, setNewTrimName] = useState("");
  const [newTrimW, setNewTrimW] = useState(152.4);
  const [newTrimH, setNewTrimH] = useState(228.6);

  const [editingTrimIdx, setEditingTrimIdx] = useState<number | null>(null);
  const [editTrimName, setEditTrimName] = useState("");
  const [editTrimW, setEditTrimW] = useState(152.4);
  const [editTrimH, setEditTrimH] = useState(228.6);

  const handleAddTrim = () => {
    if (!newTrimName.trim() || newTrimW <= 0 || newTrimH <= 0) return;
    const updated = [
      ...trims.filter((t) => t.name.toLowerCase() !== newTrimName.trim().toLowerCase()),
      { name: newTrimName.trim(), width: Number(newTrimW), height: Number(newTrimH), unit: "mm" },
    ];
    onTrimsChange(updated);
    setNewTrimName("");
  };

  const handleDeleteTrim = (name: string) => {
    onTrimsChange(trims.filter((t) => t.name !== name));
  };

  const startEditTrim = (idx: number, trim: BookTrim) => {
    setEditingTrimIdx(idx);
    setEditTrimName(trim.name);
    setEditTrimW(trim.width);
    setEditTrimH(trim.height);
  };

  const handleSaveEditTrim = () => {
    if (editingTrimIdx === null) return;
    if (!editTrimName.trim() || editTrimW <= 0 || editTrimH <= 0) return;
    const updated = [...trims];
    updated[editingTrimIdx] = {
      name: editTrimName.trim(),
      width: Number(editTrimW),
      height: Number(editTrimH),
      unit: "mm",
    };
    onTrimsChange(updated);
    setEditingTrimIdx(null);
  };

  const handleCancelEditTrim = () => {
    setEditingTrimIdx(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen size={16} className="text-amber-500" />
            <h2 className="text-base font-bold">Standard Book Trim Sizes</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Presets available in Book Studio Crop module for standard book trim aspect ratios.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-xs text-gray-500 uppercase">
              <th className="py-2.5 px-3">Trim Name</th>
              <th className="py-2.5 px-3">Width (mm)</th>
              <th className="py-2.5 px-3">Height (mm)</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {trims.map((t, idx) =>
              editingTrimIdx === idx ? (
                <tr key={idx} className="bg-amber-50/70 dark:bg-amber-950/30 border-l-2 border-amber-500">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={editTrimName}
                      onChange={(e) => setEditTrimName(e.target.value)}
                      className="w-full text-xs font-semibold border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step={0.1}
                        value={editTrimW}
                        onChange={(e) => setEditTrimW(parseFloat(e.target.value) || 0)}
                        className="w-20 text-xs border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                      />
                      <span className="text-xs text-gray-500">mm</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step={0.1}
                        value={editTrimH}
                        onChange={(e) => setEditTrimH(parseFloat(e.target.value) || 0)}
                        className="w-20 text-xs border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                      />
                      <span className="text-xs text-gray-500">mm</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right space-x-2">
                    <button
                      onClick={handleSaveEditTrim}
                      className="text-emerald-600 hover:text-emerald-700 p-1 cursor-pointer"
                      title="Save"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={handleCancelEditTrim}
                      className="text-gray-400 hover:text-gray-500 p-1 cursor-pointer"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="py-2.5 px-3 font-semibold text-xs">{t.name}</td>
                  <td className="py-2.5 px-3 text-xs font-mono">{t.width} mm</td>
                  <td className="py-2.5 px-3 text-xs font-mono">{t.height} mm</td>
                  <td className="py-2.5 px-3 text-right space-x-1">
                    <button
                      onClick={() => startEditTrim(idx, t)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded cursor-pointer"
                      title="Edit trim size"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTrim(t.name)}
                      className="text-gray-400 hover:text-red-500 p-1 rounded cursor-pointer"
                      title="Delete trim size"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            )}
            {trims.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-gray-500 italic">
                  No custom book trim sizes registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Trim Row Form */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="e.g. US Trade (6x9)"
          value={newTrimName}
          onChange={(e) => setNewTrimName(e.target.value)}
          className="text-xs border p-2 rounded-lg flex-1 min-w-[140px] dark:bg-gray-900 dark:border-gray-700"
        />
        <div className="flex items-center space-x-1">
          <input
            type="number"
            step={0.1}
            placeholder="W"
            value={newTrimW || ""}
            onChange={(e) => setNewTrimW(parseFloat(e.target.value) || 0)}
            className="w-20 text-xs border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
          <span className="text-xs text-gray-500">×</span>
          <input
            type="number"
            step={0.1}
            placeholder="H"
            value={newTrimH || ""}
            onChange={(e) => setNewTrimH(parseFloat(e.target.value) || 0)}
            className="w-20 text-xs border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
          <span className="text-xs text-gray-500">mm</span>
        </div>
        <button
          onClick={handleAddTrim}
          disabled={!newTrimName.trim() || newTrimW <= 0 || newTrimH <= 0}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: "var(--app-accent, #f59e0b)" }}
        >
          <Plus size={14} />
          <span>Add Book Trim</span>
        </button>
      </div>
    </div>
  );
}

