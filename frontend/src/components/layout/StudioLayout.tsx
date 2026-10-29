"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  ChevronLeft, 
} from "lucide-react";

export interface StudioBreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface StudioLayoutProps {
  title: string;
  className?: string;
  homeHref?: string;
  breadcrumbs?: StudioBreadcrumbItem[];
  statusBadge?: React.ReactNode;
  headerLeftActions?: React.ReactNode;
  headerActions?: React.ReactNode;
  error?: string | null;

  // Toggleable Page Deck (Rendered between Preview Panel and Right Tools Panel)
  leftPanel?: React.ReactNode;
  leftLabel?: string;
  leftIcon?: React.ReactNode;
  leftWidthClass?: string;
  defaultLeftCollapsed?: boolean;
  isLeftCollapsed?: boolean;
  onToggleLeft?: () => void;

  // Center Preview Viewport (Far Left / Main Area)
  centerViewport: React.ReactNode;

  // Right Tools Panel (Far Right)
  rightPanel?: React.ReactNode;
  rightLabel?: string;
  rightIcon?: React.ReactNode;
  rightWidthClass?: string;
  defaultRightCollapsed?: boolean;
  isRightCollapsed?: boolean;
  onToggleRight?: () => void;
  disablePanelHotkeys?: boolean;
}

export function StudioLayout({
  title,
  className = "",
  homeHref = "/",
  breadcrumbs,
  statusBadge,
  headerLeftActions,
  headerActions,
  error,

  leftPanel,
  leftWidthClass = "w-full lg:w-[250px] xl:w-[270px]",
  defaultLeftCollapsed = false,
  isLeftCollapsed: controlledLeftCollapsed,
  onToggleLeft,

  centerViewport,

  rightPanel,
  rightLabel = "Tools",
  rightWidthClass = "w-full lg:w-[280px] xl:w-[300px]",
  defaultRightCollapsed = false,
  isRightCollapsed: controlledRightCollapsed,
  onToggleRight,
  disablePanelHotkeys = false,
}: StudioLayoutProps) {
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

  useEffect(() => {
    if (disablePanelHotkeys) return;
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
  }, [leftPanel, rightPanel, toggleLeft, toggleRight, disablePanelHotkeys]);

  return (
    <div className={`flex flex-col h-full min-h-0 select-none -m-2 sm:-m-2.5 md:-m-3 ${className}`}>
      {/* Top Header Bar */}
      <div className="h-11 px-3.5 border-b border-[#1E232E] bg-[#11141B] flex items-center justify-between shrink-0">
        {/* Breadcrumb Links & Left Header Actions */}
        <div className="flex items-center space-x-3 text-xs text-slate-300">
          <nav className="flex items-center space-x-2" aria-label="Breadcrumb">
            <Link
              href={homeHref}
              className="font-medium text-slate-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <span className="text-slate-600">/</span>
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <span className="text-slate-300 font-medium">{title}</span>
            ) : (
              <span className="font-semibold text-white">{title}</span>
            )}
            {breadcrumbs?.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <span className="text-slate-600">/</span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-white transition-colors font-medium text-slate-300"
                  >
                    {crumb.label}
                  </Link>
                ) : crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-white transition-colors cursor-pointer font-medium text-slate-300"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="font-semibold text-white truncate max-w-[200px]" title={crumb.label}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
          {headerLeftActions}
        </div>

        {/* Header Center/Right Actions */}
        <div className="flex items-center space-x-2">
          {statusBadge}
          {headerActions}
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="px-3.5 py-2 bg-rose-950/60 border-b border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2 shrink-0">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Edge-to-Edge Studio Body: [Preview Viewport (flex-1)] | [Toggleable Page Deck] | [Tools Panel] */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-[#14171F]">
        {/* 1. Center Preview Viewport (Far Left / Main Area) */}
        <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
          {centerViewport}
        </div>

        {/* 2. Middle Column: Toggleable Page Deck (Between Preview Panel and Tools Panel) */}
        {leftPanel && !leftCollapsed && (
          <div className={`${leftWidthClass} shrink-0 h-full border-l border-[#1E232E] bg-[#11141B] overflow-hidden flex flex-col`}>
            {leftPanel}
          </div>
        )}

        {/* 3. Right Column: Simple Tools Panel */}
        {rightPanel && (
          !rightCollapsed ? (
            <div className={`${rightWidthClass} shrink-0 h-full border-l border-[#1E232E] bg-[#11141B] overflow-y-auto flex flex-col`}>
              {rightPanel}
            </div>
          ) : (
            <div className="w-10 shrink-0 h-full bg-[#11141B] border-l border-[#1E232E] flex flex-col items-center py-3 space-y-4 select-none">
              <button
                onClick={toggleRight}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#191D26] rounded-md transition-colors cursor-pointer"
                title={`Expand ${rightLabel} Panel (])`}
              >
                <ChevronLeft size={15} />
              </button>
              <div 
                onClick={toggleRight}
                className="flex-1 flex flex-col items-center justify-center cursor-pointer group py-2"
                title={`Click to expand ${rightLabel}`}
              >
                <span className="[writing-mode:vertical-lr] text-[10px] font-semibold text-slate-500 group-hover:text-slate-200 tracking-wider">
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
