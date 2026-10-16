"use client";

import { Moon, Sun, Palette, Sparkles, Check, Laptop, Monitor } from "lucide-react";
import { useAppearance, UiScale } from "@/context/AppearanceContext";

const PRESET_ACCENTS = [
  { name: "Amber Gold", hex: "#F59E0B" },
  { name: "Cyan Teal", hex: "#06B6D4" },
  { name: "Emerald Print", hex: "#10B981" },
  { name: "Purple Studio", hex: "#8B5CF6" },
  { name: "Rose Crimson", hex: "#F43F5E" },
  { name: "Industrial Orange", hex: "#F97316" },
  { name: "Electric Blue", hex: "#3B82F6" },
];

const UI_SCALES: { id: UiScale; label: string; desc: string; icon: React.ReactNode; tag?: string }[] = [
  { id: "compact", label: "Compact", desc: "Optimized for 14\"–15\" laptops", icon: <Laptop size={16} />, tag: "Laptop" },
  { id: "default", label: "Balanced", desc: "Standard desktop density", icon: <Monitor size={16} /> },
  { id: "relaxed", label: "Relaxed", desc: "Spacious for 27\"+ monitors", icon: <Monitor size={16} /> },
];

export default function AppearanceSection() {
  const { theme, setTheme, accentColor, setAccentColor, uiScale, setUiScale, resetAppearance } = useAppearance();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
          <Palette className="text-purple-500" size={18} style={{ color: "var(--app-accent, #8b5cf6)" }} />
          <span>Appearance & Theming</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Customize UI theme mode and system-wide accent styling for buttons, highlights, split lines, and indicators.
        </p>
      </div>

      {/* 1. Theme Mode Setting */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-3">
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">Theme Mode</label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Select the active interface theme for all studio editors.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md pt-1">
          {/* Dark Mode (Active Default) */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-purple-500/10 dark:bg-purple-950/40 border-purple-500 shadow-xs"
                : "bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 hover:border-gray-400"
            }`}
            style={theme === "dark" ? { borderColor: "var(--app-accent, #8b5cf6)" } : undefined}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-900 text-amber-400 border border-gray-700 shrink-0"
              style={{ color: "var(--app-accent, #f59e0b)" }}
            >
              <Moon size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-1.5">
                <span>Dark Theme</span>
                {theme === "dark" && (
                  <span
                    className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-purple-500/20 text-purple-400"
                    style={{ color: "var(--app-accent, #8b5cf6)" }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">High-contrast prepress darkroom</div>
            </div>
          </button>

          {/* Light Mode (Placeholder) */}
          <div
            className="flex items-center space-x-3 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 opacity-60 cursor-not-allowed select-none text-left"
            title="Light Theme will be available in a future update"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-500 shrink-0">
              <Sun size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center space-x-1.5">
                <span>Light Theme</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500">
                  Coming Soon
                </span>
              </div>
              <div className="text-[11px] text-gray-400">Daylight studio view (placeholder)</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Global Accent Color Picker */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-4">
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">Accent Color</label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Globally updates highlight colors across studio action buttons, split lines, active tabs, and canvas markers.
          </span>
        </div>

        {/* Color picker and hex input */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 border rounded-lg p-0.5 cursor-pointer dark:bg-gray-900 dark:border-gray-700"
              title="Click to pick a custom accent color"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,8}$/.test(val)) {
                  setAccentColor(val);
                }
              }}
              className="w-28 text-sm font-mono border px-3 py-2 rounded-lg dark:bg-gray-900 dark:border-gray-700 uppercase"
              placeholder="#F59E0B"
            />
          </div>

          <button
            type="button"
            onClick={resetAppearance}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
          >
            Reset Default Accent
          </button>
        </div>

        {/* Preset Palette Swatches */}
        <div>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-2">
            Preset Swatches
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_ACCENTS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setAccentColor(preset.hex)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "border-gray-900 dark:border-white shadow-xs ring-1 ring-white/50"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shadow-inner"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{preset.name}</span>
                  {isSelected && <Check size={12} className="text-gray-900 dark:text-white ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live UI Preview Demonstration */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-2">
            Live Preview
          </span>
          <div className="p-3 bg-gray-950/70 rounded-xl border border-gray-800 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-lg text-slate-950 text-xs font-bold shadow-md cursor-default select-none flex items-center space-x-1.5"
              style={{ backgroundColor: accentColor }}
            >
              <Sparkles size={12} />
              <span>Studio Primary Button</span>
            </button>

            <div
              className="px-2.5 py-1 rounded-full text-slate-950 font-mono font-bold text-[10px] shadow-sm select-none"
              style={{ backgroundColor: accentColor }}
            >
              Cut Line: 50.0%
            </div>

            <div
              className="px-2 py-1 rounded-md text-xs font-semibold border select-none"
              style={{
                color: accentColor,
                borderColor: accentColor,
                backgroundColor: "var(--app-accent-15, rgba(245, 158, 11, 0.15))",
              }}
            >
              Active State Highlight
            </div>
          </div>
        </div>
      </div>

      {/* 3. Display Density & UI Scaling */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-3">
        <div>
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">Display Density & UI Scale</label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Adjust interface scaling to fit smaller screens (14–15 inch laptops) or expansive desktop displays.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {UI_SCALES.map((scale) => {
            const isSelected = uiScale === scale.id;
            return (
              <button
                key={scale.id}
                type="button"
                onClick={() => setUiScale(scale.id)}
                className={`flex items-start space-x-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-500/10 dark:bg-purple-950/40 border-purple-500 shadow-xs"
                    : "bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                }`}
                style={isSelected ? { borderColor: "var(--app-accent, #8b5cf6)" } : undefined}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-900 border border-gray-700 shrink-0 mt-0.5"
                  style={{ color: isSelected ? "var(--app-accent, #f59e0b)" : "#94A3B8" }}
                >
                  {scale.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-1.5">
                    <span>{scale.label}</span>
                    {scale.tag && (
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        style={{ color: "var(--app-accent, #f59e0b)", borderColor: "var(--app-accent-30, rgba(245,158,11,0.3))" }}
                      >
                        {scale.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{scale.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
