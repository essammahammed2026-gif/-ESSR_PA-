"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Grid,
  Layers,
  Shuffle,
  Crop,
  SlidersHorizontal,
  FileText,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { ImposingItem, ImposingPage } from "@/types/prepress";
import { PageSizePanel } from "./modules/PageSizePanel";
import { StepRepeatPanel } from "./modules/StepRepeatPanel";
import { NUpPanel } from "./modules/NUpPanel";
import { ShufflePanel } from "./modules/ShufflePanel";
import { ImposingBleedPanel } from "./modules/ImposingBleedPanel";
import { PageToolsPanel } from "./modules/PageToolsPanel";
import { OcrPanel } from "./modules/OcrPanel";

export type ImposingToolId =
  | "page_size"
  | "step_repeat"
  | "n_up"
  | "shuffle"
  | "bleed"
  | "page_tools"
  | "ocr";

interface RightControlPanelProps {
  jobMode: string;
  setJobMode: (m: "book" | "gang") => void;
  items: ImposingItem[];
  pages: ImposingPage[];
  sheetPreset: string;
  setSheetPreset: (p: string) => void;
  sheetW: number;
  setSheetW: (w: number) => void;
  sheetH: number;
  setSheetH: (h: number) => void;
  unit: string;
  gap: number;
  setGap: (g: number) => void;
  margin: number;
  setMargin: (m: number) => void;
  rows?: number | null;
  setRows?: (r: number | null) => void;
  cols?: number | null;
  setCols?: (c: number | null) => void;
  batchRotateSelected?: (dir: "cw" | "ccw") => void;
  selectedPageIds?: string[];
  rotatePage?: (id: string, dir: "cw" | "ccw") => void;
  onCollapse?: () => void;
}

export function RightControlPanel({
  jobMode,
  setJobMode,
  items,
  pages,
  sheetPreset,
  setSheetPreset,
  sheetW,
  setSheetW,
  sheetH,
  setSheetH,
  unit,
  gap,
  setGap,
  margin,
  setMargin,
  rows,
  setRows,
  cols,
  setCols,
  batchRotateSelected,
  selectedPageIds,
  rotatePage,
  onCollapse,
}: RightControlPanelProps) {
  const [activeTool, setActiveTool] = useState<ImposingToolId | null>(null);

  const tools: {
    id: ImposingToolId;
    shortcut: string;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "page_size",
      shortcut: "1",
      title: "Page Size",
      description: `${Math.round(sheetW)}×${Math.round(sheetH)} ${unit} press format`,
      icon: <Maximize2 size={14} />,
    },
    {
      id: "step_repeat",
      shortcut: "2",
      title: "Step and Repeat",
      description: !rows && !cols ? "Auto 2D nesting" : `${rows || 1}×${cols || 1} matrix`,
      icon: <Grid size={14} />,
    },
    {
      id: "n_up",
      shortcut: "3",
      title: "N-Up",
      description: jobMode === "book" ? "Booklet signatures" : "Multi-up spreads",
      icon: <Layers size={14} />,
    },
    {
      id: "shuffle",
      shortcut: "4",
      title: "Shuffle",
      description: "Cut & stack, saddle fold",
      icon: <Shuffle size={14} />,
    },
    {
      id: "bleed",
      shortcut: "5",
      title: "Bleed",
      description: "Mirror, solid or TrimBox",
      icon: <Crop size={14} />,
    },
    {
      id: "page_tools",
      shortcut: "6",
      title: "Page Tools",
      description: "Rotate, blanks, RTL order",
      icon: <SlidersHorizontal size={14} />,
    },
    {
      id: "ocr",
      shortcut: "7",
      title: "OCR",
      description: "Arabic & English recognition",
      icon: <FileText size={14} />,
    },
  ];

  const activeToolMeta = tools.find((t) => t.id === activeTool);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-panel,#141923)] border-l border-[var(--border-subtle,#242C3D)] select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-10 px-3.5 border-b border-[var(--border-subtle,#242C3D)] bg-[var(--surface-panel,#141923)] flex items-center justify-between shrink-0">
        {activeTool && activeToolMeta ? (
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="flex items-center space-x-1.5 text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] transition-colors cursor-pointer group"
          >
            <ChevronLeft
              size={15}
              className="text-[var(--text-muted,#64748B)] group-hover:text-[var(--text-primary,#F1F5F9)] transition-transform group-hover:-translate-x-0.5"
            />
            <span className="text-xs font-bold">{activeToolMeta.title}</span>
          </button>
        ) : (
          <span className="text-xs font-bold text-[var(--text-primary,#F1F5F9)]">Imposition Tools</span>
        )}

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="p-1 text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] rounded transition-colors cursor-pointer"
            title="Collapse Tools Panel"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!activeTool ? (
          /* TIER 1: FLAT TOOL DIRECTORY (Clean Book Studio Style) */
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted,#64748B)]">
                Prepress Tools
              </div>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer group border border-transparent hover:border-[var(--border-subtle,#242C3D)]"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                    <span className="text-[var(--text-muted,#64748B)] group-hover:text-[var(--app-accent,#F59E0B)] transition-colors shrink-0">
                      {tool.icon}
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)] truncate">
                        {tool.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted,#64748B)] truncate">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-[var(--surface-inset,#11151E)] border border-[var(--border-subtle,#242C3D)] text-[9px] font-mono text-[var(--text-muted,#64748B)]">
                      {tool.shortcut}
                    </kbd>
                    <ChevronRight
                      size={13}
                      className="text-[var(--text-muted,#64748B)] group-hover:text-[var(--text-secondary,#94A3B8)] transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </button>
              ))}
            </div>

            {/* Studio Handoffs */}
            <div className="pt-2 border-t border-[var(--border-subtle,#242C3D)] space-y-1">
              <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted,#64748B)]">
                Studio Handoff
              </div>
              <Link
                href="/book-studio"
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#F1F5F9)] hover:bg-[var(--surface-card,#181D27)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-subtle,#242C3D)] group"
              >
                <div className="flex items-center space-x-2.5">
                  <BookOpen size={14} className="text-[var(--text-muted,#64748B)] group-hover:text-cyan-400" />
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)]">Scanned Book Studio</div>
                    <div className="text-[10px] text-[var(--text-muted,#64748B)]">Crop, deskew & clean pages</div>
                  </div>
                </div>
                <ArrowUpRight size={13} className="text-[var(--text-muted,#64748B)]" />
              </Link>
            </div>
          </div>
        ) : (
          /* TIER 2: FOCUSED MODULE VIEW */
          <div className="space-y-4">
            {activeTool === "page_size" && (
              <PageSizePanel
                sheetW={sheetW}
                setSheetW={setSheetW}
                sheetH={sheetH}
                setSheetH={setSheetH}
                sheetPreset={sheetPreset}
                setSheetPreset={setSheetPreset}
                margin={margin}
                setMargin={setMargin}
                unit={unit}
              />
            )}

            {activeTool === "step_repeat" && (
              <StepRepeatPanel
                rows={rows ?? null}
                setRows={(r) => setRows?.(r)}
                cols={cols ?? null}
                setCols={(c) => setCols?.(c)}
                gap={gap}
                setGap={setGap}
                unit={unit}
              />
            )}

            {activeTool === "n_up" && (
              <NUpPanel jobMode={jobMode} setJobMode={setJobMode} />
            )}

            {activeTool === "shuffle" && <ShufflePanel />}

            {activeTool === "bleed" && <ImposingBleedPanel unit={unit} />}

            {activeTool === "page_tools" && (
              <PageToolsPanel
                pages={pages}
                batchRotateSelected={batchRotateSelected}
                selectedPageIds={selectedPageIds}
                rotatePage={rotatePage}
              />
            )}

            {activeTool === "ocr" && <OcrPanel />}
          </div>
        )}
      </div>
    </div>
  );
}
