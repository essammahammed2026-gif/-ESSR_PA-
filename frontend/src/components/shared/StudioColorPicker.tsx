"use client";

import React, { useRef } from "react";
import { Pipette } from "lucide-react";

export interface StudioColorPickerProps {
  label?: string;
  color: string;
  defaultColor?: string;
  onChange: (hex: string) => void;
  onActivateEyedropper?: () => void;
  eyedropperShortcut?: string;
}

/**
 * Universal single-row studio color picker.
 * - Anchors the hidden native <input type="color"> to `left-0` of the relative row container
 *   so browser color dialogs never clip off the right edge of the window.
 * - Uses only the unified in-app canvas loupe eyedropper (`onActivateEyedropper`), avoiding
 *   conflicting browser EyeDropper API double-launches across Linux/Windows.
 */
export function StudioColorPicker({
  label = "Color",
  color,
  defaultColor = "#ffffff",
  onChange,
  onActivateEyedropper,
  eyedropperShortcut = "I",
}: StudioColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const currentHex = (color || defaultColor).slice(0, 7);

  return (
    <div className="flex items-center justify-between py-1 text-xs relative">
      <input
        ref={colorInputRef}
        type="color"
        value={currentHex}
        onChange={(e) => onChange(e.target.value)}
        className="absolute left-0 top-0 w-1 h-1 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className="w-5 h-5 rounded border border-white/20 hover:border-white/50 cursor-pointer p-0 shrink-0 transition-colors"
          style={{ backgroundColor: currentHex }}
          title={`Choose ${label.toLowerCase()}`}
        />
        {onActivateEyedropper && (
          <button
            type="button"
            onClick={onActivateEyedropper}
            className="p-1 rounded hover:bg-[#1C212C] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={`Pick color directly from page (${eyedropperShortcut})`}
          >
            <Pipette size={13} />
          </button>
        )}
        <span className="font-mono text-[10px] text-slate-300 uppercase">
          {currentHex}
        </span>
        {currentHex.toLowerCase() !== defaultColor.toLowerCase() && (
          <button
            type="button"
            onClick={() => onChange(defaultColor)}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            title={`Reset to default (${defaultColor.toUpperCase()})`}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
