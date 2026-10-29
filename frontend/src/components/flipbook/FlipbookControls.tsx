"use client";

import React, { useState } from "react";
import {
  Loader2,
  Download,
  Eye,
  X,
  FileArchive,
  FileCode2,
  UploadCloud,
  ChevronLeft,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";

export interface FlipbookControlsProps {
  files: File[];
  numPages: number;
  taskId: string | null;
  isGenerating: boolean;
  dpi: string;
  direction: string;
  bindingStyle: string;
  magPadChoice: string;
  addFlyleaves: boolean;
  pageRange: string;
  showMagPadding: boolean;
  showHardCoverOptions: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPageRangeChange: (v: string) => void;
  onDpiChange: (v: string) => void;
  onDirectionChange: (v: string) => void;
  onBindingChange: (v: string) => void;
  onMagPadChange: (v: string) => void;
  onFlyleavesChange: (v: boolean) => void;
  onGenerate: () => void;
  showExportModal: boolean;
  exportDpi: string;
  exportFormat: string;
  isExporting: boolean;
  exportError: string | null;
  exportStatus: string;
  exportProgress: number;
  onCloseExport: () => void;
  onExportDpiChange: (v: string) => void;
  onExportFormatChange: (v: string) => void;
  onStartExport: () => void;
}

type FlipbookToolId = "document" | "reading" | "binding";

export function FlipbookControls(p: FlipbookControlsProps) {
  const [activeTool, setActiveTool] = useState<FlipbookToolId | null>(null);

  const tools: {
    id: FlipbookToolId;
    title: string;
    category: "PROOFING SETUP";
    icon: React.ReactNode;
  }[] = [
    { id: "document", title: "Input PDF Document", category: "PROOFING SETUP", icon: <UploadCloud size={15} /> },
    { id: "reading", title: "Reading & Quality", category: "PROOFING SETUP", icon: <SlidersHorizontal size={15} /> },
    { id: "binding", title: "Binding Style", category: "PROOFING SETUP", icon: <BookOpen size={15} /> },
  ];

  const activeToolMeta = tools.find((t) => t.id === activeTool);

  return (
    <>
      <div className="flex flex-col h-full bg-[#11141B] select-none overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#1E232E] shrink-0">
          {activeTool && activeToolMeta ? (
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="flex items-center space-x-2 text-slate-200 hover:text-white transition-colors cursor-pointer group"
            >
              <ChevronLeft size={16} className="text-slate-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
              <span className="text-xs font-semibold tracking-tight">{activeToolMeta.title}</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-100 tracking-tight">Flipbook Tools</span>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {!activeTool ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  PROOFING SETUP
                </div>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveTool(tool.id)}
                    className="w-full flex items-center space-x-3 px-2.5 py-2.5 rounded-lg text-left text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <span className="text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                      {tool.icon}
                    </span>
                    <span className="text-[13px] font-normal tracking-tight truncate">
                      {tool.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-1">
              {activeTool === "document" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1.5 text-xs">
                      <label className="font-semibold text-slate-300">Input PDF Document</label>
                      {p.numPages > 0 && <span className="text-slate-400 font-mono text-[11px]">{p.numPages} pages</span>}
                    </div>
                    <label className="w-full border border-dashed border-[#242A38] hover:border-slate-500 rounded-lg p-4 text-center cursor-pointer block bg-[#181D27]/50 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="application/pdf"
                        onChange={(e) => {
                          p.onFileChange(e);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                      <UploadCloud size={22} className="text-slate-400 mx-auto mb-1.5" />
                      <span className="text-xs font-medium text-slate-200 block">
                        {p.files.length > 0 ? `${p.files.length} PDF selected` : "Select PDF"}
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Page Range</label>
                    <input
                      type="text"
                      placeholder="e.g. 1-10 or leave blank for All"
                      value={p.pageRange}
                      onChange={(e) => p.onPageRangeChange(e.target.value)}
                      disabled={!!p.taskId}
                      className="w-full text-xs bg-[#181D27] border border-[#242A38] text-slate-200 p-2 rounded-lg outline-none disabled:opacity-40"
                    />
                  </div>
                </div>
              )}

              {activeTool === "reading" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Preview Quality (DPI)</label>
                    <select
                      value={p.dpi}
                      onChange={(e) => p.onDpiChange(e.target.value)}
                      disabled={!!p.taskId}
                      className="w-full text-xs bg-[#181D27] border border-[#242A38] text-slate-200 p-2 rounded-lg outline-none disabled:opacity-40"
                    >
                      <option value="72">72 DPI (Ultra-Fast Preview)</option>
                      <option value="150">150 DPI (Crisp Text)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Reading Flow</label>
                    <select
                      value={p.direction}
                      onChange={(e) => p.onDirectionChange(e.target.value)}
                      className="w-full text-xs bg-[#181D27] border border-[#242A38] text-slate-200 p-2 rounded-lg outline-none"
                    >
                      <option>Left to Right (LTR)</option>
                      <option>Right to Left (RTL)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTool === "binding" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Binding Style</label>
                    <select
                      value={p.bindingStyle}
                      onChange={(e) => p.onBindingChange(e.target.value)}
                      className="w-full text-xs bg-[#181D27] border border-[#242A38] text-slate-200 p-2 rounded-lg outline-none"
                    >
                      <option>Soft Cover (Paperback)</option>
                      <option>Hard Cover</option>
                      <option>Magazine</option>
                      <option>Spiral</option>
                      <option>Plastic Comb</option>
                      <option>Double Wire</option>
                    </select>
                  </div>

                  {p.showMagPadding && (
                    <div className="space-y-1.5 pt-1 text-xs">
                      <label className="block font-semibold text-slate-300">
                        Magazine Signature Padding (Needs {4 - (p.numPages % 4)} pp)
                      </label>
                      <select
                        value={p.magPadChoice}
                        onChange={(e) => p.onMagPadChange(e.target.value)}
                        className="w-full text-xs bg-[#181D27] border border-[#242A38] text-slate-200 p-2 rounded-lg outline-none"
                      >
                        <option>After front cover</option>
                        <option>Before back cover</option>
                        <option>At the very end</option>
                      </select>
                    </div>
                  )}

                  {p.showHardCoverOptions && (
                    <label className="flex items-center space-x-2.5 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.addFlyleaves}
                        onChange={(e) => p.onFlyleavesChange(e.target.checked)}
                        className="rounded bg-[#181D27] border-[#242A38] text-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-300">
                        Insert 3 blank flyleaf endpapers
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action */}
        {!p.taskId && (
          <div className="p-3 border-t border-[#1E232E] shrink-0">
            <button
              type="button"
              onClick={p.onGenerate}
              disabled={p.isGenerating || p.files.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center justify-center space-x-2 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {p.isGenerating ? <Loader2 className="animate-spin" size={15} /> : <Eye size={15} />}
              <span>{p.isGenerating ? "Synthesizing Proof..." : "Generate Live Proof"}</span>
            </button>
          </div>
        )}
      </div>

      {p.showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#181D27] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[#242A38] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#242A38]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download size={18} className="text-emerald-400"/>
                <span>Export Digital Package</span>
              </h3>
              {!p.isExporting && (
                <button
                  type="button"
                  onClick={p.onCloseExport}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={18}/>
                </button>
              )}
            </div>

            {p.exportError && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg border border-red-500/30">
                {p.exportError}
              </div>
            )}

            {!p.isExporting ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Export Image Resolution
                  </label>
                  <select
                    value={p.exportDpi}
                    onChange={(e) => p.onExportDpiChange(e.target.value)}
                    className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none"
                  >
                    <option value="72">72 DPI (Lightweight email proof)</option>
                    <option value="150">150 DPI (Balanced web publication)</option>
                    <option value="300">300 DPI (High-definition print proof)</option>
                  </select>
                </div>

                <div className="p-3 bg-[#131720] border border-[#2E3648] rounded-lg space-y-3">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={p.exportFormat === "zip"}
                      onChange={() => p.onExportFormatChange("zip")}
                      className="mt-0.5 text-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileArchive size={14} className="text-amber-400"/>
                        <span>ZIP Self-Contained Archive (Recommended)</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Standalone HTML with folder assets. Runs locally offline or hosted on any web server.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={p.exportFormat === "html"}
                      onChange={() => p.onExportFormatChange("html")}
                      className="mt-0.5 text-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileCode2 size={14} className="text-blue-400"/>
                        <span>Single Standalone HTML</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Single file with embedded base64 assets.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={p.onCloseExport}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={p.onStartExport}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Start Compilation
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="animate-spin text-emerald-400" size={36} />
                <div className="text-center">
                  <div className="text-sm font-semibold text-white mb-0.5">{p.exportStatus}</div>
                  <div className="text-xs text-slate-400">Rendering pages at {p.exportDpi} DPI</div>
                </div>
                <div className="w-full bg-[#131720] rounded-full h-2 border border-[#2E3648] overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${p.exportProgress}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{p.exportProgress}% Complete</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
