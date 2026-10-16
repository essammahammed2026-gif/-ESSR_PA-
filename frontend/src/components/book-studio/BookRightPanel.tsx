"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Download, RefreshCw, Layers, BookOpen, ChevronRight } from "lucide-react";
import { DeskewModuleConfig, BleedModuleConfig, RestorationModuleConfig, CropModuleConfig, CropBox, BookStudioPage } from "@/types/book_studio";
import { CropSplitPanel } from "./modules/CropSplitPanel";
import { DeskewPanel } from "./modules/DeskewPanel";
import { BleedPanel } from "./modules/BleedPanel";
import { RestorePanel } from "./modules/RestorePanel";
interface BookRightPanelProps {
  cropModule: CropModuleConfig; setCropModule: React.Dispatch<React.SetStateAction<CropModuleConfig>>;
  isDetectingCrop?: boolean; detectCrop?: (pageId?: string) => Promise<{ crop_box: CropBox; split_pos: number; confidence: number } | null>;
  splitSpread?: () => Promise<void>; revertSpread?: (mode?: "current" | "all", pageId?: string) => Promise<void>;
  applyCrop?: () => Promise<void>; pages: BookStudioPage[];
  deskewModule: DeskewModuleConfig; setDeskewModule: React.Dispatch<React.SetStateAction<DeskewModuleConfig>>;
  bleedModule: BleedModuleConfig; setBleedModule: React.Dispatch<React.SetStateAction<BleedModuleConfig>>;
  restorationModule: RestorationModuleConfig; setRestorationModule: React.Dispatch<React.SetStateAction<RestorationModuleConfig>>;
  isDetectingAngle?: boolean; detectedAngle?: number | null; detectPageAngle?: (pageId?: string) => Promise<number | null>;
  selectedPageId?: string | null; handleExport: () => void; isExporting: boolean;
  sessionId: string | null; totalPages: number; onCollapse?: () => void;
}
export function BookRightPanel({ cropModule, setCropModule, isDetectingCrop, detectCrop, splitSpread, revertSpread, applyCrop, pages, deskewModule, setDeskewModule, bleedModule, setBleedModule, restorationModule, setRestorationModule, isDetectingAngle, detectedAngle, detectPageAngle, selectedPageId, handleExport, isExporting, sessionId, totalPages, onCollapse }: BookRightPanelProps) {
  const [isCropOpen, setIsCropOpen] = useState<boolean>(false);
  const [isDeskewOpen, setIsDeskewOpen] = useState<boolean>(false);
  const [isBleedOpen, setIsBleedOpen] = useState<boolean>(false);
  const [isRestorationOpen, setIsRestorationOpen] = useState<boolean>(false);
  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const isSelectedPageSplit = Boolean(selectedPage && (selectedPage.half === "left" || selectedPage.half === "right" ||
    selectedPage.slice_box != null || selectedPage.parent_page_id != null ||
    (selectedPage.half && (selectedPage.half.startsWith("col_") || selectedPage.half.startsWith("row_")))));
  const hasSplitPages = pages.some((p) => p.half === "left" || p.half === "right" || p.slice_box != null || p.parent_page_id != null);
  const pageBaseWidthMm = useMemo(() => {
    if (selectedPage?.width_mm) return selectedPage.width_mm;
    if (selectedPage?.orig_width_mm) return selectedPage.orig_width_mm;
    return 297.0;
  }, [selectedPage]);
  const pageBaseHeightMm = useMemo(() => {
    if (selectedPage?.height_mm) return selectedPage.height_mm;
    if (selectedPage?.orig_height_mm) return selectedPage.orig_height_mm;
    return 210.0;
  }, [selectedPage]);
  const boxW = Math.max(0.01, cropModule.cropBox.x2 - cropModule.cropBox.x1);
  const boxH = Math.max(0.01, cropModule.cropBox.y2 - cropModule.cropBox.y1);
  const currentCropWidthMm = Math.round(pageBaseWidthMm * boxW * 10) / 10;
  const currentCropHeightMm = Math.round(pageBaseHeightMm * boxH * 10) / 10;
  return (
    <div className="flex flex-col space-y-3 pb-2 select-none">
      <div className="flex items-center justify-between pb-0.5 px-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Controls & Export</span>
        {onCollapse && (<button onClick={onCollapse} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Collapse Right Panel"><ChevronRight size={15} /></button>)}
      </div>
      <CropSplitPanel cropModule={cropModule} setCropModule={setCropModule} isDetectingCrop={isDetectingCrop} detectCrop={detectCrop} splitSpread={splitSpread} revertSpread={revertSpread} applyCrop={applyCrop} selectedPage={selectedPage} selectedPageId={selectedPageId} isSelectedPageSplit={isSelectedPageSplit} hasSplitPages={hasSplitPages} currentCropWidthMm={currentCropWidthMm} currentCropHeightMm={currentCropHeightMm} pageBaseWidthMm={pageBaseWidthMm} pageBaseHeightMm={pageBaseHeightMm} sessionId={sessionId} open={isCropOpen} onToggle={() => setIsCropOpen((p) => !p)} />
      <DeskewPanel deskewModule={deskewModule} setDeskewModule={setDeskewModule} isDetectingAngle={isDetectingAngle} detectedAngle={detectedAngle} detectPageAngle={detectPageAngle} selectedPageId={selectedPageId} sessionId={sessionId} open={isDeskewOpen} onToggle={() => setIsDeskewOpen((p) => !p)} />
      <BleedPanel bleedModule={bleedModule} setBleedModule={setBleedModule} open={isBleedOpen} onToggle={() => setIsBleedOpen((p) => !p)} />
      <RestorePanel restorationModule={restorationModule} setRestorationModule={setRestorationModule} open={isRestorationOpen} onToggle={() => setIsRestorationOpen((p) => !p)} />
      <div className="bg-[#181D27] rounded-xl border border-[#242A38] p-3 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#242A38] pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200"><Download size={14} className="text-cyan-400" /><span>Export & Handoff</span></div>
          {sessionId && (<span className="text-[10px] font-mono text-slate-400">{totalPages} pages</span>)}
        </div>
        <button onClick={handleExport} disabled={!sessionId || isExporting} className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer disabled:cursor-not-allowed">
          {isExporting ? (<><RefreshCw className="animate-spin" size={14} /><span>Rendering PDF...</span></>) : (<><Download size={14} /><span>Export Cleaned Book PDF</span></>)}
        </button>
        <div className="pt-2 border-t border-[#242A38] space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Workflow Handoffs</div>
          <Link href="/imposing" className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs">
            <div className="flex items-center space-x-2"><Layers size={13} className="text-cyan-400" /><span>Send to Imposing Studio</span></div><span className="text-[10px] text-slate-500">Booklet / Gang</span>
          </Link>
          <Link href="/flipbook" className="w-full flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-slate-800 border border-[#242A38] text-slate-300 hover:text-white transition-colors text-xs">
            <div className="flex items-center space-x-2"><BookOpen size={13} className="text-cyan-400" /><span>Preview in 3D Flipbook</span></div><span className="text-[10px] text-slate-500">Proofing</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
