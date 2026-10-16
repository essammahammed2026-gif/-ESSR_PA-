"use client";

import React, { useState, useEffect, useMemo } from "react";
import { History, RotateCcw, Keyboard } from "lucide-react";
import type { AppSettingsData } from "./types";
import { NumberControl } from "@/components/ui/NumberControl";

interface ShortcutsSectionProps {
  settings: AppSettingsData;
  onSettingsChange: React.Dispatch<React.SetStateAction<AppSettingsData>>;
}

interface ShortcutDef {
  key: string;
  label: string;
  description: string;
  defaultKey: string;
}

const SHORTCUT_DEFS: ShortcutDef[] = [
  { key: "undo", label: "Undo Last Action", description: "Revert the most recent document modification", defaultKey: "ctrl+z" },
  { key: "redo", label: "Redo Action", description: "Reapply previously undone document modifications", defaultKey: "ctrl+y" },
  { key: "restore_original", label: "Restore Original", description: "Revert document back to initial intake state", defaultKey: "ctrl+shift+r" },
  { key: "prev_page", label: "Previous Page", description: "Select the previous card in the page deck", defaultKey: "[" },
  { key: "next_page", label: "Next Page", description: "Select the next card in the page deck", defaultKey: "]" },
  { key: "toggle_original", label: "Toggle Original", description: "Inspect raw scanned page vs. processed page", defaultKey: "o" },
  { key: "rotate", label: "Rotate 90° CW", description: "Rotate the currently selected page 90° clockwise", defaultKey: "r" },
  { key: "zoom_in", label: "Zoom In", description: "Zoom in on the active page preview canvas", defaultKey: "=" },
  { key: "zoom_out", label: "Zoom Out", description: "Zoom out on the active page preview canvas", defaultKey: "-" },
  { key: "zoom_reset", label: "Reset Zoom (100%)", description: "Reset canvas zoom and pan back to centered 100%", defaultKey: "ctrl+0" },
  { key: "pan", label: "Pan / Hand Tool", description: "Toggle or hold to pan freely across the preview canvas", defaultKey: "h" },
];

export default function ShortcutsSection({ settings, onSettingsChange }: ShortcutsSectionProps) {
  const [listeningKey, setListeningKey] = useState<string | null>(null);

  const bookSettings = useMemo(() => settings.book_studio || {
    history_limit: 50,
    shortcuts: {
      undo: "ctrl+z",
      redo: "ctrl+y",
      restore_original: "ctrl+shift+r",
      prev_page: "[",
      next_page: "]",
      toggle_original: "o",
      rotate: "r",
      zoom_in: "=",
      zoom_out: "-",
      zoom_reset: "ctrl+0",
      pan: "h",
    },
  }, [settings.book_studio]);

  const handleLimitChange = (valStr: string) => {
    const num = Number(valStr);
    const clamped = Math.max(10, Math.min(100, Math.round(isNaN(num) ? 50 : num)));
    onSettingsChange((prev) => ({
      ...prev,
      book_studio: {
        ...(prev.book_studio || bookSettings),
        history_limit: clamped,
      },
    }));
  };

  const handleResetShortcuts = () => {
    const defaultShortcuts: Record<string, string> = {};
    SHORTCUT_DEFS.forEach((d) => {
      defaultShortcuts[d.key] = d.defaultKey;
    });
    onSettingsChange((prev) => ({
      ...prev,
      book_studio: {
        ...(prev.book_studio || bookSettings),
        shortcuts: defaultShortcuts,
      },
    }));
  };

  useEffect(() => {
    if (!listeningKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore bare modifier keydowns
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");

      let keyName = e.key.toLowerCase();
      if (keyName === " ") keyName = "space";
      else if (keyName === "arrowleft") keyName = "left";
      else if (keyName === "arrowright") keyName = "right";
      else if (keyName === "arrowup") keyName = "up";
      else if (keyName === "arrowdown") keyName = "down";

      parts.push(keyName);
      const combo = parts.join("+");

      onSettingsChange((prev) => ({
        ...prev,
        book_studio: {
          ...(prev.book_studio || bookSettings),
          shortcuts: {
            ...((prev.book_studio && prev.book_studio.shortcuts) || bookSettings.shortcuts),
            [listeningKey]: combo,
          },
        },
      }));
      setListeningKey(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [listeningKey, bookSettings, onSettingsChange]);

  const formatCombo = (combo: string): string => {
    return combo
      .split("+")
      .map((p) => (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" + ");
  };

  return (
    <div className="space-y-6">
      {/* Journal History Limit */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <History size={18} className="text-purple-500" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Book Studio History Journal</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">History Entries Limit</span>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Maximum actions retained in the snapshot journal (default: 50, range: 10–100).
            </p>
          </div>
          <div className="w-36">
            <NumberControl
              label="Max Steps"
              value={String(bookSettings.history_limit)}
              onChange={handleLimitChange}
              min="10"
              max="100"
              step="5"
              unit="steps"
            />
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Rebinding */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Keyboard size={18} className="text-purple-500" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={handleResetShortcuts}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Hotkeys</span>
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click any shortcut button to record a new key combination. Shortcuts are designed to work safely across Chrome and Firefox.
        </p>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {SHORTCUT_DEFS.map((def) => {
            const currentCombo = (bookSettings.shortcuts && bookSettings.shortcuts[def.key]) || def.defaultKey;
            const isListening = listeningKey === def.key;

            return (
              <div key={def.key} className="py-2.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{def.label}</span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{def.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setListeningKey(isListening ? null : def.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    isListening
                      ? "bg-purple-600 text-white border-purple-500 animate-pulse shadow-md"
                      : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:border-purple-500"
                  }`}
                  title={isListening ? "Press keys now or click again to cancel" : "Click to rebind shortcut"}
                >
                  {isListening ? "Press keys..." : formatCombo(currentCombo)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
