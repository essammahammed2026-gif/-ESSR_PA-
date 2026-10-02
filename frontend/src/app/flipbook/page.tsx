"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  BookOpen, 
  Loader2, 
  Download, 
  Eye, 
  X, 
  FileArchive, 
  FileCode2, 
  Layers, 
  UploadCloud 
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function FlipbookStudio() {
  const [files, setFiles] = useState<File[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form options
  const [dpi, setDpi] = useState("72");
  const [direction, setDirection] = useState("Left to Right (LTR)");
  const [bindingStyle, setBindingStyle] = useState("Soft Cover (Paperback)");
  const [magPadChoice, setMagPadChoice] = useState("At the very end");
  const [addFlyleaves, setAddFlyleaves] = useState(false);
  const [pageRange, setPageRange] = useState("");

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDpi, setExportDpi] = useState("150");
  const [exportFormat, setExportFormat] = useState("zip");
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const prevBindingRef = useRef(bindingStyle);
  const lastAppliedSettings = useRef({
    direction: "",
    bindingStyle: "",
    magPadChoice: "",
    addFlyleaves: false,
  });

  const runPreflight = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch(`${API_BASE_URL}/api/preflight`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNumPages(data.data.num_pages);
      }
    } catch {
      // optional non-blocking preflight count
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setFiles(arr);
      runPreflight(arr);
      setTaskId(null);
      setResultUrl(null);
      lastAppliedSettings.current = {
        direction: "",
        bindingStyle: "",
        magPadChoice: "",
        addFlyleaves: false,
      };
    }
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setResultUrl(null);
    setProgress(0);
    setStatusMsg("Uploading artwork files...");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("dpi", dpi);
    formData.append("direction", direction);
    formData.append("binding_style", bindingStyle);
    formData.append("bg_texture", "Dark Mode");
    formData.append("mag_pad_choice", magPadChoice);
    formData.append("add_flyleaves", String(addFlyleaves));
    formData.append("export_mode", "Folder Assets (Ultra-Fast & Light HTML)");
    formData.append("page_range", pageRange);

    try {
      const res = await fetch(`${API_BASE_URL}/api/flipbook`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to start flipbook generation");
      const data = await res.json();
      setTaskId(data.task_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating preview");
      setIsGenerating(false);
    }
  };

  const handleInstantUpdate = useCallback(async (newSettings: {
    direction: string;
    bindingStyle: string;
    magPadChoice: string;
    addFlyleaves: boolean;
  }) => {
    if (!taskId) return;
    setIsUpdating(true);
    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("direction", newSettings.direction);
    formData.append("binding_style", newSettings.bindingStyle);
    formData.append("bg_texture", "Dark Mode");
    formData.append("mag_pad_choice", newSettings.magPadChoice);
    formData.append("add_flyleaves", String(newSettings.addFlyleaves));

    try {
      const res = await fetch(`${API_BASE_URL}/api/flipbook/update`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResultUrl(`${API_BASE_URL}/flipbooks/${data.output.replace("public_flipbooks/", "")}?t=${Date.now()}`);
      } else {
        setError(data.error || "Failed to update flipbook preview.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating preview");
    } finally {
      setIsUpdating(false);
    }
  }, [taskId]);

  const triggerDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = url.split("/").pop() || "flipbook.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // download error
    }
  };

  const handleStartExport = async () => {
    if (!taskId) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgress(0);
    setExportStatus("Preparing standalone digital package...");

    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("dpi", exportDpi);
    formData.append("export_format", exportFormat);

    try {
      const res = await fetch(`${API_BASE_URL}/api/flipbook/export`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to start export task");
      const data = await res.json();
      setExportTaskId(data.task_id);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : "Failed to export");
      setIsExporting(false);
    }
  };

  // Poll for PREVIEW generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (taskId && isGenerating) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
          const data = await res.json();
          
          setProgress(data.progress);
          setStatusMsg(data.message || data.status);

          if (data.state === "SUCCESS") {
            clearInterval(interval);
            setIsGenerating(false);
            lastAppliedSettings.current = {
              direction,
              bindingStyle,
              magPadChoice,
              addFlyleaves,
            };
            prevBindingRef.current = bindingStyle;
            setResultUrl(`${API_BASE_URL}/flipbooks/${data.result.output.replace("public_flipbooks/", "")}`);
          } else if (data.state === "FAILURE") {
            clearInterval(interval);
            setIsGenerating(false);
            setError(data.status);
          }
        } catch {
          // polling error
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [taskId, isGenerating, direction, bindingStyle, magPadChoice, addFlyleaves]);

  // Poll for EXPORT generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (exportTaskId && isExporting) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/tasks/${exportTaskId}`);
          const data = await res.json();
          
          setExportProgress(data.progress);
          setExportStatus(data.message || data.status);

          if (data.state === "SUCCESS") {
            clearInterval(interval);
            setIsExporting(false);
            setExportTaskId(null);
            setShowExportModal(false);
            triggerDownload(`${API_BASE_URL}/flipbooks/${data.result.output.replace("public_flipbooks/", "")}`);
          } else if (data.state === "FAILURE") {
            clearInterval(interval);
            setIsExporting(false);
            setExportTaskId(null);
            setExportError(data.status);
          }
        } catch {
          // polling error
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [exportTaskId, isExporting]);

  // Auto-update preview only when settings change after initial generation
  useEffect(() => {
    if (!taskId || isGenerating) return;
    const prev = lastAppliedSettings.current;
    if (!prev.direction) {
      // First generation not finished yet
      return;
    }

    let nextFlyleaves = addFlyleaves;
    if (bindingStyle !== prevBindingRef.current) {
      if (bindingStyle !== "Hard Cover") {
        setAddFlyleaves(false);
        nextFlyleaves = false;
      }
      prevBindingRef.current = bindingStyle;
    }

    const hasChanged =
      prev.direction !== direction ||
      prev.bindingStyle !== bindingStyle ||
      prev.magPadChoice !== magPadChoice ||
      prev.addFlyleaves !== nextFlyleaves;

    if (!hasChanged) return;

    lastAppliedSettings.current = {
      direction,
      bindingStyle,
      magPadChoice,
      addFlyleaves: nextFlyleaves,
    };

    handleInstantUpdate({
      direction,
      bindingStyle,
      magPadChoice,
      addFlyleaves: nextFlyleaves,
    });
  }, [direction, bindingStyle, magPadChoice, addFlyleaves, taskId, isGenerating, handleInstantUpdate]);

  const showMagPadding = bindingStyle === "Magazine" && numPages > 0 && numPages % 4 !== 0;
  const showHardCoverOptions = bindingStyle === "Hard Cover";

  return (
    <div className="w-full space-y-3 pb-4">
      {/* Compact Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#242A38]">
        <div className="flex items-center space-x-2.5">
          <Layers className="text-indigo-400" size={20} />
          <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
            Flipbook Studio
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            HTML5 3D Proof
          </span>
          <span className="hidden xl:inline text-xs text-slate-400 border-l border-[#242A38] pl-2.5">
            Convert print PDFs into realistic 3D virtual publications for digital soft-proofing
          </span>
        </div>

        {resultUrl && !isGenerating && (
          <button 
            type="button"
            onClick={() => setShowExportModal(true)} 
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm self-start sm:self-auto shrink-0"
          >
            <Download size={14} />
            <span>Export & Download</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-3.5">
          <div className="bg-[#181D27] p-3.5 rounded-xl border border-[#242A38] space-y-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block pb-2 border-b border-[#242A38]">
              Virtual Binding Options
            </span>
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Page Range</label>
              <input 
                type="text" 
                placeholder="e.g. 1-10 or leave blank for All" 
                value={pageRange} 
                onChange={(e) => setPageRange(e.target.value)} 
                disabled={!!taskId}
                className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none disabled:opacity-40" 
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <label className="font-semibold text-slate-300">Input PDF Document</label>
                {numPages > 0 && <span className="text-indigo-400 font-mono text-[11px]">{numPages} pages</span>}
              </div>
              <label className="w-full border-2 border-dashed border-[#2E3648] hover:border-indigo-500/50 rounded-lg p-3 text-center cursor-pointer block bg-[#131720]/60 transition-colors">
                <input 
                  type="file" 
                  multiple 
                  accept="application/pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <UploadCloud size={22} className="text-indigo-400 mx-auto mb-1 opacity-80" />
                <span className="text-xs font-medium text-slate-300 block">
                  {files.length > 0 ? `${files.length} PDF selected` : "Select PDF"}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Preview Quality (DPI)</label>
              <select 
                value={dpi} 
                onChange={(e) => setDpi(e.target.value)} 
                disabled={!!taskId} 
                className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none disabled:opacity-40"
              >
                <option value="72">72 DPI (Ultra-Fast Preview)</option>
                <option value="150">150 DPI (Crisp Text)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reading Flow</label>
              <select 
                value={direction} 
                onChange={(e) => setDirection(e.target.value)} 
                className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none"
              >
                <option>Left to Right (LTR)</option>
                <option>Right to Left (RTL)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Binding Style</label>
              <select 
                value={bindingStyle} 
                onChange={(e) => setBindingStyle(e.target.value)} 
                className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-2 rounded-lg outline-none"
              >
                <option>Soft Cover (Paperback)</option>
                <option>Hard Cover</option>
                <option>Magazine</option>
                <option>Spiral</option>
                <option>Plastic Comb</option>
                <option>Double Wire</option>
              </select>
            </div>
            
            {showMagPadding && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30 text-xs">
                <label className="block font-semibold mb-1 text-indigo-300">
                  Magazine Signature Padding (Needs {4 - (numPages % 4)} pp)
                </label>
                <select 
                  value={magPadChoice} 
                  onChange={(e) => setMagPadChoice(e.target.value)} 
                  className="w-full text-xs bg-[#131720] border border-[#2E3648] text-slate-200 p-1.5 rounded-lg outline-none"
                >
                  <option>After front cover</option>
                  <option>Before back cover</option>
                  <option>At the very end</option>
                </select>
              </div>
            )}
            
            {showHardCoverOptions && (
              <div className="p-3 bg-[#131720] rounded-lg border border-[#2E3648] flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="flyleaves" 
                  checked={addFlyleaves} 
                  onChange={(e) => setAddFlyleaves(e.target.checked)} 
                  className="rounded bg-[#1A202C] border-[#2E3648] text-indigo-500" 
                />
                <label htmlFor="flyleaves" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Insert 3 blank flyleaf endpapers
                </label>
              </div>
            )}

            {!taskId && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || files.length === 0}
                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center justify-center space-x-2 transition-colors shadow-sm"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={15} /> : <Eye size={15} />}
                <span>{isGenerating ? "Synthesizing Proof..." : "Generate Live Proof"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport Area */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-3.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 text-xs">
              {error}
            </div>
          )}

          {isGenerating && (
            <div className="bg-[#181D27] p-8 rounded-xl border border-[#242A38] flex flex-col items-center justify-center space-y-4 min-h-[460px]">
              <Loader2 className="animate-spin text-indigo-400" size={40} />
              <div className="text-sm font-semibold text-white">{statusMsg}</div>
              <div className="w-full max-w-sm bg-[#131720] rounded-full h-2 border border-[#2E3648] overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 font-mono">{progress}% Complete</div>
            </div>
          )}

          {!isGenerating && !resultUrl && (
            <div className="bg-[#181D27] p-8 rounded-xl border border-[#242A38] flex flex-col items-center justify-center min-h-[500px] text-slate-400">
              <BookOpen size={48} className="mb-3 opacity-30 text-indigo-400" />
              <p className="text-sm font-medium text-slate-300">Upload PDF to synthesize an interactive 3D proof</p>
              <p className="text-xs text-slate-400 mt-1">Simulates real paper turning physics & binding spine</p>
            </div>
          )}

          {!isGenerating && resultUrl && (
            <div className="bg-[#181D27] rounded-xl border border-[#242A38] flex flex-col min-h-[720px] h-[calc(100vh-140px)] overflow-hidden relative shadow-lg">
              <div className="p-2.5 border-b border-[#242A38] flex justify-between items-center bg-[#141822]">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <Layers size={14} className="text-indigo-400" />
                    <span>Live 3D Proofing Stage</span>
                  </span>
                  {isUpdating && (
                    <span className="text-xs text-indigo-400 flex items-center font-medium">
                      <Loader2 className="animate-spin mr-1.5" size={13} />
                      Updating Model...
                    </span>
                  )}
                </div>
              </div>
              <iframe 
                src={resultUrl} 
                className="w-full flex-1 border-none bg-[#0B0D12]" 
                allowFullScreen 
                title="Flipbook Preview" 
              />
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#181D27] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[#242A38] space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#242A38]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download size={18} className="text-emerald-400"/>
                <span>Export Digital Package</span>
              </h3>
              {!isExporting && (
                <button 
                  type="button"
                  onClick={() => setShowExportModal(false)} 
                  className="text-slate-400 hover:text-white"
                >
                  <X size={18}/>
                </button>
              )}
            </div>

            {exportError && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg border border-red-500/30">
                {exportError}
              </div>
            )}

            {!isExporting ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Export Image Resolution
                  </label>
                  <select 
                    value={exportDpi} 
                    onChange={(e) => setExportDpi(e.target.value)} 
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
                      checked={exportFormat === "zip"} 
                      onChange={() => setExportFormat("zip")} 
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
                      checked={exportFormat === "html"} 
                      onChange={() => setExportFormat("html")} 
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
                    onClick={() => setShowExportModal(false)} 
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleStartExport} 
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
                  <div className="text-sm font-semibold text-white mb-0.5">{exportStatus}</div>
                  <div className="text-xs text-slate-400">Rendering pages at {exportDpi} DPI</div>
                </div>
                <div className="w-full bg-[#131720] rounded-full h-2 border border-[#2E3648] overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{exportProgress}% Complete</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
