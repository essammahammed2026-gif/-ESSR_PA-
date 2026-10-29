"use client";

import React, { useMemo } from "react";
import { Square, Pipette } from "lucide-react";
import {
  CleanupModuleConfig,
  ModuleTaskProgress,
  BookStudioPage,
  CropBox,
  MaskBox,
} from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, formatScopeLabel } from "./PageScopeSelector";
import { resolveConcretePageNumbers } from "@/lib/pageScope";

export interface CleanupPanelProps {
  cleanupModule: CleanupModuleConfig;
  setCleanupModule: React.Dispatch<React.SetStateAction<CleanupModuleConfig>>;
  maskToolActive: boolean;
  onToggleMaskTool: () => void;
  onActivateMaskEyedropper?: () => void;
  pageMasksCount: number;
  totalMasksCount: number;
  onClearPageMasks?: (targetIds?: string[]) => void;
  onClearAllMasks?: () => void;
  applyMaskBox?: (box: CropBox, selectedPageIds?: string[], customColor?: string, existingMaskId?: string) => Promise<MaskBox | undefined>;
  removeMaskBox?: (maskId: string) => Promise<void>;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  shortcutLabels?: Record<string, string>;
}

export function CleanupPanel({
  cleanupModule,
  setCleanupModule,
  maskToolActive,
  onToggleMaskTool,
  onActivateMaskEyedropper,
  pageMasksCount,
  totalMasksCount,
  applyMaskBox,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  shortcutLabels = {},
}: CleanupPanelProps) {
  const activePage = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    if (selectedPageId) return pages.find((p) => p.id === selectedPageId) || pages[0];
    return pages[0];
  }, [pages, selectedPageId]);

  const handleNativeMaskEyedropper = async () => {
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setCleanupModule((prev) => ({ ...prev, maskColor: result.sRGBHex }));
          return;
        }
      } catch {
        // Fallback to canvas click sampling
      }
    }
    if (onActivateMaskEyedropper) {
      onActivateMaskEyedropper();
    }
  };

  const handleApply = async () => {
    const concrete = resolveConcretePageNumbers(pages, cleanupModule.scope, selectedPageId);
    const hasDraftMask = Boolean(cleanupModule.draftMaskBox);

    // 1. If draft mask box is active (new box or editing box)
    if (hasDraftMask && cleanupModule.draftMaskBox) {
      const draftBox = cleanupModule.draftMaskBox;
      if (applyMaskBox) {
        await applyMaskBox(
          draftBox,
          concrete.pageIds,
          cleanupModule.maskColor,
          draftBox.id
        );
      }

      setCleanupModule((prev) => ({
        ...prev,
        enabled: true,
        draftMaskBox: null,
      }));
      return;
    }

    // 2. Filter-only commit (Spine Shadow / Despeckle)
    setCleanupModule((prev) => ({
      ...prev,
      enabled: true,
    }));
  };

  return (
    <div className="space-y-5 select-none">
      <ModuleProgressBar task={taskProgress} />

      {/* Section 1: Spot Erase / Whiteout Box */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Erase Box
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Page: <strong className="text-slate-200">{pageMasksCount}</strong> • All:{" "}
            <strong className="text-slate-200">{totalMasksCount}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMaskTool}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
            maskToolActive
              ? "bg-blue-600 text-white font-semibold"
              : "bg-[#161A23] hover:bg-[#1C212C] text-slate-200"
          }`}
          title={`Drag a rectangle on the canvas to mask out scanner fingers, staples, or punch holes (${shortcutLabels.mask_tool || "M"})`}
        >
          <Square size={13} className="stroke-[2.2]" />
          <span>{maskToolActive ? "Drag on Canvas..." : "Draw Box"}</span>
        </button>

        {/* Fill Color Picker */}
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="text-slate-400">Fill Color</span>
          <div className="flex items-center space-x-1.5">
            <input
              type="color"
              value={cleanupModule.maskColor || "#ffffff"}
              onChange={(e) =>
                setCleanupModule((prev) => ({
                  ...prev,
                  maskColor: e.target.value,
                  draftMaskBox: prev.draftMaskBox
                    ? { ...prev.draftMaskBox, color: e.target.value }
                    : prev.draftMaskBox,
                }))
              }
              className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer p-0"
              title="Choose erase box fill color (Default: #FFFFFF)"
            />
            {onActivateMaskEyedropper && (
              <button
                type="button"
                onClick={handleNativeMaskEyedropper}
                className="p-1 rounded hover:bg-[#1C212C] text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={`Sample paper color directly from page (${shortcutLabels.eyedropper || "I"})`}
              >
                <Pipette size={13} />
              </button>
            )}
            <span className="font-mono text-[10px] text-slate-300 uppercase">
              {(cleanupModule.maskColor || "#ffffff").slice(0, 7)}
            </span>
            {(cleanupModule.maskColor || "#ffffff").toLowerCase() !== "#ffffff" && (
              <button
                type="button"
                onClick={() =>
                  setCleanupModule((prev) => ({
                    ...prev,
                    maskColor: "#ffffff",
                    draftMaskBox: prev.draftMaskBox
                      ? { ...prev.draftMaskBox, color: "#ffffff" }
                      : prev.draftMaskBox,
                  }))
                }
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer ml-1"
                title="Reset fill color to pure white (#FFFFFF)"
              >
                White
              </button>
            )}
          </div>
        </div>

        {/* Draft Mask Active Badge */}
        {cleanupModule.draftMaskBox && (
          <div className="flex items-center justify-between p-2 rounded-md bg-[#161A23] text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border border-black/30" style={{ backgroundColor: cleanupModule.draftMaskBox.color || cleanupModule.maskColor }} />
              <span className="text-slate-200 font-medium text-[11px]">
                Draft Box Active
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCleanupModule((prev) => ({ ...prev, draftMaskBox: null }));
              }}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Cancel Box
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Background Cleanup (Spine Shadows & Despeckle) */}
      <div className="pt-4 border-t border-[#1E232E] space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Filters
        </span>

        {/* Spine Shadow Toggle & Controls */}
        <div className="space-y-2">
          <label
            className="flex items-center justify-between gap-2 cursor-pointer text-xs"
            title="Morphological background cleanup: flattens dark book-spine gutter shadows and uneven scan lighting"
          >
            <span className="text-slate-300">Spine Shadow</span>
            <input
              type="checkbox"
              checked={cleanupModule.flattenIllumination}
              onChange={(e) =>
                setCleanupModule((prev) => ({ ...prev, enabled: true, flattenIllumination: e.target.checked }))
              }
              className="rounded shrink-0 accent-blue-600"
            />
          </label>

          {cleanupModule.flattenIllumination && (
            <div className="space-y-2 pt-1.5">
              {/* Strength Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Strength</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {Math.round((cleanupModule.spineStrength ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round((cleanupModule.spineStrength ?? 1.0) * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value) / 100;
                    setCleanupModule((prev) => ({ ...prev, enabled: true, spineStrength: val }));
                  }}
                  className="w-full h-1.5 bg-[#161A23] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title="Spine shadow flattening strength (10% to 100%)"
                />
              </div>

              {/* Manual Spine Area Selection */}
              <div className="pt-1 flex items-center justify-between gap-1.5">
                {cleanupModule.spineBox ? (
                  <div className="flex items-center justify-between w-full p-1.5 rounded bg-[#161A23] text-xs">
                    <span className="text-slate-300 font-medium">
                      Spine Box Active
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCleanupModule((prev) => ({ ...prev, spineBox: null, spineSelectionActive: false }))
                      }
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Reset spine region to full-sheet illumination flattening"
                    >
                      Reset Area
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const isLeft = activePage?.half === "left";
                      const isRight = activePage?.half === "right";
                      const defaultBox = isLeft
                        ? { x1: 0.75, y1: 0.0, x2: 1.0, y2: 1.0 }
                        : isRight
                        ? { x1: 0.0, y1: 0.0, x2: 0.25, y2: 1.0 }
                        : { x1: 0.38, y1: 0.0, x2: 0.62, y2: 1.0 };
                      setCleanupModule((prev) => ({
                        ...prev,
                        enabled: true,
                        flattenIllumination: true,
                        spineSelectionActive: true,
                        spineBox: defaultBox,
                      }));
                    }}
                    className="w-full py-1.5 px-2 bg-[#161A23] hover:bg-[#1C212C] text-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                    title="Draw or adjust a targeted spine rectangle on the canvas to isolate gutter shadow"
                  >
                    <span>Select Spine Area</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Continuous Despeckle Slider & Numeric Input */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Despeckle</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[11px] text-slate-300">
                {cleanupModule.despeckleLevel === 0 ? "Off" : cleanupModule.despeckleLevel.toFixed(1)}
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={cleanupModule.despeckleLevel}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(10, parseFloat(e.target.value) || 0));
                  setCleanupModule((prev) => ({ ...prev, enabled: true, despeckleLevel: val }));
                }}
                className="w-12 text-center text-xs font-mono font-semibold bg-[#161A23] rounded px-1 py-0.5 text-slate-200 outline-none"
              />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={cleanupModule.despeckleLevel}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setCleanupModule((prev) => ({ ...prev, enabled: true, despeckleLevel: val }));
            }}
            className="w-full h-1.5 bg-[#161A23] rounded-lg appearance-none cursor-pointer accent-blue-500"
            title="Continuous scanner dust and speckle removal filter (0.0 to 10.0)"
          />
        </div>

        <div className="pt-2">
          <PageScopeSelector
            scope={cleanupModule.scope}
            onChange={(sc) => setCleanupModule((prev) => ({ ...prev, scope: sc }))}
            activePageNum={activePageNum}
          />
        </div>

        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1"
            title={`Apply filters to ${formatScopeLabel(cleanupModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>{`Apply (${formatScopeLabel(cleanupModule.scope, activePageNum)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
