"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { Sheet } from "./types";

interface SheetsSectionProps {
  sheets: Sheet[];
  onSheetsChange: (sheets: Sheet[]) => void;
}

export default function SheetsSection({ sheets, onSheetsChange }: SheetsSectionProps) {
  const [newSheetName, setNewSheetName] = useState("");
  const [newSheetW, setNewSheetW] = useState(320);
  const [newSheetH, setNewSheetH] = useState(450);

  const [editingSheetIdx, setEditingSheetIdx] = useState<number | null>(null);
  const [editSheetName, setEditSheetName] = useState("");
  const [editSheetW, setEditSheetW] = useState(320);
  const [editSheetH, setEditSheetH] = useState(450);

  const handleAddSheet = () => {
    if (!newSheetName.trim() || newSheetW <= 0 || newSheetH <= 0) return;
    const updated = [
      ...sheets.filter((s) => s.name.toLowerCase() !== newSheetName.trim().toLowerCase()),
      { name: newSheetName.trim(), width: Number(newSheetW), height: Number(newSheetH), unit: "mm" },
    ];
    onSheetsChange(updated);
    setNewSheetName("");
  };

  const handleDeleteSheet = (name: string) => {
    onSheetsChange(sheets.filter((s) => s.name !== name));
  };

  const startEditSheet = (idx: number, sheet: Sheet) => {
    setEditingSheetIdx(idx);
    setEditSheetName(sheet.name);
    setEditSheetW(sheet.width);
    setEditSheetH(sheet.height);
  };

  const handleSaveEditSheet = () => {
    if (editingSheetIdx === null) return;
    if (!editSheetName.trim() || editSheetW <= 0 || editSheetH <= 0) return;
    const updated = [...sheets];
    updated[editingSheetIdx] = {
      name: editSheetName.trim(),
      width: Number(editSheetW),
      height: Number(editSheetH),
      unit: "mm",
    };
    onSheetsChange(updated);
    setEditingSheetIdx(null);
  };

  const handleCancelEditSheet = () => {
    setEditingSheetIdx(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold">Standard Sheet Sizes</h2>
          <p className="text-xs text-gray-500">Available across Imposing and Prepress modules.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-xs text-gray-500 uppercase">
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Width (mm)</th>
              <th className="py-2.5 px-3">Height (mm)</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {sheets.map((s, idx) => (
              editingSheetIdx === idx ? (
                <tr key={idx} className="bg-purple-50/70 dark:bg-purple-950/30 border-l-2 border-purple-500">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={editSheetName}
                      onChange={(e) => setEditSheetName(e.target.value)}
                      className="w-full text-xs font-semibold border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={editSheetW}
                        onChange={(e) => setEditSheetW(parseFloat(e.target.value) || 0)}
                        className="w-20 text-xs border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                      />
                      <span className="text-xs text-gray-500">mm</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={editSheetH}
                        onChange={(e) => setEditSheetH(parseFloat(e.target.value) || 0)}
                        className="w-20 text-xs border p-1.5 rounded dark:bg-gray-900 dark:border-gray-700"
                      />
                      <span className="text-xs text-gray-500">mm</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={handleSaveEditSheet}
                        className="text-emerald-500 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Save changes"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEditSheet}
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
                  <td className="py-2.5 px-3 font-semibold">{s.name}</td>
                  <td className="py-2.5 px-3">{s.width} mm</td>
                  <td className="py-2.5 px-3">{s.height} mm</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => startEditSheet(idx, s)}
                        className="text-purple-500 hover:text-purple-700 p-1 rounded-md hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Edit sheet"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteSheet(s.name)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Delete sheet"
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

      {/* Add new sheet inline */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Preset Name</label>
          <input
            type="text"
            placeholder="e.g. B1 Super"
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Width (mm)</label>
          <input
            type="number"
            value={newSheetW}
            onChange={(e) => setNewSheetW(parseFloat(e.target.value) || 0)}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Height (mm)</label>
          <input
            type="number"
            value={newSheetH}
            onChange={(e) => setNewSheetH(parseFloat(e.target.value) || 0)}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <button
          onClick={handleAddSheet}
          className="flex items-center justify-center space-x-1 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} />
          <span>Add Sheet</span>
        </button>
      </div>
    </div>
  );
}
