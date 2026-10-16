"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Files,
  ClipboardPaste,
  PlusSquare,
  RotateCw,
  Trash2,
  Download,
  Info,
  ChevronRight,
} from "lucide-react";
import { BookStudioPage } from "@/types/book_studio";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface PageContextMenuProps {
  page: BookStudioPage;
  position: ContextMenuPosition;
  onClose: () => void;
  selectedPageIds?: string[];
  onRotate: (pageId: string, delta: number) => void;
  onBatchRotate?: (delta: number) => void;
  onDelete: (pageId: string) => void;
  onBatchDelete?: () => void;
  onCopy: (page: BookStudioPage) => void;
  onDuplicate?: (pageId: string) => void;
  onBatchDuplicate?: () => void;
  onPaste: (targetPageId: string, position: "before" | "after") => void;
  canPaste: boolean;
  onInsertBlank: (targetPageId: string, position: "before" | "after") => void;
  onExtract: (pageId: string, format: "pdf" | "png" | "jpeg" | "webp") => void;
  onShowProperties: (page: BookStudioPage) => void;
}

const ROTATE_OPTIONS = [
  { label: "Rotate 90° CW", delta: 90 },
  { label: "Rotate -90° CCW", delta: -90 },
  { label: "Rotate 180°", delta: 180 },
];

const EXTRACT_OPTIONS = [
  { label: "As PDF Document", format: "pdf" as const },
  { label: "As PNG Image", format: "png" as const },
  { label: "As JPEG Image", format: "jpeg" as const },
  { label: "As WebP Image", format: "webp" as const },
];

export function PageContextMenu({
  page,
  position,
  onClose,
  selectedPageIds = [],
  onRotate,
  onBatchRotate,
  onDelete,
  onBatchDelete,
  onCopy,
  onDuplicate,
  onBatchDuplicate,
  onPaste,
  canPaste,
  onInsertBlank,
  onExtract,
  onShowProperties,
}: PageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const isMulti = selectedPageIds.length > 1 && selectedPageIds.includes(page.id);
  const multiCount = selectedPageIds.length;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const left = typeof window !== "undefined" ? Math.min(position.x, window.innerWidth - 210) : position.x;
  const top = typeof window !== "undefined" ? Math.min(position.y, window.innerHeight - 300) : position.y;

  return (
    <div
      ref={menuRef}
      style={{ left: `${Math.max(10, left)}px`, top: `${Math.max(10, top)}px` }}
      className="fixed z-50 w-52 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1.5 text-xs text-slate-200 select-none space-y-0.5 animate-in fade-in-50 duration-100"
    >
      {/* Copy Page */}
      <button
        type="button"
        onClick={() => { onCopy(page); onClose(); }}
        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left cursor-pointer"
      >
        <Copy size={13} className="text-cyan-400" />
        <span>Copy Page</span>
      </button>

      {/* Duplicate Page / Batch Duplicate */}
      {(onDuplicate || onBatchDuplicate) && (
        <button
          type="button"
          onClick={() => {
            if (isMulti && onBatchDuplicate) onBatchDuplicate();
            else if (onDuplicate) onDuplicate(page.id);
            onClose();
          }}
          className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left cursor-pointer"
        >
          <Files size={13} className="text-cyan-400" />
          <span>{isMulti ? `Duplicate (${multiCount} Pages)` : "Duplicate Page"}</span>
        </button>
      )}

      {/* Paste Submenu */}
      <div className="relative" onMouseEnter={() => canPaste && setActiveSubmenu("paste")} onMouseLeave={() => setActiveSubmenu(null)}>
        <button
          type="button"
          disabled={!canPaste}
          onClick={() => canPaste && onPaste(page.id, "after")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left ${
            !canPaste ? "opacity-40 cursor-not-allowed text-slate-500" : "hover:bg-slate-800 hover:text-white text-slate-200"
          }`}
        >
          <div className="flex items-center space-x-2"><ClipboardPaste size={13} className="text-cyan-400" /><span>Paste</span></div>
          {canPaste && <ChevronRight size={12} className="text-slate-500" />}
        </button>
        {canPaste && activeSubmenu === "paste" && (
          <div className="absolute left-full top-0 ml-1 w-36 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 z-50">
            {(["before", "after"] as const).map((pos) => (
              <button key={pos} type="button" onClick={() => { onPaste(page.id, pos); onClose(); }}
                className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 hover:text-white text-xs capitalize">
                Paste {pos}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Insert Blank Submenu */}
      <div className="relative" onMouseEnter={() => setActiveSubmenu("insert")} onMouseLeave={() => setActiveSubmenu(null)}>
        <button type="button" className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left">
          <div className="flex items-center space-x-2"><PlusSquare size={13} className="text-amber-400" /><span>Insert Blank</span></div>
          <ChevronRight size={12} className="text-slate-500" />
        </button>
        {activeSubmenu === "insert" && (
          <div className="absolute left-full top-0 ml-1 w-40 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 z-50">
            {(["before", "after"] as const).map((pos) => (
              <button key={pos} type="button" onClick={() => { onInsertBlank(page.id, pos); onClose(); }}
                className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 hover:text-white text-xs capitalize">
                Blank Page {pos}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rotate Submenu */}
      <div className="relative" onMouseEnter={() => setActiveSubmenu("rotate")} onMouseLeave={() => setActiveSubmenu(null)}>
        <button type="button" className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left cursor-pointer">
          <div className="flex items-center space-x-2">
            <RotateCw size={13} className="text-cyan-400" />
            <span>{isMulti ? `Rotate (${multiCount} Pages)` : "Rotate"}</span>
          </div>
          <ChevronRight size={12} className="text-slate-500" />
        </button>
        {activeSubmenu === "rotate" && (
          <div className="absolute left-full top-0 ml-1 w-40 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 z-50">
            {ROTATE_OPTIONS.map((opt) => (
              <button
                key={opt.delta}
                type="button"
                onClick={() => {
                  if (isMulti && onBatchRotate) onBatchRotate(opt.delta);
                  else onRotate(page.id, opt.delta);
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 hover:text-white text-xs cursor-pointer"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete / Batch Delete */}
      <button
        type="button"
        onClick={() => {
          if (isMulti && onBatchDelete) onBatchDelete();
          else onDelete(page.id);
          onClose();
        }}
        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left cursor-pointer"
      >
        <Trash2 size={13} />
        <span>{isMulti ? `Delete (${multiCount} Pages)` : "Delete Page"}</span>
      </button>

      <div className="border-t border-[#242A38] my-1" />

      {/* Extract Submenu */}
      <div className="relative" onMouseEnter={() => setActiveSubmenu("extract")} onMouseLeave={() => setActiveSubmenu(null)}>
        <button type="button" className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left">
          <div className="flex items-center space-x-2"><Download size={13} className="text-emerald-400" /><span>Extract Page</span></div>
          <ChevronRight size={12} className="text-slate-500" />
        </button>
        {activeSubmenu === "extract" && (
          <div className="absolute left-full top-0 ml-1 w-40 bg-[#131720] border border-[#2E3648] rounded-xl shadow-2xl p-1 space-y-0.5 z-50">
            {EXTRACT_OPTIONS.map((opt) => (
              <button key={opt.format} type="button" onClick={() => { onExtract(page.id, opt.format); onClose(); }}
                className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 hover:text-white text-xs">
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Properties */}
      <button
        type="button"
        onClick={() => { onShowProperties(page); onClose(); }}
        className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-left"
      >
        <Info size={13} className="text-amber-400" />
        <span>Page Properties</span>
      </button>
    </div>
  );
}
