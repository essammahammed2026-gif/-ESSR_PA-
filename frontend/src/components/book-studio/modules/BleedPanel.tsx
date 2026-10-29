"use client";

import React, { useState, useEffect } from "react";
import { Pipette, Check, RotateCcw } from "lucide-react";
import { BleedModuleConfig, BleedEntry, ModuleTaskProgress, BookStudioPage } from "@/types/book_studio";
import { type LengthUnit, mmToUnit, unitToMm, UNIT_OPTIONS } from "@/lib/units";
import { PageScopeSelector, ModuleProgressBar, formatScopeLabel } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface BleedPanelProps {
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

const BLEED_PRESETS_MM = [0, 2, 3, 5];

export function BleedPanel({
  bleedModule,
  setBleedModule,
  unit = "mm",
  onActivateEyedropper,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  shortcutLabels = {},
}: BleedPanelProps) {
  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short || "mm";
  const displayVal = mmToUnit(bleedModule.bleedMm, unit);
  const [textVal, setTextVal] = useState<string>(String(displayVal));

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
    setBleedModule((prev) => ({ ...prev, enabled: true, bleedMm: Math.round(mmVal * 10) / 10 }));
  };

  const handleApplyBleed = () => {
    const concrete = resolveConcretePageNumbers(pages, bleedModule.scope, selectedPageId);
    const isAll = bleedModule.scope.mode === "all";
    const label = "Bleed";
    const bleedOption = bleedModule.mode === "solid"
      ? `${mmToUnit(bleedModule.bleedMm, unit)}${unitShort} • ${bleedModule.solidColor.toUpperCase()}`
      : `${mmToUnit(bleedModule.bleedMm, unit)}${unitShort} • Mirror`;
    const details = bleedOption;

    const currentEntry: BleedEntry = {
      id: `bleed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bleedMm: bleedModule.bleedMm,
      mode: bleedModule.mode,
      solidColor: bleedModule.solidColor,
      placement: bleedModule.placement || "outside",
      showCropMarks: bleedModule.showCropMarks,
      scopeLabel: concrete.scopeLabel,
      origScope: isAll ? "all" : undefined,
      excludedPages: [],
      targetPages: concrete.pageNumbers,
      targetPageIds: concrete.pageIds,
      visible: true,
      label,
      details,
      params: {
        bleedMm: bleedModule.bleedMm,
        mode: bleedModule.mode,
        solidColor: bleedModule.solidColor,
        placement: bleedModule.placement,
        showCropMarks: bleedModule.showCropMarks,
        scope: bleedModule.scope,
      },
    };

    setBleedModule((prev) => {
      const existing = prev.appliedBleeds || [];
      const updated = [...existing.filter((b) => b.scopeLabel !== concrete.scopeLabel), currentEntry];
      return {
        ...prev,
        enabled: true,
        appliedBleeds: updated,
      };
    });
  };

  const handleNativeEyedropper = async () => {
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setBleedModule((prev) => ({ ...prev, enabled: true, solidColor: result.sRGBHex, mode: "solid" }));
          return;
        }
      } catch {
        // Fallback to canvas click sampling
      }
    }
    if (onActivateEyedropper) {
      setBleedModule((prev) => ({ ...prev, enabled: true, mode: "solid" }));
      onActivateEyedropper();
    }
  };

  return (
    <div className="space-y-5 select-none">
      <ModuleProgressBar task={taskProgress} />

      {/* Section 1: Bleed Placement & Fill Mode */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Placement
        </span>

        {/* Outside vs Inside Bleed */}
        <div className="grid grid-cols-2 gap-1.5">
          {([
            {
              id: "outside" as const,
              title: "Outside",
              desc: "Expands outward",
            },
            {
              id: "inside" as const,
              title: "Inside",
              desc: "Safety margin",
            },
          ]).map((pl) => {
            const active = (bleedModule.placement || "outside") === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => setBleedModule((prev) => ({ ...prev, enabled: true, placement: pl.id }))}
                className={`p-2 rounded-md text-left transition-all cursor-pointer ${
                  active
                    ? "bg-[#252B3B] text-white font-semibold"
                    : "bg-[#161A23] hover:bg-[#1C212C] text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">{pl.title}</span>
                  {active && <Check size={11} />}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{pl.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Mirror Edge vs Solid Color */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#161A23] rounded-md text-xs">
          <button
            type="button"
            onClick={() => setBleedModule((prev) => ({ ...prev, enabled: true, mode: "mirror" }))}
            className={`py-1.5 rounded font-medium transition-colors cursor-pointer ${
              bleedModule.mode === "mirror"
                ? "bg-[#252B3B] text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Mirror edge pixels of the page into the bleed zone"
          >
            Mirror
          </button>
          <button
            type="button"
            onClick={() => setBleedModule((prev) => ({ ...prev, enabled: true, mode: "solid" }))}
            className={`py-1.5 rounded font-medium transition-colors cursor-pointer ${
              bleedModule.mode === "solid"
                ? "bg-[#252B3B] text-white font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Fill bleed zone with a solid color"
          >
            Solid
          </button>
        </div>

        {/* Solid Color Picker + Eyedropper */}
        {bleedModule.mode === "solid" && (
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="text-slate-400">Color</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="color"
                value={bleedModule.solidColor || "#ffffff"}
                onChange={(e) => setBleedModule((prev) => ({ ...prev, enabled: true, solidColor: e.target.value }))}
                className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                title="Choose solid bleed color"
              />
              <button
                type="button"
                onClick={handleNativeEyedropper}
                className="p-1 rounded hover:bg-[#1C212C] text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={`Pick color directly from page (${shortcutLabels.eyedropper || "I"})`}
              >
                <Pipette size={13} />
              </button>
              <span className="font-mono text-[10px] text-slate-300 uppercase">
                {(bleedModule.solidColor || "#ffffff").slice(0, 7)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Bleed Width & Quick Presets */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Width
        </span>

        <div
          className="flex items-center justify-between gap-2 text-xs"
          title="Set bleed width"
        >
          <span className="text-slate-400">Margin</span>
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
                  setBleedModule((prev) => ({ ...prev, enabled: true, bleedMm: Math.round(mmVal * 10) / 10 }));
                }
              }}
              onBlur={commitBleedInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitBleedInput();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-20 bg-[#161A23] text-slate-100 font-mono font-semibold text-xs px-2 py-1 rounded text-right outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-slate-400 font-mono text-xs min-w-[20px]">{unitShort}</span>
          </div>
        </div>

        {/* 1-Click Standard Prepress Presets */}
        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          {BLEED_PRESETS_MM.map((mm) => {
            const active = Math.abs(bleedModule.bleedMm - mm) < 0.05;
            return (
              <button
                key={mm}
                type="button"
                onClick={() => setBleedModule((prev) => ({ ...prev, enabled: true, bleedMm: mm }))}
                className={`py-1 rounded transition-colors cursor-pointer ${
                  active
                    ? "bg-[#252B3B] font-semibold text-white"
                    : "bg-[#161A23] text-slate-400 hover:text-slate-200"
                }`}
                title={`Set bleed width to ${mm} mm`}
              >
                {mmToUnit(mm, unit)} {unitShort}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Trim Marks & Commit */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Marks & Scope
        </span>

        <div className="flex items-center justify-between gap-2 py-1">
          <label
            className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300"
            title="Draws vector corner cut marks indicating trim boundaries"
          >
            <input
              type="checkbox"
              checked={bleedModule.showCropMarks}
              onChange={(e) => setBleedModule((prev) => ({ ...prev, enabled: true, showCropMarks: e.target.checked }))}
              className="rounded accent-blue-600"
            />
            <span>Crop Marks</span>
          </label>

          <div className="flex items-center space-x-1.5" title="Output rasterization resolution when exporting PDF">
            <span className="text-xs text-slate-400">DPI</span>
            <select
              value={bleedModule.exportDpi}
              onChange={(e) => setBleedModule((prev) => ({ ...prev, exportDpi: parseInt(e.target.value, 10) }))}
              className="bg-[#161A23] text-slate-200 text-xs font-mono px-2 py-1 rounded outline-none cursor-pointer"
            >
              <option value="150">150</option>
              <option value="200">200</option>
              <option value="300">300</option>
            </select>
          </div>
        </div>

        <PageScopeSelector
          scope={bleedModule.scope}
          onChange={(sc) => setBleedModule((prev) => ({ ...prev, scope: sc }))}
          activePageNum={activePageNum}
        />

        {/* Apply / Update Bleed Button */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleApplyBleed}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-100 hover:bg-white text-slate-950 font-semibold text-xs rounded-md transition-all cursor-pointer"
            title={`Commit bleed to ${formatScopeLabel(bleedModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{`Apply (${formatScopeLabel(bleedModule.scope, activePageNum)})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setBleedModule((prev) => ({ ...prev, bleedMm: 0 }))}
            className="px-3 py-2 bg-[#161A23] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center space-x-1"
            title="Reset bleed to 0mm"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
