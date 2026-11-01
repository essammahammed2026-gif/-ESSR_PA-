"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, ArrowLeft, ArrowUpRight, Eraser } from "lucide-react";
import {
  IconImposingStudio,
  IconFlipbookStudio,
  IconToolCropSplit,
  IconSplitVertical,
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
  MaskBox,
  CleanupColorMode,
  FocusedModuleId,
  BookStudioPage,
  ModuleTaskProgress,
  ModulePageScope,
} from "@/types/book_studio";
import { LengthUnit } from "@/lib/units";
import { CropSplitPanel } from "./modules/CropSplitPanel";
import { DeskewPanel } from "./modules/DeskewPanel";
import { BleedPanel } from "./modules/BleedPanel";
import { CleanupPanel } from "./modules/CleanupPanel";
import { RestorePanel } from "./modules/RestorePanel";
import { ModuleProgressBar } from "./modules/PageScopeSelector";

interface BookRightPanelProps {
  cropModule: CropModuleConfig;
  isDualPage?: boolean;
  focusCropPage?: (pageId: string, visibleIds: string[]) => void;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  detectAllCrops?: () => Promise<void>;
  pageCropsCount?: number;
  hasActivePageDraftCrop?: boolean;
  clearPageCrops?: () => void;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  revertSplitLevel?: (pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  revertCropLevel?: (scopeMode?: "current" | "all") => Promise<void> | void;
  resetCrop?: (scopeMode?: "current" | "all") => Promise<void> | void;
  resetDeskew?: (scopeMode?: "current" | "all") => Promise<void> | void;
  resetCleanup?: () => Promise<void> | void;
  resetRestoration?: () => Promise<void> | void;
  resetBleed?: () => void;
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
  onClearPageMasks?: (targetIds?: string[]) => void;
  onClearAllMasks?: () => void;
  applyMaskBox?: (box: CropBox, selectedPageIds?: string[], customColor?: string, existingMaskId?: string) => Promise<MaskBox | undefined>;
  removeMaskBox?: (maskId: string) => Promise<void>;
  applyCleanupFilters?: (targetScope?: ModulePageScope) => void;
  pageColorMode?: CleanupColorMode | null;
  onSetPageColorMode?: (mode: CleanupColorMode | null, targetIds?: string[], clearAll?: boolean) => void;
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
  onSelectPageId?: (id: string) => void;
  onRecordDeskewHistory?: (label: string, nextDeskew: DeskewModuleConfig) => void;
  onRecordBleedHistory?: (label: string, nextBleed: BleedModuleConfig) => void;
  onRecordRestorationHistory?: (label: string, nextRestore: RestorationModuleConfig) => void;
  sessionId: string | null;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  onCollapse?: () => void;
  shortcutLabels?: Record<string, string>;
}

export function BookRightPanel({
  cropModule,
  setCropModule,
  isDualPage,
  focusCropPage,
  isDetectingCrop,
  detectCrop,
  detectAllCrops,
  pageCropsCount = 0,
  hasActivePageDraftCrop = false,
  clearPageCrops,
  splitSpread,
  revertSpread,
  revertSplitLevel,
  applyCrop,
  revertCropLevel,
  resetCrop,
  resetDeskew,
  resetCleanup,
  resetRestoration,
  resetBleed,
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
  applyMaskBox,
  removeMaskBox,
  applyCleanupFilters,
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
  onSelectPageId,
  onRecordDeskewHistory,
  onRecordBleedHistory,
  onRecordRestorationHistory,
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

  const moduleShortcuts: Record<FocusedModuleId, string> = {
    crop: shortcutLabels.module_crop || "1",
    split: shortcutLabels.add_cut || "X",
    deskew: shortcutLabels.module_deskew || "2",
    cleanup: shortcutLabels.module_cleanup || "3",
    restore: shortcutLabels.module_restore || "4",
    bleed: shortcutLabels.module_bleed || "5",
  };

  const moduleDescriptors: {
    id: FocusedModuleId;
    shortcut: string;
    title: string;
    icon: React.ReactNode;
    progress?: ModuleTaskProgress;
  }[] = [
    {
      id: "crop",
      shortcut: moduleShortcuts.crop,
      title: "Crop",
      icon: <IconToolCropSplit size={15} />,
      progress: cropProgress,
    },
    {
      id: "split",
      shortcut: moduleShortcuts.split,
      title: "Split",
      icon: <IconSplitVertical size={15} />,
      progress: cropProgress,
    },
    {
      id: "deskew",
      shortcut: moduleShortcuts.deskew,
      title: "Deskew",
      icon: <IconToolDeskew size={15} />,
      progress: deskewProgress,
    },
    {
      id: "cleanup",
      shortcut: moduleShortcuts.cleanup,
      title: "Cleanup & Erase",
      icon: <Eraser size={15} />,
      progress: cleanupProgress,
    },
    {
      id: "restore",
      shortcut: moduleShortcuts.restore,
      title: "Colors & Tone",
      icon: <IconToolCleanup size={15} />,
      progress: restoreProgress,
    },
    {
      id: "bleed",
      shortcut: moduleShortcuts.bleed,
      title: "Print Bleed",
      icon: <IconToolBleed size={15} />,
      progress: bleedProgress,
    },
  ];

  // ---------------------------------------------------------------------------
  // VIEW 1: SIMPLE COLUMN FIELD WITH TOOL NAMES (No borders, no card boxes)
  // ---------------------------------------------------------------------------
  if (focusedModule === null) {
    return (
      <div className="flex flex-col h-full select-none">
        {/* Top Header */}
        <div className="h-10 px-4 border-b border-[#1E232E] flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-100">PDF Tools</span>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Collapse Tools Panel"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Simple Flat Tool List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Prepress Tools
            </div>
            <div className="space-y-0.5">
              {moduleDescriptors.map((mod) => (
                <div key={mod.id}>
                  <button
                    type="button"
                    onClick={() => onFocusModule?.(mod.id)}
                    className="w-full flex items-center space-x-3 px-2.5 py-2 rounded-md text-slate-300 hover:text-white hover:bg-[#191D26] transition-colors text-left cursor-pointer group"
                    title={`Open ${mod.title} (${mod.shortcut})`}
                  >
                    <span className="text-slate-400 group-hover:text-slate-200 shrink-0">
                      {mod.icon}
                    </span>
                    <span className="text-xs font-medium truncate flex-1">{mod.title}</span>
                  </button>
                  <ModuleProgressBar task={mod.progress} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Workflow Handoff
            </div>
            <div className="space-y-0.5">
              <Link
                href="/imposing"
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-slate-300 hover:text-white hover:bg-[#191D26] transition-colors text-xs group"
                title="Open Imposing Studio for Booklet Signatures & Gang Nesting"
              >
                <span className="flex items-center space-x-3 truncate">
                  <IconImposingStudio size={15} className="text-slate-400 group-hover:text-slate-200 shrink-0" />
                  <span className="truncate font-medium">Imposing Studio</span>
                </span>
                <ArrowUpRight size={13} className="text-slate-500 group-hover:text-slate-300 shrink-0" />
              </Link>
              <Link
                href="/flipbook"
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-slate-300 hover:text-white hover:bg-[#191D26] transition-colors text-xs group"
                title="Open 3D Flipbook Studio for Interactive Proofing"
              >
                <span className="flex items-center space-x-3 truncate">
                  <IconFlipbookStudio size={15} className="text-slate-400 group-hover:text-slate-200 shrink-0" />
                  <span className="truncate font-medium">3D Flipbook</span>
                </span>
                <ArrowUpRight size={13} className="text-slate-500 group-hover:text-slate-300 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeDescriptor = moduleDescriptors.find((m) => m.id === focusedModule);

  // ---------------------------------------------------------------------------
  // VIEW 2: OPENED TOOL OPTIONS (Clean borderless header + options)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Header: Back to Tools */}
      <div className="h-10 px-3 border-b border-[#1E232E] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => onFocusModule?.(null)}
          className="flex items-center space-x-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
          title={`Return to Tools (${shortcutLabels.exit_module || "Esc"})`}
        >
          <ArrowLeft size={14} className="text-slate-400" />
          <span>{activeDescriptor?.title || "Tool Options"}</span>
        </button>

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            title="Collapse Tools Panel"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Active Tool Options Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {(focusedModule === "crop" || focusedModule === "split") && (
          <CropSplitPanel
            mode={focusedModule}
            cropModule={cropModule}
            isDualPage={isDualPage}
            focusCropPage={focusCropPage}
            setCropModule={setCropModule}
            isDetectingCrop={isDetectingCrop}
            detectCrop={detectCrop}
            detectAllCrops={detectAllCrops}
            pageCropsCount={pageCropsCount}
            hasActivePageDraftCrop={hasActivePageDraftCrop}
            clearPageCrops={clearPageCrops}
            splitSpread={splitSpread}
            revertSpread={revertSpread}
            revertSplitLevel={revertSplitLevel}
            applyCrop={applyCrop}
            revertCropLevel={revertCropLevel}
            resetCrop={resetCrop}
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
            resetDeskew={resetDeskew}
            straightenActive={straightenActive}
            onToggleStraighten={onToggleStraighten}
            deskewedPagesCount={deskewedPagesCount}
            taskProgress={deskewProgress}
            selectedPageId={selectedPageId}
            sessionId={sessionId}
            pages={pages}
            activePageNum={activePageNum}
            isDualPage={isDualPage}
            onSelectPageId={onSelectPageId}
            onRecordHistory={onRecordDeskewHistory}
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
            onClearPageMasks={(ids) => onClearPageMasks?.(ids)}
            onClearAllMasks={() => onClearAllMasks?.()}
            applyMaskBox={applyMaskBox}
            removeMaskBox={removeMaskBox}
            applyCleanupFilters={applyCleanupFilters}
            resetCleanup={resetCleanup}
            taskProgress={cleanupProgress}
            pages={pages}
            selectedPageId={selectedPageId}
            activePageNum={activePageNum}
            isDualPage={isDualPage}
            onSelectPageId={onSelectPageId}
            shortcutLabels={shortcutLabels}
          />
        )}

        {focusedModule === "restore" && (
          <RestorePanel
            restorationModule={restorationModule}
            setRestorationModule={setRestorationModule}
            pageColorMode={pageColorMode}
            onSetPageColorMode={onSetPageColorMode}
            resetRestoration={resetRestoration}
            colorOverridePagesCount={colorOverridePagesCount}
            taskProgress={restoreProgress}
            pages={pages}
            selectedPageId={selectedPageId}
            activePageNum={activePageNum}
            isDualPage={isDualPage}
            onSelectPageId={onSelectPageId}
            onRecordHistory={onRecordRestorationHistory}
            shortcutLabels={shortcutLabels}
          />
        )}

        {focusedModule === "bleed" && (
          <BleedPanel
            bleedModule={bleedModule}
            setBleedModule={setBleedModule}
            unit={unit}
            onActivateEyedropper={onActivateEyedropper}
            resetBleed={resetBleed}
            taskProgress={bleedProgress}
            pages={pages}
            selectedPageId={selectedPageId}
            activePageNum={activePageNum}
            isDualPage={isDualPage}
            onSelectPageId={onSelectPageId}
            onRecordHistory={onRecordBleedHistory}
            shortcutLabels={shortcutLabels}
          />
        )}
      </div>
    </div>
  );
}
