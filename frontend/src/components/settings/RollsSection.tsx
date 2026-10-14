"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { Roll } from "./types";

interface RollsSectionProps {
  rolls: Roll[];
  onRollsChange: (rolls: Roll[]) => void;
}

export default function RollsSection({ rolls, onRollsChange }: RollsSectionProps) {
  const [newRollName, setNewRollName] = useState("");
  const [newRollW, setNewRollW] = useState(600);

  const [editingRollIdx, setEditingRollIdx] = useState<number | null>(null);
  const [editRollName, setEditRollName] = useState("");
  const [editRollW, setEditRollW] = useState(600);

  const handleAddRoll = () => {
    if (!newRollName.trim() || newRollW <= 0) return;
    const updated = [
      ...rolls.filter((r) => r.name.toLowerCase() !== newRollName.trim().toLowerCase()),
      { name: newRollName.trim(), width: Number(newRollW), unit: "mm" },
    ];
    onRollsChange(updated);
    setNewRollName("");
  };

  const handleDeleteRoll = (name: string) => {
    onRollsChange(rolls.filter((r) => r.name !== name));
  };

  const startEditRoll = (idx: number, roll: Roll) => {
    setEditingRollIdx(idx);
    setEditRollName(roll.name);
    setEditRollW(roll.width);
  };

  const handleSaveEditRoll = () => {
    if (editingRollIdx === null) return;
    if (!editRollName.trim() || editRollW <= 0) return;
    const updated = [...rolls];
    updated[editingRollIdx] = {
      name: editRollName.trim(),
      width: Number(editRollW),
      unit: "mm",
    };
    onRollsChange(updated);
    setEditingRollIdx(null);
  };

  const handleCancelEditRoll = () => {
    setEditingRollIdx(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold">Standard Roll Media Widths</h2>
          <p className="text-xs text-gray-500">Wide-format plotter & continuous roll imposing widths.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-xs text-gray-500 uppercase">
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Roll Width (mm)</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {rolls.map((r, idx) => (
              editingRollIdx === idx ? (
                <tr key={idx} className="bg-purple-50/70 dark:bg-purple-950/30 border-l-2 border-purple-500">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={editRollName}
                      onChange={(e) => setEditRollName(e.target.value)}
                      className="w-full text-xs font-semibold border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={editRollW}
                        onChange={(e) => setEditRollW(parseFloat(e.target.value) || 0)}
                        className="w-24 text-xs border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                      />
                      <span className="text-xs text-gray-500">mm</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={handleSaveEditRoll}
                        className="text-emerald-500 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Save changes"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEditRoll}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-750">
                  <td className="py-2.5 px-3 font-semibold">{r.name}</td>
                  <td className="py-2.5 px-3">{r.width} mm</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => startEditRoll(idx, r)}
                        className="text-purple-500 hover:text-purple-700 p-1 rounded-md hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Edit roll"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteRoll(r.name)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Delete roll"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new roll inline */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Roll Preset Name</label>
          <input
            type="text"
            placeholder="e.g. 137cm Vinyl Roll"
            value={newRollName}
            onChange={(e) => setNewRollName(e.target.value)}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Width (mm)</label>
          <input
            type="number"
            value={newRollW}
            onChange={(e) => setNewRollW(parseFloat(e.target.value) || 0)}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <button
          onClick={handleAddRoll}
          className="flex items-center justify-center space-x-1 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} />
          <span>Add Roll</span>
        </button>
      </div>
    </div>
  );
}
