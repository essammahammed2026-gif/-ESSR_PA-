"use client";

import React, { useState, useEffect, useRef } from "react";
import { Moon, Sun, Palette, Sparkles, Check, Laptop, Monitor, RotateCcw, Pipette } from "lucide-react";
import {
  useAppearance,
  UiScale,
  AppTheme,
  DEFAULT_DARK_ACCENT,
  DEFAULT_LIGHT_ACCENT,
} from "@/context/AppearanceContext";

const DARK_PRESET_ACCENTS = [
  { name: "Amber Gold", hex: "#F59E0B" },
  { name: "Cyan Teal", hex: "#06B6D4" },
  { name: "Emerald Print", hex: "#10B981" },
  { name: "Electric Blue", hex: "#3B82F6" },
  { name: "Purple Studio", hex: "#8B5CF6" },
  { name: "Rose Crimson", hex: "#F43F5E" },
  { name: "Industrial Orange", hex: "#F97316" },
];

const LIGHT_PRESET_ACCENTS = [
  { name: "Cobalt Blue", hex: "#2563EB" },
  { name: "Warm Ochre", hex: "#D97706" },
  { name: "Deep Teal", hex: "#0891B2" },
  { name: "Forest Emerald", hex: "#059669" },
  { name: "Royal Indigo", hex: "#4F46E5" },
  { name: "Crimson Press", hex: "#E11D48" },
  { name: "Burnt Copper", hex: "#EA580C" },
];

const UI_SCALES: { id: UiScale; label: string; desc: string; icon: React.ReactNode; tag?: string }[] = [
  { id: "compact", label: "Compact", desc: "Optimized for 14\"–15\" laptops", icon: <Laptop size={16} />, tag: "Laptop" },
  { id: "default", label: "Balanced", desc: "Standard desktop density", icon: <Monitor size={16} /> },
  { id: "relaxed", label: "Relaxed", desc: "Spacious for 27\"+ monitors", icon: <Monitor size={16} /> },
];

export default function AppearanceSection() {
  const {
    theme,
    setTheme,
    darkAccentColor,
    setDarkAccentColor,
    lightAccentColor,
    setLightAccentColor,
    uiScale,
    setUiScale,
  } = useAppearance();

  // Allows customizing either the active theme's accent or switching tabs to configure the other theme's accent
  const [editingAccentTheme, setEditingAccentTheme] = useState<AppTheme>(theme);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingAccentTheme(theme);
  }, [theme]);

  const currentEditingAccent = editingAccentTheme === "light" ? lightAccentColor : darkAccentColor;
  const setCurrentEditingAccent = (hex: string) => {
    if (editingAccentTheme === "light") {
      setLightAccentColor(hex);
    } else {
      setDarkAccentColor(hex);
    }
  };
  const resetCurrentEditingAccent = () => {
    if (editingAccentTheme === "light") {
      setLightAccentColor(DEFAULT_LIGHT_ACCENT);
    } else {
      setDarkAccentColor(DEFAULT_DARK_ACCENT);
    }
  };

  const handleOpenEyedropper = async () => {
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setCurrentEditingAccent(result.sRGBHex);
          return;
        }
      } catch {
        // Fallback to native color picker dialog
      }
    }
    colorInputRef.current?.click();
  };

  const presets = editingAccentTheme === "light" ? LIGHT_PRESET_ACCENTS : DARK_PRESET_ACCENTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-gray-800 pb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center space-x-2">
          <Palette size={18} style={{ color: "var(--app-accent-text, var(--app-accent))" }} />
          <span>Appearance & Theming</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
          Customize UI theme mode and independent accent colors for Dark Mode and Light Mode across all studio tools.
        </p>
      </div>

      {/* 1. Theme Mode Setting */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-slate-300 dark:border-gray-700/80 shadow-xs space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-900 dark:text-gray-200 block">Theme Mode</label>
          <span className="text-xs text-slate-600 dark:text-gray-400">
            Select the active interface theme. Each theme remembers its own custom accent color.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg pt-1">
          {/* Dark Mode ("Obsidian Studio") */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-slate-900/5 dark:bg-gray-900 border-2 shadow-xs"
                : "bg-slate-50 dark:bg-gray-900/60 border-slate-300 dark:border-gray-700 hover:border-slate-400"
            }`}
            style={theme === "dark" ? { borderColor: darkAccentColor } : undefined}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-900 border border-slate-700 shrink-0 shadow-inner"
              style={{ color: darkAccentColor }}
            >
              <Moon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-gray-100 flex items-center justify-between">
                <span>Dark Theme</span>
                {theme === "dark" && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                    style={{
                      backgroundColor: "var(--app-accent-15)",
                      color: "var(--app-accent-text, var(--app-accent))",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-gray-400 flex items-center space-x-1.5 mt-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border border-black/20 shrink-0"
                  style={{ backgroundColor: darkAccentColor }}
                />
                <span className="truncate">Obsidian Studio ({darkAccentColor.toUpperCase()})</span>
              </div>
            </div>
          </button>

          {/* Light Mode ("Daylight Studio") */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              theme === "light"
                ? "bg-slate-50 border-2 shadow-xs"
                : "bg-slate-50 dark:bg-gray-900/60 border-slate-300 dark:border-gray-700 hover:border-slate-400"
            }`}
            style={theme === "light" ? { borderColor: lightAccentColor } : undefined}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F6F7F9] border border-slate-300 shrink-0 shadow-xs"
              style={{ color: lightAccentColor }}
            >
              <Sun size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-gray-100 flex items-center justify-between">
                <span>Light Theme</span>
                {theme === "light" && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                    style={{
                      backgroundColor: "var(--app-accent-15)",
                      color: "var(--app-accent-text, var(--app-accent))",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-gray-400 flex items-center space-x-1.5 mt-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border border-black/20 shrink-0"
                  style={{ backgroundColor: lightAccentColor }}
                />
                <span className="truncate">Daylight Studio ({lightAccentColor.toUpperCase()})</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Per-Theme Accent Color Picker */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-slate-300 dark:border-gray-700/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-sm font-semibold text-slate-900 dark:text-gray-200 block">
              Theme Accent Color
            </label>
            <span className="text-xs text-slate-600 dark:text-gray-400">
              Pick an independent accent color for Dark Theme and Light Theme.
            </span>
          </div>

          {/* Segmented Switcher to edit Dark Accent vs Light Accent */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/80 dark:bg-gray-900 border border-slate-300 dark:border-gray-700 self-start">
            <button
              type="button"
              onClick={() => setEditingAccentTheme("dark")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                editingAccentTheme === "dark"
                  ? "bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: darkAccentColor }}
              />
              <span>Dark Accent</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingAccentTheme("light")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                editingAccentTheme === "light"
                  ? "bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: lightAccentColor }}
              />
              <span>Light Accent</span>
            </button>
          </div>
        </div>

        {/* Color picker and hex input for the selected theme */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <input
              ref={colorInputRef}
              type="color"
              value={currentEditingAccent}
              onChange={(e) => setCurrentEditingAccent(e.target.value)}
              className="w-10 h-10 border border-slate-300 dark:border-gray-700 rounded-lg p-0.5 cursor-pointer bg-white dark:bg-gray-900"
              title={`Pick custom accent color for ${editingAccentTheme === "light" ? "Light" : "Dark"} Theme`}
            />
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Open Custom Color Picker"
            >
              <Palette size={13} style={{ color: currentEditingAccent }} />
              <span>Color Picker</span>
            </button>
            <button
              type="button"
              onClick={handleOpenEyedropper}
              className="p-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Sample Accent Color from Screen (Eyedropper)"
            >
              <Pipette size={14} />
            </button>
            <input
              type="text"
              value={currentEditingAccent}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,8}$/.test(val)) {
                  setCurrentEditingAccent(val);
                }
              }}
              className="w-28 text-sm font-mono font-semibold border border-slate-300 dark:border-gray-700 px-3 py-2 rounded-lg bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100 uppercase"
              placeholder={editingAccentTheme === "light" ? DEFAULT_LIGHT_ACCENT : DEFAULT_DARK_ACCENT}
            />
          </div>

          <button
            type="button"
            onClick={resetCurrentEditingAccent}
            className="flex items-center space-x-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset {editingAccentTheme === "light" ? "Light" : "Dark"} Default</span>
          </button>

          {editingAccentTheme !== theme && (
            <button
              type="button"
              onClick={() => setTheme(editingAccentTheme)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-700/50 text-slate-800 dark:text-gray-200 hover:brightness-95 transition-all cursor-pointer"
            >
              Switch to {editingAccentTheme === "light" ? "Light" : "Dark"} Theme to Preview Live
            </button>
          )}
        </div>

        {/* Preset Palette Swatches for the selected theme */}
        <div>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 block mb-2">
            Recommended {editingAccentTheme === "light" ? "Light Theme (Daylight Paper)" : "Dark Theme (Obsidian Studio)"} Swatches
          </span>
          {/* Custom Any-Color Swatch Button inside the Preset Swatches row */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const isSelected = currentEditingAccent.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setCurrentEditingAccent(preset.hex)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-gray-700/60 font-semibold shadow-xs"
                      : "border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 hover:border-slate-400"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shadow-inner border border-black/15"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-slate-800 dark:text-gray-200">{preset.name}</span>
                  {isSelected && <Check size={12} className="text-slate-900 dark:text-white ml-0.5" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-400 dark:border-gray-600 bg-white dark:bg-gray-900/40 hover:border-slate-600 dark:hover:border-gray-400 text-xs font-semibold text-slate-800 dark:text-gray-200 transition-all cursor-pointer"
              title="Pick any custom accent color"
            >
              <span
                className="w-3.5 h-3.5 rounded-full inline-block border border-black/20"
                style={{
                  background: "conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #f43f5e)",
                }}
              />
              <span>Custom...</span>
            </button>
          </div>
        </div>

        {/* Live UI Preview Surface (Adapts to editingAccentTheme) */}
        <div className="pt-2 border-t border-slate-200 dark:border-gray-700/60">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 block mb-2">
            Live {editingAccentTheme === "light" ? "Light Theme" : "Dark Theme"} Component Preview
          </span>
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center gap-3 ${
              editingAccentTheme === "light"
                ? "bg-[#F8FAFC] border-slate-300 text-slate-900"
                : "bg-[#131720] border-slate-800 text-slate-100"
            }`}
          >
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm cursor-default select-none flex items-center space-x-1.5"
              style={{
                backgroundColor: currentEditingAccent,
                color: editingAccentTheme === "light" ? "#FFFFFF" : "#0F172A",
              }}
            >
              <Sparkles size={12} />
              <span>Studio Primary Action</span>
            </button>

            <div
              className="px-2.5 py-1 rounded-full font-mono font-bold text-[10px] shadow-xs select-none"
              style={{
                backgroundColor: currentEditingAccent,
                color: editingAccentTheme === "light" ? "#FFFFFF" : "#0F172A",
              }}
            >
              Cut Line: 50.0%
            </div>

            <div
              className="px-2.5 py-1 rounded-md text-xs font-semibold border select-none"
              style={{
                color: currentEditingAccent,
                borderColor: currentEditingAccent,
                backgroundColor: `${currentEditingAccent}1F`,
              }}
            >
              Active Tool Pill
            </div>
          </div>
        </div>
      </div>

      {/* 3. Display Density & UI Scaling */}
      <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-slate-300 dark:border-gray-700/80 shadow-xs space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-900 dark:text-gray-200 block">Display Density & UI Scale</label>
          <span className="text-xs text-slate-600 dark:text-gray-400">
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
                    ? "bg-slate-900/5 dark:bg-purple-950/40 border-2 shadow-xs"
                    : "bg-slate-50 dark:bg-gray-900/60 border-slate-300 dark:border-gray-700 hover:border-slate-400"
                }`}
                style={isSelected ? { borderColor: "var(--app-accent)" } : undefined}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700 shrink-0 mt-0.5"
                  style={{ color: isSelected ? "var(--app-accent-text, var(--app-accent))" : "#64748B" }}
                >
                  {scale.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-gray-100 flex items-center space-x-1.5">
                    <span>{scale.label}</span>
                    {scale.tag && (
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded-full font-mono border font-semibold"
                        style={{
                          backgroundColor: "var(--app-accent-15)",
                          color: "var(--app-accent-text, var(--app-accent))",
                          borderColor: "var(--app-accent-30)",
                        }}
                      >
                        {scale.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-gray-400 mt-0.5 leading-tight">{scale.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
