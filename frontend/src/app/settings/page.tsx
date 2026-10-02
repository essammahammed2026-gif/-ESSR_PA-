"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  Layers, 
  Scissors, 
  BookOpen, 
  RotateCcw, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Sliders,
  Edit2,
  Check,
  X
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Sheet {
  name: string;
  width: number;
  height: number;
  unit: string;
}

interface Roll {
  name: string;
  width: number;
  unit: string;
}

interface AppSettingsData {
  sheets: Sheet[];
  rolls: Roll[];
  imposing: {
    default_sheet_unit: string;
    default_margin: number;
    default_gap: number;
    default_bleed: number;
    crop_marks: boolean;
    draw_border: boolean;
    auto_rotate_sheet: boolean;
    uniform_orientation: boolean;
  };
  contour: {
    default_dpi: number;
    default_threshold: number;
    default_offset: number;
    default_stroke_color: string;
    default_stroke_width: number;
    default_smoothing: number;
    keep_holes: boolean;
  };
  flipbook: {
    default_dpi: number;
    default_direction: string;
    default_binding: string;
    default_texture: string;
    sound_enabled: boolean;
    eco_mode: boolean;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "sheets" | "imposing" | "contour" | "flipbook">("sheets");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettingsData>({
    sheets: [],
    rolls: [],
    imposing: {
      default_sheet_unit: "mm",
      default_margin: 10,
      default_gap: 5,
      default_bleed: 2,
      crop_marks: false,
      draw_border: false,
      auto_rotate_sheet: true,
      uniform_orientation: true,
    },
    contour: {
      default_dpi: 300,
      default_threshold: 20,
      default_offset: 0,
      default_stroke_color: "#FF00FF",
      default_stroke_width: 1.0,
      default_smoothing: 2.0,
      keep_holes: false,
    },
    flipbook: {
      default_dpi: 101,
      default_direction: "Left to Right (LTR)",
      default_binding: "Soft Cover (Paperback)",
      default_texture: "Dark Mode",
      sound_enabled: false,
      eco_mode: false,
    },
  });

  // Form states for new presets
  const [newSheetName, setNewSheetName] = useState("");
  const [newSheetW, setNewSheetW] = useState(320);
  const [newSheetH, setNewSheetH] = useState(450);

  const [newRollName, setNewRollName] = useState("");
  const [newRollW, setNewRollW] = useState(600);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE_URL + "/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        setErrorMsg("Failed to load settings from server");
      }
    } catch {
      setErrorMsg("Error connecting to backend API");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(API_BASE_URL + "/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSuccessMsg("Settings saved successfully!");
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setErrorMsg("Failed to update settings");
      }
    } catch {
      setErrorMsg("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Reset all settings to system defaults? Custom presets will be reverted.")) return;
    setSaving(true);
    try {
      const res = await fetch(API_BASE_URL + "/api/settings/reset", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSuccessMsg("Settings restored to factory defaults");
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch {
      setErrorMsg("Failed to reset settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSheet = () => {
    if (!newSheetName.trim() || newSheetW <= 0 || newSheetH <= 0) return;
    const updated = [
      ...settings.sheets.filter((s) => s.name.toLowerCase() !== newSheetName.trim().toLowerCase()),
      { name: newSheetName.trim(), width: Number(newSheetW), height: Number(newSheetH), unit: "mm" },
    ];
    setSettings({ ...settings, sheets: updated });
    setNewSheetName("");
  };

  const handleDeleteSheet = (name: string) => {
    setSettings({
      ...settings,
      sheets: settings.sheets.filter((s) => s.name !== name),
    });
  };

  const handleAddRoll = () => {
    if (!newRollName.trim() || newRollW <= 0) return;
    const updated = [
      ...settings.rolls.filter((r) => r.name.toLowerCase() !== newRollName.trim().toLowerCase()),
      { name: newRollName.trim(), width: Number(newRollW), unit: "mm" },
    ];
    setSettings({ ...settings, rolls: updated });
    setNewRollName("");
  };

  const handleDeleteRoll = (name: string) => {
    setSettings({
      ...settings,
      rolls: settings.rolls.filter((r) => r.name !== name),
    });
  };

  // Editing state for sheets
  const [editingSheetIdx, setEditingSheetIdx] = useState<number | null>(null);
  const [editSheetName, setEditSheetName] = useState("");
  const [editSheetW, setEditSheetW] = useState(320);
  const [editSheetH, setEditSheetH] = useState(450);

  // Editing state for rolls
  const [editingRollIdx, setEditingRollIdx] = useState<number | null>(null);
  const [editRollName, setEditRollName] = useState("");
  const [editRollW, setEditRollW] = useState(600);

  const startEditSheet = (idx: number, sheet: Sheet) => {
    setEditingSheetIdx(idx);
    setEditSheetName(sheet.name);
    setEditSheetW(sheet.width);
    setEditSheetH(sheet.height);
  };

  const handleSaveEditSheet = () => {
    if (editingSheetIdx === null) return;
    if (!editSheetName.trim() || editSheetW <= 0 || editSheetH <= 0) return;
    const updated = [...settings.sheets];
    updated[editingSheetIdx] = {
      name: editSheetName.trim(),
      width: Number(editSheetW),
      height: Number(editSheetH),
      unit: "mm",
    };
    setSettings({ ...settings, sheets: updated });
    setEditingSheetIdx(null);
  };

  const handleCancelEditSheet = () => {
    setEditingSheetIdx(null);
  };

  const startEditRoll = (idx: number, roll: Roll) => {
    setEditingRollIdx(idx);
    setEditRollName(roll.name);
    setEditRollW(roll.width);
  };

  const handleSaveEditRoll = () => {
    if (editingRollIdx === null) return;
    if (!editRollName.trim() || editRollW <= 0) return;
    const updated = [...settings.rolls];
    updated[editingRollIdx] = {
      name: editRollName.trim(),
      width: Number(editRollW),
      unit: "mm",
    };
    setSettings({ ...settings, rolls: updated });
    setEditingRollIdx(null);
  };

  const handleCancelEditRoll = () => {
    setEditingRollIdx(null);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-2 md:p-3">
      {/* Compact Header */}
      <div className="w-full mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2.5">
          <Settings className="text-purple-500" size={20} />
          <h1 className="text-base md:text-lg font-bold tracking-tight">System Settings</h1>
          <span className="hidden xl:inline text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-2.5">
            Configure defaults, print media formats, and studio engine preferences
          </span>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <button
            onClick={handleResetDefaults}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {loading && (
        <div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded-xl flex items-center space-x-2 text-sm">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading system preferences...</span>
        </div>
      )}
      {successMsg && (
        <div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center space-x-2 text-sm">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl flex items-center space-x-2 text-sm">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Layout Tabs */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1">
          <button
            onClick={() => setActiveTab("sheets")}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition ${
              activeTab === "sheets"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800"
            }`}
          >
            <Layers size={18} />
            <span>Sheet & Roll Media</span>
          </button>

          <button
            onClick={() => setActiveTab("imposing")}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition ${
              activeTab === "imposing"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800"
            }`}
          >
            <Sliders size={18} />
            <span>Imposing Studio</span>
          </button>

          <button
            onClick={() => setActiveTab("contour")}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition ${
              activeTab === "contour"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800"
            }`}
          >
            <Scissors size={18} />
            <span>Contour Cut Studio</span>
          </button>

          <button
            onClick={() => setActiveTab("flipbook")}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition ${
              activeTab === "flipbook"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800"
            }`}
          >
            <BookOpen size={18} />
            <span>Flipbook Studio</span>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="md:col-span-3 space-y-6">
          {/* TAB 1: MEDIA PRESETS */}
          {activeTab === "sheets" && (
            <div className="space-y-6">
              {/* Sheet Presets */}
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
                      {settings.sheets.map((s, idx) => (
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

              {/* Roll Presets */}
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
                      {settings.rolls.map((r, idx) => (
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
            </div>
          )}

          {/* TAB 2: IMPOSING DEFAULTS */}
          {activeTab === "imposing" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold">Imposing Studio Preferences</h2>
              <p className="text-xs text-gray-500 -mt-3">Initial parameters applied to new imposition projects.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium block mb-1">Default Unit</label>
                  <select
                    value={settings.imposing.default_sheet_unit}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, default_sheet_unit: e.target.value },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="mm">Millimeters (mm)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="in">Inches (in)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Margin (mm)</label>
                  <input
                    type="number"
                    value={settings.imposing.default_margin}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, default_margin: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Artwork Gap (mm)</label>
                  <input
                    type="number"
                    value={settings.imposing.default_gap}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, default_gap: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Bleed Allowance (mm)</label>
                  <input
                    type="number"
                    value={settings.imposing.default_bleed}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, default_bleed: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.imposing.crop_marks}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, crop_marks: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Enable Crop / Corner Cut Marks by Default</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.imposing.draw_border}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, draw_border: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Draw Outer Diecut / Bleed Border Lines by Default</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.imposing.uniform_orientation}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, uniform_orientation: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Enforce Same Orientation for Polar / Guillotine Cutting by Default</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.imposing.auto_rotate_sheet}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imposing: { ...settings.imposing, auto_rotate_sheet: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Auto-Rotate Sheet Orientation for Maximum Yield</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: CONTOUR DEFAULTS */}
          {activeTab === "contour" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold">Contour Cut Preferences</h2>
              <p className="text-xs text-gray-500 -mt-3">Default parameters for sticker cutline generation and Bézier tracing.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium block mb-1">Default Processing DPI</label>
                  <select
                    value={settings.contour.default_dpi}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contour: { ...settings.contour, default_dpi: parseInt(e.target.value) || 300 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="150">150 DPI (Fast preview)</option>
                    <option value="300">300 DPI (High Precision Print)</option>
                    <option value="600">600 DPI (Ultra Sharp Cutting)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Threshold (0-255)</label>
                  <input
                    type="number"
                    min="1"
                    max="254"
                    value={settings.contour.default_threshold}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contour: { ...settings.contour, default_threshold: parseInt(e.target.value) || 20 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Cut Offset (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.contour.default_offset}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contour: { ...settings.contour, default_offset: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Cut Stroke Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={settings.contour.default_stroke_color}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          contour: { ...settings.contour, default_stroke_color: e.target.value },
                        })
                      }
                      className="w-10 h-10 border rounded-lg p-0.5 cursor-pointer dark:bg-gray-900 dark:border-gray-700"
                    />
                    <input
                      type="text"
                      value={settings.contour.default_stroke_color}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          contour: { ...settings.contour, default_stroke_color: e.target.value },
                        })
                      }
                      className="flex-1 text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Smoothing Factor</label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.contour.default_smoothing}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contour: { ...settings.contour, default_smoothing: parseFloat(e.target.value) || 2.0 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.contour.keep_holes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contour: { ...settings.contour, keep_holes: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Retain Inner Holes & Cutouts by Default</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: FLIPBOOK DEFAULTS */}
          {activeTab === "flipbook" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold">Flipbook Studio Preferences</h2>
              <p className="text-xs text-gray-500 -mt-3">Default view, binding style, and rendering resolution.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium block mb-1">Default Reading Direction</label>
                  <select
                    value={settings.flipbook.default_direction}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, default_direction: e.target.value },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="Left to Right (LTR)">Left to Right (LTR)</option>
                    <option value="Right to Left (RTL - Arabic/Hebrew)">Right to Left (RTL)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Binding Style</label>
                  <select
                    value={settings.flipbook.default_binding}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, default_binding: e.target.value },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="Soft Cover (Paperback)">Soft Cover (Paperback)</option>
                    <option value="Hardcover Book">Hardcover Book</option>
                    <option value="Magazine / Saddle-Stitch">Magazine / Saddle-Stitch</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Default Background Texture</label>
                  <select
                    value={settings.flipbook.default_texture}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, default_texture: e.target.value },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  >
                    <option value="Dark Mode">Dark Mode (Neutral)</option>
                    <option value="Wood Desk">Wood Desk</option>
                    <option value="Marble">Marble</option>
                    <option value="White Clean">White Clean</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Rasterization DPI</label>
                  <input
                    type="number"
                    value={settings.flipbook.default_dpi}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, default_dpi: parseInt(e.target.value) || 101 },
                      })
                    }
                    className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.flipbook.sound_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, sound_enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Page Flipping Audio Enabled by Default</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.flipbook.eco_mode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        flipbook: { ...settings.flipbook, eco_mode: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">Eco Mode (Lower memory consumption on large catalogs)</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
