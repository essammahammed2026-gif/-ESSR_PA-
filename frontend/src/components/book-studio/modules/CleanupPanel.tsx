"use client";

import React, { useMemo } from "react";
import { Square, RotateCcw } from "lucide-react";
import {
  CleanupModuleConfig,
  ModuleTaskProgress,
  BookStudioPage,
  CropBox,
  MaskBox,
  ModulePageScope,
} from "@/types/book_studio";
import { PageScopeSelector, ModuleProgressBar, StudioColorPicker, formatScopeLabel } from "./PageScopeSelector";
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
  applyCleanupFilters?: (targetScope?: ModulePageScope) => void;
  resetCleanup?: () => Promise<void> | void;
  taskProgress?: ModuleTaskProgress;
  pages?: BookStudioPage[];
  selectedPageId?: string | null;
  activePageNum?: number;
  isDualPage?: boolean;
  onSelectPageId?: (id: string) => void;
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
  onClearPageMasks,
  onClearAllMasks,
  applyMaskBox,
  applyCleanupFilters,
  resetCleanup,
  taskProgress,
  pages = [],
  selectedPageId,
  activePageNum,
  isDualPage = false,
  onSelectPageId,
  shortcutLabels = {},
}: CleanupPanelProps) {
  const rawIdx = pages && selectedPageId ? pages.findIndex((p) => p.id === selectedPageId) : -1;
  const pairStartIdx = isDualPage && rawIdx >= 0 ? Math.floor(rawIdx / 2) * 2 : rawIdx;
  const leftPageId = (pairStartIdx >= 0 && pages[pairStartIdx]) ? pages[pairStartIdx].id : (selectedPageId ?? pages[0]?.id ?? "");
  const leftPageNum = pairStartIdx >= 0 ? pairStartIdx + 1 : 1;
  const hasRightPage = Boolean(isDualPage && pages && pairStartIdx >= 0 && pairStartIdx + 1 < pages.length);
  const rightPageId = hasRightPage && pages ? pages[pairStartIdx + 1].id : "";
  const rightPageNum = hasRightPage ? leftPageNum + 1 : undefined;

  const isDualActive = Boolean(isDualPage && hasRightPage);
  const isDualLinked = isDualActive && (cleanupModule.scope.dualSides?.length ?? 2) >= 2;
  const activeDualSide = isDualActive && cleanupModule.scope.dualSides?.length === 1
    ? cleanupModule.scope.dualSides[0]
    : null;

  const handleToggleDual = () => {
    if (cleanupModule.scope.mode !== "current") {
      setCleanupModule((prev) => ({
        ...prev,
        scope: { ...prev.scope, mode: "current", dualSides: ["left", "right"] },
      }));
      return;
    }
    if (isDualLinked) {
      if (leftPageId && onSelectPageId) onSelectPageId(leftPageId);
      setCleanupModule((prev) => ({
        ...prev,
        draftMaskBox: prev.pageDraftMasks?.[leftPageId] ?? prev.draftMaskBox,
        spineBox: prev.pageSpineBoxes?.[leftPageId] ?? prev.spineBox,
        scope: { ...prev.scope, dualSides: ["left"] },
      }));
    } else {
      setCleanupModule((prev) => ({
        ...prev,
        scope: { ...prev.scope, dualSides: ["left", "right"] },
      }));
    }
  };

  const activePage = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    if (isDualActive && activeDualSide === "right" && rightPageId) {
      return pages.find((p) => p.id === rightPageId) || pages[0];
    }
    if (isDualActive && leftPageId) {
      return pages.find((p) => p.id === leftPageId) || pages[0];
    }
    if (selectedPageId) return pages.find((p) => p.id === selectedPageId) || pages[0];
    return pages[0];
  }, [pages, selectedPageId, isDualActive, activeDualSide, rightPageId, leftPageId]);

  const handleApply = async () => {
    const concrete = resolveConcretePageNumbers(pages, cleanupModule.scope, selectedPageId);
    const pageDraftEntries = Object.entries(cleanupModule.pageDraftMasks || {});
    const hasDraftMask = Boolean(cleanupModule.draftMaskBox || pageDraftEntries.length > 0);

    // 1. If draft mask box is active (new box or editing box)
    if (hasDraftMask && applyMaskBox) {
      if (!isDualLinked && cleanupModule.scope.mode === "current" && pageDraftEntries.length > 0) {
        for (const [pid, draft] of pageDraftEntries) {
          if (draft) {
            await applyMaskBox(draft, [pid], draft.color || cleanupModule.maskColor, draft.id);
          }
        }
      } else if (cleanupModule.draftMaskBox) {
        const draftBox = cleanupModule.draftMaskBox;
        await applyMaskBox(
          draftBox,
          concrete.pageIds,
          draftBox.color || cleanupModule.maskColor,
          draftBox.id
        );
      }

      setCleanupModule((prev) => ({
        ...prev,
        enabled: true,
        draftMaskBox: null,
        pageDraftMasks: {},
      }));
      return;
    }

    // 2. Filter commit (Spine Shadow / Despeckle)
    if (applyCleanupFilters) {
      applyCleanupFilters(cleanupModule.scope);
    } else {
      setCleanupModule((prev) => ({
        ...prev,
        enabled: true,
      }));
    }
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
          <div className="flex items-center space-x-2 text-[10px]">
            <span className="font-mono text-slate-400">
              Page: <strong className="text-slate-200">{pageMasksCount}</strong> • All:{" "}
              <strong className="text-slate-200">{totalMasksCount}</strong>
            </span>
            {pageMasksCount > 0 && onClearPageMasks && (
              <button
                type="button"
                onClick={() => onClearPageMasks(selectedPageId ? [selectedPageId] : undefined)}
                className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer font-medium"
                title="Clear erase boxes on active page"
              >
                Clear (Page)
              </button>
            )}
            {totalMasksCount > 0 && onClearAllMasks && (
              <button
                type="button"
                onClick={onClearAllMasks}
                className="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer font-medium"
                title="Clear all erase boxes across entire book"
              >
                Clear (All)
              </button>
            )}
          </div>
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

        {/* Universal Single-Row Fill Color Picker */}
        <StudioColorPicker
          label="Fill Color"
          color={cleanupModule.maskColor || "#ffffff"}
          defaultColor="#ffffff"
          onChange={(hex) =>
            setCleanupModule((prev) => ({
              ...prev,
              maskColor: hex,
              draftMaskBox: prev.draftMaskBox
                ? { ...prev.draftMaskBox, color: hex }
                : prev.draftMaskBox,
            }))
          }
          onActivateEyedropper={onActivateMaskEyedropper}
          eyedropperShortcut={shortcutLabels.eyedropper || "I"}
        />

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
              className="rounded shrink-0 cursor-pointer"
              style={{ accentColor: "var(--app-accent, #06b6d4)" }}
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
                  className="w-full h-1.5 bg-[#161A23] rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: "var(--app-accent, #06b6d4)" }}
                  title="Spine shadow flattening strength (10% to 100%)"
                />
              </div>

              {/* Manual Spine Area Selection */}
              <div className="pt-1">
                {cleanupModule.spineBox ? (
                  cleanupModule.spineSelectionActive ? (
                    <div className="flex items-center justify-between w-full p-1.5 rounded bg-[#161A23] text-xs">
                      <span className="text-slate-300 font-medium text-[11px]">
                        Adjusting Spine Area
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCleanupModule((prev) => ({ ...prev, spineSelectionActive: false }))
                          }
                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                          title="Apply spine area selection (hides canvas overlay)"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCleanupModule((prev) => ({
                          ...prev,
                          spineBox: null,
                          pageSpineBoxes: {},
                          spineSelectionActive: false,
                        }))
                          }
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                          title="Reset spine region to full-sheet illumination flattening"
                        >
                          Reset Area
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full p-1.5 rounded bg-[#161A23] text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-slate-300 font-medium text-[11px]">
                          Spine Area Set
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCleanupModule((prev) => ({ ...prev, spineSelectionActive: true }))
                          }
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer font-medium"
                          title="Show spine selection box on canvas to adjust region"
                        >
                          Edit Area
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCleanupModule((prev) => ({
                          ...prev,
                          spineBox: null,
                          pageSpineBoxes: {},
                          spineSelectionActive: false,
                        }))
                          }
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                          title="Reset spine region to full-sheet illumination flattening"
                        >
                          Reset Area
                        </button>
                      </div>
                    </div>
                  )
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
                      setCleanupModule((prev) => {
                        const nextPageSpines = { ...(prev.pageSpineBoxes || {}) };
                        if (isDualLinked) {
                          if (leftPageId) nextPageSpines[leftPageId] = defaultBox;
                          if (rightPageId) nextPageSpines[rightPageId] = defaultBox;
                        } else if (activePage?.id) {
                          nextPageSpines[activePage.id] = defaultBox;
                        }
                        return {
                          ...prev,
                          enabled: true,
                          flattenIllumination: true,
                          spineSelectionActive: true,
                          spineBox: defaultBox,
                          pageSpineBoxes: nextPageSpines,
                        };
                      });
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
            className="w-full h-1.5 bg-[#161A23] rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: "var(--app-accent, #06b6d4)" }}
            title="Continuous scanner dust and speckle removal filter (0.0 to 10.0)"
          />
        </div>

        <div className="pt-2">
          <PageScopeSelector
            scope={cleanupModule.scope}
            onChange={(sc) => setCleanupModule((prev) => ({ ...prev, scope: sc }))}
            activePageNum={activePageNum}
            isDualActive={isDualActive}
            isDualLinked={isDualLinked}
            onToggleDual={handleToggleDual}
            activeDualSide={activeDualSide}
            leftPageNum={leftPageNum}
            rightPageNum={rightPageNum}
          />
        </div>

        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-3 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1"
            title={`Apply filters to ${formatScopeLabel(cleanupModule.scope, activePageNum)} (${shortcutLabels.apply_action || "Enter"})`}
          >
            <span>Apply</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (resetCleanup) {
                void resetCleanup();
              } else {
                onClearAllMasks?.();
                setCleanupModule((prev) => ({
                  ...prev,
                  enabled: false,
                  maskColor: "#ffffff",
                  flattenIllumination: false,
                  spineStrength: 1.0,
                  spineBox: null,
                  pageSpineBoxes: {},
                  spineSelectionActive: false,
                  despeckleLevel: 0,
                  draftMaskBox: null,
                  pageDraftMasks: {},
                  appliedEntries: [],
                }));
              }
            }}
            className="px-3 py-2 bg-[#161A23] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center space-x-1"
            title="Reset all cleanup & erase modifications across the entire document"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
