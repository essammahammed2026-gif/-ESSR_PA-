"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, Pipette, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { IconToolBleed } from "@/components/shared/StudioIcons";
import { BleedModuleConfig, BleedEntry } from "@/types/book_studio";
import { type LengthUnit, mmToUnit, unitToMm, UNIT_OPTIONS } from "@/lib/units";
import { PageScopeSelector } from "./PageScopeSelector";

export interface BleedPanelProps {
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  open: boolean;
  onToggle: () => void;
}

export function BleedPanel({
  bleedModule,
  setBleedModule,
  unit = "mm",
  onActivateEyedropper,
  open,
  onToggle,
}: BleedPanelProps) {
  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short || "mm";
  const displayVal = mmToUnit(bleedModule.bleedMm, unit);
  const [textVal, setTextVal] = useState<string>(String(displayVal));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTextVal(String(mmToUnit(bleedModule.bleedMm, unit)));
  }, [bleedModule.bleedMm, unit]);

  const commitBleedInput = () => {
    const parsed = parseFloat(textVal);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setTextVal(String(mmToUnit(bleedModule.bleedMm, unit)));
      return;
    }
    const mmVal = unitToMm(parsed, unit);
    setBleedModule((prev) => ({ ...prev, bleedMm: Math.round(mmVal * 10) / 10 }));
  };

  const handleApplyBleed = () => {
    const currentEntry: BleedEntry = {
      id: editingId || `bleed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bleedMm: bleedModule.bleedMm,
      mode: bleedModule.mode,
      solidColor: bleedModule.solidColor,
      placement: bleedModule.placement || "outside",
      showCropMarks: bleedModule.showCropMarks,
    };

    setBleedModule((prev) => {
      const existing = prev.appliedBleeds || [];
      const updated = editingId
        ? existing.map((b) => (b.id === editingId ? currentEntry : b))
        : [...existing, currentEntry];
      return {
        ...prev,
        appliedBleeds: updated,
      };
    });

    setEditingId(null);
  };

  const handleEditEntry = (entry: BleedEntry) => {
    setEditingId(entry.id);
    setBleedModule((prev) => ({
      ...prev,
      bleedMm: entry.bleedMm,
      mode: entry.mode,
      solidColor: entry.solidColor || prev.solidColor,
      placement: entry.placement,
      showCropMarks: entry.showCropMarks,
    }));
  };

  const handleDeleteEntry = (id: string) => {
    setBleedModule((prev) => {
      const remaining = (prev.appliedBleeds || []).filter((b) => b.id !== id);
      return {
        ...prev,
        appliedBleeds: remaining,
      };
    });
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleNativeEyedropper = async () => {
    // If native EyeDropper API is available in browser, attempt it first
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setBleedModule((prev) => ({ ...prev, solidColor: result.sRGBHex, mode: "solid" }));
          return;
        }
      } catch {
        // Fallback to canvas click sampling
      }
    }
    // Activate on-canvas pixel sampling
    if (onActivateEyedropper) {
      setBleedModule((prev) => ({ ...prev, mode: "solid" }));
      onActivateEyedropper();
    }
  };

  const appliedList = bleedModule.appliedBleeds || [];

  return (
    <div
      className={`rounded-lg border transition-colors ${
        bleedModule.enabled ? "bg-[#181D27] border-[#333D52]" : "bg-[#181D27] border-[#242A38]"
      } px-2.5 py-2 space-y-2 select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity cursor-pointer"
          title="Synthesize mirrored or solid print bleed and vector corner trim marks for guillotine cutting"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-150 text-slate-400 ${open ? "rotate-0" : "-rotate-90"}`}
          />
          <IconToolBleed
            size={14}
            className={bleedModule.enabled ? "" : "text-slate-400"}
            style={bleedModule.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
          />
          <span className="text-xs font-semibold text-slate-200">Bleed</span>
        </button>

        <label className="relative inline-flex items-center cursor-pointer" title="Toggle Print Bleed">
          <input
            type="checkbox"
            checked={bleedModule.enabled}
            onChange={(e) => setBleedModule((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div
            className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
            style={bleedModule.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
          />
        </label>
      </div>

      {/* Body */}
      {open && (
        <div className={`pt-2 border-t border-[#242A38] space-y-2 ${!bleedModule.enabled ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Bleed Placement Selector: Outside vs Inside */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]">
            <button
              type="button"
              onClick={() => setBleedModule((prev) => ({ ...prev, placement: "outside" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                (bleedModule.placement || "outside") === "outside"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={(bleedModule.placement || "outside") === "outside" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Expand sheet outwards by bleed margin (total dimensions increase)"
            >
              Outside Bleed
            </button>
            <button
              type="button"
              onClick={() => setBleedModule((prev) => ({ ...prev, placement: "inside" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                bleedModule.placement === "inside"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={bleedModule.placement === "inside" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Inset safety bleed within existing sheet boundaries"
            >
              Inside Bleed
            </button>
          </div>

          {/* Bleed Mode Selector: Mirror vs Solid Color */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]">
            <button
              type="button"
              onClick={() => setBleedModule((prev) => ({ ...prev, mode: "mirror" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                bleedModule.mode === "mirror"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={bleedModule.mode === "mirror" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Mirror edge pixels of the page into the bleed zone"
            >
              Mirror Edge
            </button>
            <button
              type="button"
              onClick={() => setBleedModule((prev) => ({ ...prev, mode: "solid" }))}
              className={`py-1 rounded font-medium transition-colors cursor-pointer ${
                bleedModule.mode === "solid"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={bleedModule.mode === "solid" ? { color: "var(--app-accent, #f59e0b)" } : undefined}
              title="Fill bleed zone with a solid color"
            >
              Solid Color
            </button>
          </div>

          {/* Solid Color Picker + Eyedropper */}
          {bleedModule.mode === "solid" && (
            <div className="flex items-center justify-between p-1.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]">
              <span className="text-slate-400">Fill Color</span>
              <div className="flex items-center space-x-1.5">
                <input
                  type="color"
                  value={bleedModule.solidColor || "#ffffff"}
                  onChange={(e) => setBleedModule((prev) => ({ ...prev, solidColor: e.target.value }))}
                  className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                  title="Choose solid bleed color"
                />
                <button
                  type="button"
                  onClick={handleNativeEyedropper}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Pick color directly from page (Eyedropper)"
                >
                  <Pipette size={13} />
                </button>
                <span className="font-mono text-[10px] text-slate-300 uppercase">
                  {(bleedModule.solidColor || "#ffffff").slice(0, 7)}
                </span>
              </div>
            </div>
          )}

          {/* Clean Unbounded Numeric Bleed Width Input (No overlapping arrows) */}
          <div
            className="flex items-center justify-between gap-2 p-1.5 bg-[#131720] rounded-md border border-[#242A38] text-[11px]"
            title="Set bleed width (updates preview live)"
          >
            <span className="text-slate-400">Bleed Width</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="number"
                min="0"
                step="0.5"
                value={textVal}
                onChange={(e) => {
                  setTextVal(e.target.value);
                  const parsed = parseFloat(e.target.value);
                  if (Number.isFinite(parsed) && parsed >= 0) {
                    const mmVal = unitToMm(parsed, unit);
                    setBleedModule((prev) => ({ ...prev, bleedMm: Math.round(mmVal * 10) / 10 }));
                  }
                }}
                onBlur={commitBleedInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitBleedInput();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-20 bg-[#0A0D14] border border-[#2E3648] text-slate-100 font-mono font-bold text-xs px-2 py-1 rounded text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-slate-400 font-mono text-[11px] min-w-[20px]">{unitShort}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <label
              className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-300"
              title="Draws vector corner cut marks indicating trim boundaries"
            >
              <input
                type="checkbox"
                checked={bleedModule.showCropMarks}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, showCropMarks: e.target.checked }))}
                className="rounded accent-amber-500"
              />
              <span>Crop Marks</span>
            </label>

            <div className="flex items-center space-x-1.5" title="Output rasterization resolution when exporting PDF">
              <span className="text-[10px] text-slate-400">DPI</span>
              <select
                value={bleedModule.exportDpi}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, exportDpi: parseInt(e.target.value, 10) }))}
                className="bg-[#131720] border border-[#242A38] text-slate-200 text-[11px] font-mono px-1.5 py-0.5 rounded outline-none cursor-pointer"
              >
                <option value="150">150</option>
                <option value="200">200</option>
                <option value="300">300</option>
              </select>
            </div>
          </div>

          {/* Apply / Update Bleed Button */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleApplyBleed}
              className="flex-1 flex items-center justify-center space-x-1 py-1 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer shadow-sm"
              title={editingId ? "Save changes to this bleed entry" : "Commit current bleed configuration"}
            >
              {editingId ? <Check size={12} /> : <Plus size={12} />}
              <span>{editingId ? "Update Bleed" : "Apply Bleed"}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-2.5 py-1 bg-[#242A38] hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors cursor-pointer"
                title="Cancel editing"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Applied Bleeds List */}
          {appliedList.length > 0 && (
            <div className="space-y-1.5 pt-1.5 border-t border-[#242A38]">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Applied Bleeds</span>
                <span className="font-mono text-slate-500">{appliedList.length}</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                {appliedList.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className={`flex items-center justify-between p-1.5 rounded border text-[11px] transition-colors ${
                      editingId === entry.id
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-200"
                        : "bg-[#131720] border-[#242A38] text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          entry.placement === "inside"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {entry.placement || "outside"}
                      </span>
                      <span className="font-mono font-semibold">
                        {mmToUnit(entry.bleedMm, unit)} {unitShort}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        {entry.mode === "solid" ? (
                          <>
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-white/20 shrink-0"
                              style={{ backgroundColor: entry.solidColor || "#fff" }}
                            />
                            <span>Solid</span>
                          </>
                        ) : (
                          <span>Mirror</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditEntry(entry)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Edit this bleed entry"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete this bleed entry"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PageScopeSelector
            scope={bleedModule.scope}
            onChange={(sc) => setBleedModule((prev) => ({ ...prev, scope: sc }))}
          />
        </div>
      )}
    </div>
  );
}
