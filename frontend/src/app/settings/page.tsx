"use client";
import { useState, useEffect } from "react";
import { Settings, Layers, Scissors, BookOpen, RotateCcw, Save, CheckCircle2, AlertCircle, Sliders, HardDrive } from "lucide-react";
import { apiFetch } from "@/lib/api";
import SheetsSection from "@/components/settings/SheetsSection";
import RollsSection from "@/components/settings/RollsSection";
import DefaultsSection from "@/components/settings/DefaultsSection";
import StorageSection from "@/components/settings/StorageSection";
import { DEFAULT_SETTINGS } from "@/components/settings/types";
import type { AppSettingsData, SettingsTab, Sheet, Roll } from "@/components/settings/types";
const TABS: { id: SettingsTab; label: string; Icon: typeof Layers }[] = [
  { id: "sheets", label: "Sheet & Roll Media", Icon: Layers },
  { id: "imposing", label: "Imposing Studio", Icon: Sliders },
  { id: "contour", label: "Contour Cut Studio", Icon: Scissors },
  { id: "flipbook", label: "Flipbook Studio", Icon: BookOpen },
  { id: "storage", label: "Storage & Cleanup", Icon: HardDrive },
];
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("sheets");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettingsData>(DEFAULT_SETTINGS);
  useEffect(() => { fetchSettings(); }, []);
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings");
      if (res.ok) setSettings(await res.json());
      else setErrorMsg("Failed to load settings from server");
    } catch { setErrorMsg("Error connecting to backend API"); }
    finally { setLoading(false); }
  };
  const handleSaveAll = async () => {
    setSaving(true); setSuccessMsg(null); setErrorMsg(null);
    try {
      const res = await apiFetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (res.ok) { setSuccessMsg("Settings saved successfully!"); setTimeout(() => setSuccessMsg(null), 3500); }
      else setErrorMsg("Failed to update settings");
    } catch { setErrorMsg("Network error saving settings"); }
    finally { setSaving(false); }
  };
  const handleResetDefaults = async () => {
    if (!confirm("Reset all settings to system defaults? Custom presets will be reverted.")) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings/reset", { method: "POST" });
      if (res.ok) { const data = await res.json(); setSettings(data.settings); setSuccessMsg("Settings restored to factory defaults"); setTimeout(() => setSuccessMsg(null), 3500); }
    } catch { setErrorMsg("Failed to reset settings"); }
    finally { setSaving(false); }
  };
  const onSheets = (sheets: Sheet[]) => setSettings((s) => ({ ...s, sheets }));
  const onRolls = (rolls: Roll[]) => setSettings((s) => ({ ...s, rolls }));
  return (
    <div className="h-full flex flex-col overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-2 md:p-3">
      <div className="w-full mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2.5">
          <Settings className="text-purple-500" size={20} />
          <h1 className="text-base md:text-lg font-bold tracking-tight">System Settings</h1>
          <span className="hidden xl:inline text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-2.5">Configure defaults, print media formats, and studio engine preferences</span>
        </div>
        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <button onClick={handleResetDefaults} disabled={saving} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"><RotateCcw size={13} /><span>Reset Defaults</span></button>
          <button onClick={handleSaveAll} disabled={saving} className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-50"><Save size={14} /><span>{saving ? "Saving..." : "Save Settings"}</span></button>
        </div>
      </div>
      {loading && (<div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded-xl flex items-center space-x-2 text-sm"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /><span>Loading system preferences...</span></div>)}
      {successMsg && (<div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center space-x-2 text-sm"><CheckCircle2 size={18} /><span>{successMsg}</span></div>)}
      {errorMsg && (<div className="max-w-6xl w-full mx-auto mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl flex items-center space-x-2 text-sm"><AlertCircle size={18} /><span>{errorMsg}</span></div>)}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition ${activeTab === id ? "bg-purple-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800"}`}><Icon size={18} /><span>{label}</span></button>
          ))}
        </div>
        <div className="md:col-span-3 space-y-6">
          {activeTab === "sheets" && (<div className="space-y-6"><SheetsSection sheets={settings.sheets} onSheetsChange={onSheets} /><RollsSection rolls={settings.rolls} onRollsChange={onRolls} /></div>)}
          {(activeTab === "imposing" || activeTab === "contour" || activeTab === "flipbook") && (<DefaultsSection settings={settings} onSettingsChange={setSettings} activeTab={activeTab} />)}
          {activeTab === "storage" && <StorageSection />}
        </div>
      </div>
    </div>
  );
}
