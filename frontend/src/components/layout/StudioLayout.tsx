"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen, 
  SlidersHorizontal 
} from "lucide-react";

export interface StudioLayoutProps {
  title: string;
  homeHref?: string;
  statusBadge?: React.ReactNode;
  headerActions?: React.ReactNode;
  error?: string | null;

  // Left Panel
  leftPanel?: React.ReactNode;
  leftLabel?: string;
  leftIcon?: React.ReactNode;
  leftWidthClass?: string;
  defaultLeftCollapsed?: boolean;
  isLeftCollapsed?: boolean;
  onToggleLeft?: () => void;

  // Center Viewport
  centerViewport: React.ReactNode;

  // Right Panel
  rightPanel?: React.ReactNode;
  rightLabel?: string;
  rightIcon?: React.ReactNode;
  rightWidthClass?: string;
  defaultRightCollapsed?: boolean;
  isRightCollapsed?: boolean;
  onToggleRight?: () => void;
}

export function StudioLayout({
  title,
  homeHref = "/",
  statusBadge,
  headerActions,
  error,

  leftPanel,
  leftLabel = "Deck",
  leftIcon = <FolderOpen size={13} />,
  leftWidthClass = "w-full lg:w-[280px] xl:w-[300px]",
  defaultLeftCollapsed = false,
  isLeftCollapsed: controlledLeftCollapsed,
  onToggleLeft,

  centerViewport,

  rightPanel,
  rightLabel = "Controls",
  rightIcon = <SlidersHorizontal size={13} />,
  rightWidthClass = "w-full lg:w-[320px] xl:w-[340px]",
  defaultRightCollapsed = false,
  isRightCollapsed: controlledRightCollapsed,
  onToggleRight,
}: StudioLayoutProps) {
  // Support both controlled and uncontrolled sidebar state
  const [internalLeftCollapsed, setInternalLeftCollapsed] = useState<boolean>(defaultLeftCollapsed);
  const [internalRightCollapsed, setInternalRightCollapsed] = useState<boolean>(defaultRightCollapsed);

  const leftCollapsed = controlledLeftCollapsed !== undefined 
    ? controlledLeftCollapsed 
    : internalLeftCollapsed;

  const rightCollapsed = controlledRightCollapsed !== undefined 
    ? controlledRightCollapsed 
    : internalRightCollapsed;

  const toggleLeft = useCallback(() => {
    if (onToggleLeft) {
      onToggleLeft();
    } else {
      setInternalLeftCollapsed((prev) => !prev);
    }
  }, [onToggleLeft]);

  const toggleRight = useCallback(() => {
    if (onToggleRight) {
      onToggleRight();
    } else {
      setInternalRightCollapsed((prev) => !prev);
    }
  }, [onToggleRight]);

  // Global hotkeys: [ toggles left panel, ] toggles right panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "[" && leftPanel) {
        e.preventDefault();
        toggleLeft();
      } else if (e.key === "]" && rightPanel) {
        e.preventDefault();
        toggleRight();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [leftPanel, rightPanel, toggleLeft, toggleRight]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] space-y-2 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#242A38]">
        {/* Breadcrumb Links */}
        <div className="flex items-center space-x-2 text-sm text-slate-300">
          <Link href={homeHref} className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            Home
          </Link>
          <span className="text-slate-500">/</span>
          <span className="font-semibold text-white">{title}</span>
        </div>

        {/* Header Center/Right Actions & Panel Toggles */}
        <div className="flex items-center space-x-2">
          {/* Left Panel Toggle (if present) */}
          {leftPanel && (
            <button
              onClick={toggleLeft}
              className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 transition-colors ${
                leftCollapsed
                  ? "bg-[#181D27] text-slate-400 border-[#242A38] hover:text-white hover:bg-slate-800"
                  : "bg-blue-950/40 text-blue-300 border-blue-600/40"
              }`}
              title={leftCollapsed ? `Show ${leftLabel} Panel ([)` : `Collapse ${leftLabel} Panel ([)`}
            >
              {leftIcon}
              <span className="text-[11px] font-medium hidden sm:inline">{leftLabel}</span>
            </button>
          )}

          {/* Right Panel Toggle (if present) */}
          {rightPanel && (
            <button
              onClick={toggleRight}
              className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 transition-colors ${
                rightCollapsed
                  ? "bg-[#181D27] text-slate-400 border-[#242A38] hover:text-white hover:bg-slate-800"
                  : "bg-cyan-950/40 text-cyan-300 border-cyan-600/40"
              }`}
              title={rightCollapsed ? `Show ${rightLabel} Panel (])` : `Collapse ${rightLabel} Panel (])`}
            >
              {rightIcon}
              <span className="text-[11px] font-medium hidden sm:inline">{rightLabel}</span>
            </button>
          )}

          {/* Custom Studio Status Badge */}
          {statusBadge}

          {/* Custom Header Actions (e.g. Export buttons, new job) */}
          {headerActions}
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main 3-Column Studio Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Left Column */}
        {leftPanel && (
          !leftCollapsed ? (
            <div className={`${leftWidthClass} shrink-0 h-full transition-all duration-200`}>
              {leftPanel}
            </div>
          ) : (
            <div className="w-11 shrink-0 h-full bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col items-center py-3 space-y-4 shadow-sm select-none transition-all duration-200">
              <button
                onClick={toggleLeft}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={`Expand ${leftLabel} Panel ([)`}
              >
                <ChevronRight size={16} />
              </button>
              <div 
                onClick={toggleLeft}
                className="flex-1 flex flex-col items-center justify-center cursor-pointer group py-2"
                title={`Click to expand ${leftLabel}`}
              >
                <span className="[writing-mode:vertical-lr] text-[10px] font-semibold text-slate-400 group-hover:text-cyan-400 tracking-wider">
                  {leftLabel.toUpperCase()}
                </span>
              </div>
            </div>
          )
        )}

        {/* Center Viewport */}
        <div className="flex-1 h-full min-w-0 transition-all duration-200">
          {centerViewport}
        </div>

        {/* Right Column */}
        {rightPanel && (
          !rightCollapsed ? (
            <div className={`${rightWidthClass} shrink-0 h-full overflow-y-auto transition-all duration-200`}>
              {rightPanel}
            </div>
          ) : (
            <div className="w-11 shrink-0 h-full bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col items-center py-3 space-y-4 shadow-sm select-none transition-all duration-200">
              <button
                onClick={toggleRight}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={`Expand ${rightLabel} Panel (])`}
              >
                <ChevronLeft size={16} />
              </button>
              <div 
                onClick={toggleRight}
                className="flex-1 flex flex-col items-center justify-center cursor-pointer group py-2"
                title={`Click to expand ${rightLabel}`}
              >
                <span className="[writing-mode:vertical-lr] text-[10px] font-semibold text-slate-400 group-hover:text-cyan-400 tracking-wider">
                  {rightLabel.toUpperCase()}
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
