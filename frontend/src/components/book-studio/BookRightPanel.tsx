"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, ArrowLeft, ArrowUpRight, Eraser } from "lucide-react";
import {
  IconImposingStudio,
  IconFlipbookStudio,
  IconToolCropSplit,
  IconToolDeskew,
  IconToolCleanup,
  IconToolBleed,
} from "@/components/shared/StudioIcons";
import {
  DeskewModuleConfig,
  CleanupModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  CleanupColorMode,
  FocusedModuleId,
  BookStudioPage,
  ModuleTaskProgress,
} from "@/types/book_studio";
import { LengthUnit, mmToUnit, UNIT_OPTIONS } from "@/lib/units";
import { CropSplitPanel } from "./modules/CropSplitPanel";
import { DeskewPanel } from "./modules/DeskewPanel";
import { BleedPanel } from "./modules/BleedPanel";
import { CleanupPanel, RestorePanel } from "./modules/RestorePanel";
import { ModuleProgressBar } from "./modules/PageScopeSelector";

interface BookRightPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  detectAllCrops?: () => Promise<void>;
  pageCropsCount?: number;
  hasActivePageDraftCrop?: boolean;
  clearPageCrops?: () => void;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  removeAppliedCrop?: (id: string) => Promise<void> | void;
  removeAllAppliedCrops?: () => Promise<void> | void;
  pages: BookStudioPage[];
  deskewModule: DeskewModuleConfig;
  setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  clearAllDeskewAngles?: () => void;
  cleanupModule: CleanupModuleConfig;
  setCleanupModule: React.Dispatch<React.SetStateAction<CleanupModuleConfig>>;
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  maskToolActive?: boolean;
  onToggleMaskTool?: () => void;
  onActivateMaskEyedropper?: () => void;
  onClearPageMasks?: () => void;
  onClearAllMasks?: () => void;
  pageColorMode?: CleanupColorMode | null;
  onSetPageColorMode?: (mode: CleanupColorMode | null, clearAll?: boolean) => void;
  focusedModule: FocusedModuleId | null;
  onFocusModule?: (mod: FocusedModuleId | null) => void;
  isDetectingAngle?: boolean;
  detectedAngle?: number | null;
  detectPageAngle?: (pageId?: string) => Promise<number | null>;
  detectAllPageAngles?: () => Promise<Record<string, number> | null>;
  pageDeskewAngle?: number | null;
  onChangePageAngle?: (angle: number) => void;
  straightenActive?: boolean;
  onToggleStraighten?: () => void;
  deskewedPagesCount?: number;
  cropProgress?: ModuleTaskProgress;
  deskewProgress?: ModuleTaskProgress;
  cleanupProgress?: ModuleTaskProgress;
  bleedProgress?: ModuleTaskProgress;
  restoreProgress?: ModuleTaskProgress;
  selectedPageId?: string | null;
  sessionId: string | null;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  onCollapse?: () => void;
  shortcutLabels?: Record<string, string>;
}

export function BookRightPanel({
  cropModule,
  setCropModule,
  isDetectingCrop,
  detectCrop,
  detectAllCrops,
  pageCropsCount = 0,
  hasActivePageDraftCrop = false,
  clearPageCrops,
  splitSpread,
  revertSpread,
  applyCrop,
  removeAppliedCrop,
  removeAllAppliedCrops,
  pages,
  deskewModule,
  setDeskewModule,
  clearAllDeskewAngles,
  cleanupModule,
  setCleanupModule,
  bleedModule,
  setBleedModule,
  restorationModule,
  setRestorationModule,
  maskToolActive = false,
  onToggleMaskTool,
  onActivateMaskEyedropper,
  onClearPageMasks,
  onClearAllMasks,
  pageColorMode = null,
  onSetPageColorMode,
  focusedModule = null,
  onFocusModule,
  isDetectingAngle,
  detectedAngle,
  detectPageAngle,
  detectAllPageAngles,
  pageDeskewAngle,
  onChangePageAngle,
  straightenActive,
  onToggleStraighten,
  deskewedPagesCount = 0,
  cropProgress,
  deskewProgress,
  cleanupProgress,
  bleedProgress,
  restoreProgress,
  selectedPageId,
  sessionId,
  unit = "mm",
  onActivateEyedropper,
  onCollapse,
  shortcutLabels = {},
}: BookRightPanelProps) {
  const activeIdx = selectedPageId ? pages.findIndex((p) => p.id === selectedPageId) : -1;
  const activePageNum = activeIdx >= 0 ? activeIdx + 1 : 1;
  const activePage = activeIdx >= 0 ? pages[activeIdx] : undefined;
  const pageMasksCount = activePage?.masks?.length ?? 0;
  const totalMasksCount = pages.reduce((acc, p) => acc + (p.masks?.length ?? 0), 0);
  const colorOverridePagesCount = pages.filter((p) => Boolean(p.color_mode)).length;
  const unitShort = UNIT_OPTIONS.find((o) => o.value === unit)?.short || "mm";

  // Build concise live summaries for the Hub Cards
  const cropSummary = (() => {
    const parts: string[] = [];
    if (cropModule.splitLines.length > 0) {
      parts.push(`${cropModule.splitLines.length} cut${cropModule.splitLines.length > 1 ? "s" : ""}`);
    }
    if (pageCropsCount > 0) {
      parts.push(`${pageCropsCount}p ready`);
    }
    parts.push((cropModule.detectMode || "paper") === "content" ? "Tight Content" : "Paper Sheet");
    return parts.join(" • ");
  })();

  const deskewSummary = (() => {
    const parts: string[] = [];
    if (deskewedPagesCount > 0) {
      parts.push(`${deskewedPagesCount}p straightened`);
    }
    const effAngle =
      pageDeskewAngle !== null && pageDeskewAngle !== undefined
        ? pageDeskewAngle
        : detectedAngle !== null && detectedAngle !== undefined
          ? detectedAngle
          : deskewModule.angle;
    if (Math.abs(effAngle) > 0.01) {
      parts.push(`Page ${effAngle > 0 ? "+" : ""}${effAngle.toFixed(2)}°`);
    }
    if (parts.length === 0) {
      parts.push(`Auto (±${deskewModule.maxAngle}°) & Ruler`);
    }
    return parts.join(" • ");
  })();

  const cleanupSummary = (() => {
    const parts: string[] = [];
    if (totalMasksCount > 0) parts.push(`${totalMasksCount} box${totalMasksCount > 1 ? "es" : ""}`);
    if (cleanupModule.flattenIllumination) parts.push("Spine");
    if (cleanupModule.despeckleLevel > 0) parts.push(`Despeckle L${cleanupModule.despeckleLevel}`);
    return parts.length > 0 ? parts.join(" • ") : "Erase & clean";
  })();

  const restoreSummary = (() => {
    const modeMap: Record<CleanupColorMode, string> = {
      auto: "Auto",
      color: "Color",
      grayscale: "Gray",
      bw: `B&W (${restorationModule.bwThreshold ?? 180})`,
    };
    const parts: string[] = [modeMap[restorationModule.colorMode || "auto"]];
    if (restorationModule.whitenBg) parts.push("Whiten BG");
    if (colorOverridePagesCount > 0) parts.push(`${colorOverridePagesCount}p`);
    return parts.join(" • ");
  })();

  const bleedSummary = (() => {
    if (bleedModule.bleedMm <= 0 && (!bleedModule.appliedBleeds || bleedModule.appliedBleeds.length === 0)) {
      return "Bleed & marks";
    }
    const pl = (bleedModule.placement || "outside") === "inside" ? "Inside" : "Outside";
    const md = bleedModule.mode === "solid" ? "Solid" : "Mirror";
    return `${pl} ${mmToUnit(bleedModule.bleedMm, unit)}${unitShort} • ${md}`;
  })();

  const moduleShortcuts: Record<FocusedModuleId, string> = {
    crop: shortcutLabels.module_crop || "1",
    deskew: shortcutLabels.module_deskew || "2",
    cleanup: shortcutLabels.module_cleanup || "3",
    restore: shortcutLabels.module_restore || "4",
    bleed: shortcutLabels.module_bleed || "5",
  };

  const moduleDescriptors: {
    id: FocusedModuleId;
    shortcut: string;
    title: string;
    summary: string;
    enabled: boolean;
    onToggleEnabled: (next: boolean) => void;
    icon: React.ReactNode;
    badge?: string | null;
    progress?: ModuleTaskProgress;
  }[] = [
    {
      id: "crop",
      shortcut: moduleShortcuts.crop,
      title: "Crop & Split",
      summary: cropSummary,
      enabled: cropModule.enabled,
      onToggleEnabled: (next) => setCropModule((p) => ({ ...p, enabled: next })),
      icon: <IconToolCropSplit size={16} />,
      badge: pageCropsCount > 0 ? `${pageCropsCount}p` : cropModule.splitLines.length > 0 ? `${cropModule.splitLines.length} cut` : null,
      progress: cropProgress,
    },
    {
      id: "deskew",
      shortcut: moduleShortcuts.deskew,
      title: "Deskew",
      summary: deskewSummary,
      enabled: deskewModule.enabled,
      onToggleEnabled: (next) => setDeskewModule((p) => ({ ...p, enabled: next })),
      icon: <IconToolDeskew size={16} />,
      badge: deskewedPagesCount > 0 ? `${deskewedPagesCount}p` : null,
      progress: deskewProgress,
    },
    {
      id: "cleanup",
      shortcut: moduleShortcuts.cleanup,
      title: "Cleanup",
      summary: cleanupSummary,
      enabled: cleanupModule.enabled,
      onToggleEnabled: (next) => setCleanupModule((p) => ({ ...p, enabled: next })),
      icon: <Eraser size={16} />,
      badge: totalMasksCount > 0 ? `${totalMasksCount}` : null,
      progress: cleanupProgress,
    },
    {
      id: "restore",
      shortcut: moduleShortcuts.restore,
      title: "Colors",
      summary: restoreSummary,
      enabled: restorationModule.enabled,
      onToggleEnabled: (next) => setRestorationModule((p) => ({ ...p, enabled: next })),
      icon: <IconToolCleanup size={16} />,
      badge: colorOverridePagesCount > 0 ? `${colorOverridePagesCount}p` : null,
      progress: restoreProgress,
    },
    {
      id: "bleed",
      shortcut: moduleShortcuts.bleed,
      title: "Bleed",
      summary: bleedSummary,
      enabled: bleedModule.enabled,
      onToggleEnabled: (next) => setBleedModule((p) => ({ ...p, enabled: next })),
      icon: <IconToolBleed size={16} />,
      badge:
        bleedModule.appliedBleeds && bleedModule.appliedBleeds.length > 0
          ? `${bleedModule.appliedBleeds.length}`
          : null,
      progress: bleedProgress,
    },
  ];

  const activeLayerCount = moduleDescriptors.filter((m) => m.enabled).length;

  // ---------------------------------------------------------------------------
  // VIEW 1: MODULES HUB (Overview of all 5 modules as rich button cards)
  // ---------------------------------------------------------------------------
  if (focusedModule === null) {
    return (
      <div className="flex flex-col space-y-2.5 pb-2 select-none">
        {/* Hub Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Prepress Modules
            </span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface-inset,#131720)] border border-[var(--border-subtle,#242A38)] text-slate-300"
              title="Number of active processing layers"
            >
              <strong style={{ color: "var(--app-accent-text, var(--app-accent, #f59e0b))" }}>
                {activeLayerCount}
              </strong>{" "}
              Active
            </span>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Collapse Controls Panel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* 5 Rich Module Button Cards */}
        <div className="space-y-2">
          {moduleDescriptors.map((mod) => (
            <div
              key={mod.id}
              onClick={() => onFocusModule?.(mod.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocusModule?.(mod.id);
                }
              }}
              className={`group rounded-xl border p-2.5 transition-all cursor-pointer ${
                mod.enabled
                  ? "bg-[var(--surface-card,#181D27)] border-[var(--border-strong,#333D52)] hover:border-amber-500/60 shadow-2xs"
                  : "bg-[var(--surface-card,#181D27)]/80 border-[var(--border-subtle,#242A38)] hover:border-slate-600"
              }`}
              title={`Open ${mod.title} options (${mod.shortcut})`}
            >
              <div className="flex items-center justify-between gap-2.5">
                {/* Left Icon */}
                <div
                  className={`p-2 rounded-lg border transition-colors shrink-0 ${
                    mod.enabled
                      ? "bg-[var(--surface-inset,#131720)] border-amber-500/30"
                      : "bg-[var(--surface-inset,#131720)] border-[var(--border-subtle,#242A38)] text-slate-400 group-hover:text-slate-200"
                  }`}
                  style={mod.enabled ? { color: "var(--app-accent, #f59e0b)" } : undefined}
                >
                  {mod.icon}
                </div>

                {/* Center Title & Live Summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary,#f1f5f9)] truncate">
                      {mod.title}
                    </span>
                    {mod.badge && (
                      <span
                        className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0"
                      >
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{mod.summary}</p>
                </div>

                {/* Right: Inline Layer Toggle + Drill-In Chevron */}
                <div
                  className="flex items-center space-x-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label
                    className="relative inline-flex items-center cursor-pointer"
                    title={`Toggle ${mod.title} Layer ON/OFF`}
                  >
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      onChange={(e) => mod.onToggleEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
                      style={mod.enabled ? { backgroundColor: "var(--app-accent, #f59e0b)" } : undefined}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onFocusModule?.(mod.id)}
                    className="p-0.5 text-slate-500 group-hover:text-slate-200 transition-colors cursor-pointer"
                    title={`Configure ${mod.title}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <ModuleProgressBar task={mod.progress} />
            </div>
          ))}
        </div>

        {/* Compact Studio Handoff Links */}
        <div className="pt-1 flex items-center gap-1.5">
          <Link
            href="/imposing"
            className="flex-1 flex items-center justify-between px-2.5 py-2 rounded-xl bg-[var(--surface-card,#181D27)] hover:bg-[#1E2432] border border-[var(--border-subtle,#242A38)] hover:border-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-[11px]"
            title="Open Imposing Studio for Booklet Signatures & Gang Nesting"
          >
            <span className="flex items-center space-x-1.5 truncate">
              <IconImposingStudio size={13} className="shrink-0" style={{ color: "var(--app-accent, #f59e0b)" }} />
              <span className="truncate font-medium">Imposing</span>
            </span>
            <ArrowUpRight size={11} className="text-slate-500 shrink-0" />
          </Link>
          <Link
            href="/flipbook"
            className="flex-1 flex items-center justify-between px-2.5 py-2 rounded-xl bg-[var(--surface-card,#181D27)] hover:bg-[#1E2432] border border-[var(--border-subtle,#242A38)] hover:border-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-[11px]"
            title="Open 3D Flipbook Studio for Interactive Proofing"
          >
            <span className="flex items-center space-x-1.5 truncate">
              <IconFlipbookStudio size={13} className="shrink-0" style={{ color: "var(--app-accent, #f59e0b)" }} />
              <span className="truncate font-medium">3D Flipbook</span>
            </span>
            <ArrowUpRight size={11} className="text-slate-500 shrink-0" />
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: DEDICATED MODULE WORKSPACE (Back Button + Quick-Jump Bar + Options)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col space-y-2.5 pb-2 select-none">
      {/* Top Navigation Bar: Back to Hub + 5-Icon Quick-Jump Bar */}
      <div className="flex items-center justify-between gap-1.5 p-1 rounded-xl bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242A38)]">
        <button
          type="button"
          onClick={() => onFocusModule?.(null)}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-[var(--text-primary,#e2e8f0)] hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title={`Return to All Modules (${shortcutLabels.exit_module || "Esc"})`}
        >
          <ArrowLeft size={13} style={{ color: "var(--app-accent, #f59e0b)" }} />
          <span>All Modules</span>
        </button>

        <div className="flex items-center space-x-1">
          {/* 5-Icon Quick-Jump Strip */}
          <div className="flex items-center bg-[var(--surface-inset,#131720)] p-0.5 rounded-lg border border-[var(--border-subtle,#242A38)]">
            {moduleDescriptors.map((mod) => {
              const isCurrent = focusedModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onFocusModule?.(mod.id)}
                  className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  style={isCurrent ? { color: "var(--app-accent, #f59e0b)" } : undefined}
                  title={`Jump to ${mod.title} (${mod.shortcut})`}
                >
                  {React.cloneElement(mod.icon as React.ReactElement<{ size?: number }>, { size: 13 })}
                  {mod.enabled && (
                    <span
                      className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--app-accent, #f59e0b)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Collapse Controls Panel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Active Module Workspace */}
      {focusedModule === "crop" && (
        <CropSplitPanel
          cropModule={cropModule}
          setCropModule={setCropModule}
          isDetectingCrop={isDetectingCrop}
          detectCrop={detectCrop}
          detectAllCrops={detectAllCrops}
          pageCropsCount={pageCropsCount}
          hasActivePageDraftCrop={hasActivePageDraftCrop}
          clearPageCrops={clearPageCrops}
          splitSpread={splitSpread}
          revertSpread={revertSpread}
          applyCrop={applyCrop}
          removeAppliedCrop={removeAppliedCrop}
          removeAllAppliedCrops={removeAllAppliedCrops}
          taskProgress={cropProgress}
          selectedPageId={selectedPageId}
          sessionId={sessionId}
          pages={pages}
          activePageNum={activePageNum}
          shortcutLabels={shortcutLabels}
        />
      )}

      {focusedModule === "deskew" && (
        <DeskewPanel
          deskewModule={deskewModule}
          setDeskewModule={setDeskewModule}
          isDetectingAngle={isDetectingAngle}
          detectedAngle={detectedAngle}
          detectPageAngle={detectPageAngle}
          detectAllPageAngles={detectAllPageAngles}
          pageDeskewAngle={pageDeskewAngle}
          onChangePageAngle={onChangePageAngle}
          onClearAllAngles={clearAllDeskewAngles}
          straightenActive={straightenActive}
          onToggleStraighten={onToggleStraighten}
          deskewedPagesCount={deskewedPagesCount}
          taskProgress={deskewProgress}
          selectedPageId={selectedPageId}
          sessionId={sessionId}
          pages={pages}
          activePageNum={activePageNum}
          shortcutLabels={shortcutLabels}
        />
      )}

      {focusedModule === "cleanup" && (
        <CleanupPanel
          cleanupModule={cleanupModule}
          setCleanupModule={setCleanupModule}
          maskToolActive={maskToolActive}
          onToggleMaskTool={() => onToggleMaskTool?.()}
          onActivateMaskEyedropper={onActivateMaskEyedropper}
          pageMasksCount={pageMasksCount}
          totalMasksCount={totalMasksCount}
          onClearPageMasks={() => onClearPageMasks?.()}
          onClearAllMasks={() => onClearAllMasks?.()}
          taskProgress={cleanupProgress}
          pages={pages}
          selectedPageId={selectedPageId}
          activePageNum={activePageNum}
          shortcutLabels={shortcutLabels}
        />
      )}

      {focusedModule === "restore" && (
        <RestorePanel
          restorationModule={restorationModule}
          setRestorationModule={setRestorationModule}
          pageColorMode={pageColorMode}
          onSetPageColorMode={onSetPageColorMode}
          colorOverridePagesCount={colorOverridePagesCount}
          taskProgress={restoreProgress}
          pages={pages}
          selectedPageId={selectedPageId}
          activePageNum={activePageNum}
          shortcutLabels={shortcutLabels}
        />
      )}

      {focusedModule === "bleed" && (
        <BleedPanel
          bleedModule={bleedModule}
          setBleedModule={setBleedModule}
          taskProgress={bleedProgress}
          unit={unit}
          onActivateEyedropper={onActivateEyedropper}
          pages={pages}
          selectedPageId={selectedPageId}
          activePageNum={activePageNum}
          shortcutLabels={shortcutLabels}
        />
      )}
    </div>
  );
}
