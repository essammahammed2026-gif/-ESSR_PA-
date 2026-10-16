"use client";

import React, { useState, useRef, useEffect } from "react";
import { RotateCw, RotateCcw, RefreshCw, ChevronDown } from "lucide-react";

export interface RotateDropdownProps {
  onRotate: (delta: number) => void;
  shortcutLabel?: string;
}

export function RotateDropdown({ onRotate, shortcutLabel }: RotateDropdownProps) {
  const [rotateOpen, setRotateOpen] = useState(false);
  const rotateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rotateRef.current && !rotateRef.current.contains(e.target as Node)) {
        setRotateOpen(false);
      }
    };
    if (rotateOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rotateOpen]);

  return (
    <div className="relative" ref={rotateRef}>
      <button
        type="button"
        onClick={() => setRotateOpen((prev) => !prev)}
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
          rotateOpen
            ? "bg-slate-800 text-white border-slate-600 shadow-xs"
            : "text-slate-300 hover:text-white bg-[#181D27] hover:bg-slate-700 border-[#2E3648]"
        }`}
        title={`Rotate Page (${shortcutLabel || "R"})`}
      >
        <RotateCw size={13} className="text-cyan-400" />
        <span className="font-mono text-xs">R°</span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform ${rotateOpen ? "rotate-180" : ""}`} />
      </button>

      {rotateOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#181D27] border border-[#2E3648] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onRotate(90);
              setRotateOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCw size={13} className="text-cyan-400 shrink-0" />
            <span className="flex-1 text-left">Clockwise</span>
            <span className="text-[10px] font-mono text-slate-500">90° CW</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRotate(-90);
              setRotateOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={13} className="text-cyan-400 shrink-0" />
            <span className="flex-1 text-left">Counter-Clockwise</span>
            <span className="text-[10px] font-mono text-slate-500">90° CCW</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRotate(180);
              setRotateOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className="text-cyan-400 shrink-0" />
            <span className="flex-1 text-left">Rotate 180°</span>
            <span className="text-[10px] font-mono text-slate-500">180°</span>
          </button>
        </div>
      )}
    </div>
  );
}
