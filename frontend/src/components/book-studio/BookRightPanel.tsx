"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import {
  IconImposingStudio,
  IconFlipbookStudio,
} from "@/components/shared/StudioIcons";
import {
  DeskewModuleConfig,
  BleedModuleConfig,
  RestorationModuleConfig,
  CropModuleConfig,
  CropBox,
  BookStudioPage,
} from "@/types/book_studio";
import { LengthUnit } from "@/lib/units";
import { CropSplitPanel } from "./modules/CropSplitPanel";
import { DeskewPanel } from "./modules/DeskewPanel";
import { BleedPanel } from "./modules/BleedPanel";
import { RestorePanel } from "./modules/RestorePanel";

interface BookRightPanelProps {
  cropModule: CropModuleConfig;
  setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean;
  detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  splitSpread?: () => Promise<void>;
  revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>;
  pages: BookStudioPage[];
  deskewModule: DeskewModuleConfig;
  setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  bleedModule: BleedModuleConfig;
  setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  restorationModule: RestorationModuleConfig;
  setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  isDetectingAngle?: boolean;
  detectedAngle?: number | null;
  detectPageAngle?: (pageId?: string) => Promise<number | null>;
  selectedPageId?: string | null;
  sessionId: string | null;
  unit?: LengthUnit;
  onActivateEyedropper?: () => void;
  onCollapse?: () => void;
}

export function BookRightPanel({
  cropModule,
  setCropModule,
  isDetectingCrop,
  detectCrop,
  splitSpread,
  revertSpread,
  applyCrop,
  deskewModule,
  setDeskewModule,
  bleedModule,
  setBleedModule,
  restorationModule,
  setRestorationModule,
  isDetectingAngle,
  detectedAngle,
  detectPageAngle,
  selectedPageId,
  sessionId,
  unit,
  onActivateEyedropper,
  onCollapse,
}: BookRightPanelProps) {
  const [isCropOpen, setIsCropOpen] = useState<boolean>(cropModule.enabled);
  const [isDeskewOpen, setIsDeskewOpen] = useState<boolean>(deskewModule.enabled);
  const [isBleedOpen, setIsBleedOpen] = useState<boolean>(bleedModule.enabled);
  const [isRestorationOpen, setIsRestorationOpen] = useState<boolean>(restorationModule.enabled);

  // Auto-expand module immediately when switched on
  useEffect(() => {
    if (cropModule.enabled) setIsCropOpen(true);
  }, [cropModule.enabled]);

  useEffect(() => {
    if (deskewModule.enabled) setIsDeskewOpen(true);
  }, [deskewModule.enabled]);

  useEffect(() => {
    if (bleedModule.enabled) setIsBleedOpen(true);
  }, [bleedModule.enabled]);

  useEffect(() => {
    if (restorationModule.enabled) setIsRestorationOpen(true);
  }, [restorationModule.enabled]);

  return (
    <div className="flex flex-col space-y-2 pb-2 select-none">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tools</span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Collapse Tools Panel"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <CropSplitPanel
        cropModule={cropModule}
        setCropModule={setCropModule}
        isDetectingCrop={isDetectingCrop}
        detectCrop={detectCrop}
        splitSpread={splitSpread}
        revertSpread={revertSpread}
        applyCrop={applyCrop}
        selectedPageId={selectedPageId}
        sessionId={sessionId}
        open={isCropOpen}
        onToggle={() => setIsCropOpen((p) => !p)}
      />

      <DeskewPanel
        deskewModule={deskewModule}
        setDeskewModule={setDeskewModule}
        isDetectingAngle={isDetectingAngle}
        detectedAngle={detectedAngle}
        detectPageAngle={detectPageAngle}
        selectedPageId={selectedPageId}
        sessionId={sessionId}
        open={isDeskewOpen}
        onToggle={() => setIsDeskewOpen((p) => !p)}
      />

      <BleedPanel
        bleedModule={bleedModule}
        setBleedModule={setBleedModule}
        open={isBleedOpen}
        onToggle={() => setIsBleedOpen((p) => !p)}
        unit={unit}
        onActivateEyedropper={onActivateEyedropper}
      />

      <RestorePanel
        restorationModule={restorationModule}
        setRestorationModule={setRestorationModule}
        open={isRestorationOpen}
        onToggle={() => setIsRestorationOpen((p) => !p)}
      />

      {/* Compact Studio Handoff Links */}
      <div className="pt-1 flex items-center gap-1.5">
        <Link
          href="/imposing"
          className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#1E2432] border border-[#242A38] hover:border-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-[11px]"
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
          className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#1E2432] border border-[#242A38] hover:border-slate-600 text-slate-400 hover:text-slate-100 transition-colors text-[11px]"
          title="Open 3D Flipbook Studio for Interactive Proofing"
        >
          <span className="flex items-center space-x-1.5 truncate">
            <IconFlipbookStudio size={13} className="shrink-0" style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span className="truncate font-medium">Flipbook</span>
          </span>
          <ArrowUpRight size={11} className="text-slate-500 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
