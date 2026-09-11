"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, Upload, Loader2, Download, Eye, RefreshCw, X, FileArchive, FileCode2 } from "lucide-react";

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
  const [dpi, setDpi] = useState("72"); // Default preview to 72 DPI for speed
  const [direction, setDirection] = useState("Left to Right (LTR)");
  const [bindingStyle, setBindingStyle] = useState("Soft Cover (Paperback)");
  const [magPadChoice, setMagPadChoice] = useState("At the very end");
  const [addFlyleaves, setAddFlyleaves] = useState(false);
  const [pageRange, setPageRange] = useState("");

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDpi, setExportDpi] = useState("150");
  const [exportZip, setExportZip] = useState(true);
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const prevBindingRef = useRef(bindingStyle);

  const runPreflight = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch("http://localhost:8000/api/preflight", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNumPages(data.data.num_pages);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setFiles(arr);
      runPreflight(arr);
      setTaskId(null);
      setResultUrl(null);
    }
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setResultUrl(null);
    setProgress(0);
    setStatusMsg("Uploading files...");

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
      const res = await fetch("http://localhost:8000/api/flipbook", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to start flipbook generation");
      const data = await res.json();
      setTaskId(data.task_id);
    } catch (err: any) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const handleInstantUpdate = async (overrideStates?: any) => {
    if (!taskId) return;
    setIsUpdating(true);
    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("direction", overrideStates?.direction ?? direction);
    formData.append("binding_style", overrideStates?.bindingStyle ?? bindingStyle);
    formData.append("bg_texture", "Dark Mode");
    formData.append("mag_pad_choice", overrideStates?.magPadChoice ?? magPadChoice);
    formData.append("add_flyleaves", String(overrideStates?.addFlyleaves ?? addFlyleaves));

    try {
      const res = await fetch("http://localhost:8000/api/flipbook/update", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResultUrl(`http://localhost:8000/flipbooks/${data.output.replace("public_flipbooks/", "")}?t=${Date.now()}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

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
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const handleStartExport = async () => {
    if (!taskId) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgress(0);
    setExportStatus("Preparing export...");

    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("dpi", exportDpi);
    formData.append("zip_output", String(exportZip));

    try {
      const res = await fetch("http://localhost:8000/api/flipbook/export", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to start export task");
      const data = await res.json();
      setExportTaskId(data.task_id);
    } catch (err: any) {
      setExportError(err.message);
      setIsExporting(false);
    }
  };

  // Poll for PREVIEW generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (taskId && isGenerating) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/tasks/${taskId}`);
          const data = await res.json();
          
          setProgress(data.progress);
          setStatusMsg(data.message || data.status);

          if (data.state === "SUCCESS") {
            clearInterval(interval);
            setIsGenerating(false);
            setResultUrl(`http://localhost:8000/flipbooks/${data.result.output.replace("public_flipbooks/", "")}`);
          } else if (data.state === "FAILURE") {
            clearInterval(interval);
            setIsGenerating(false);
            setError(data.status);
          }
        } catch (e) {
          console.error("Failed to poll status", e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [taskId, isGenerating]);

  // Poll for EXPORT generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (exportTaskId && isExporting) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/tasks/${exportTaskId}`);
          const data = await res.json();
          
          setExportProgress(data.progress);
          setExportStatus(data.message || data.status);

          if (data.state === "SUCCESS") {
            clearInterval(interval);
            setIsExporting(false);
            setExportTaskId(null);
            setShowExportModal(false);
            // Trigger actual download of the final file
            triggerDownload(`http://localhost:8000/flipbooks/${data.result.output.replace("public_flipbooks/", "")}`);
          } else if (data.state === "FAILURE") {
            clearInterval(interval);
            setIsExporting(false);
            setExportTaskId(null);
            setExportError(data.status);
          }
        } catch (e) {
          console.error("Failed to poll export status", e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [exportTaskId, isExporting]);

  // Auto-update preview when settings change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (taskId && !isGenerating && !isUpdating) {
      let currentFlyleaves = addFlyleaves;
      if (bindingStyle !== prevBindingRef.current) {
        if (bindingStyle !== "Hard Cover") {
          setAddFlyleaves(false);
          currentFlyleaves = false;
        }
        prevBindingRef.current = bindingStyle;
      }
      handleInstantUpdate({ addFlyleaves: currentFlyleaves });
    }
  }, [direction, bindingStyle, magPadChoice, addFlyleaves]);

  const showMagPadding = bindingStyle === "Magazine" && numPages > 0 && numPages % 4 !== 0;
  const showHardCoverOptions = bindingStyle === "Hard Cover";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center space-x-3 pb-4 border-b dark:border-gray-700">
        <BookOpen className="text-blue-500" size={32} />
        <div>
          <h1 className="text-2xl font-bold">Flipbook Studio</h1>
          <p className="text-sm text-gray-500">Convert PDFs into interactive 3D digital magazines.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="font-semibold text-lg border-b pb-2 dark:border-gray-700">Settings</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">Page Range</label>
              <input 
                type="text" 
                placeholder="e.g. 1-10 or leave blank for All" 
                value={pageRange} 
                onChange={(e) => setPageRange(e.target.value)} 
                disabled={!!taskId}
                className="w-full text-sm border p-2 rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 flex justify-between">
                <span>Files</span>
                {numPages > 0 && <span className="text-blue-500 text-xs">{numPages} pages</span>}
              </label>
              <input type="file" multiple accept="application/pdf" onChange={handleFileChange} className="w-full text-sm border p-2 rounded-md" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 flex justify-between">
                <span>Preview Quality (DPI)</span>
              </label>
              <select value={dpi} onChange={(e) => setDpi(e.target.value)} disabled={!!taskId} className="w-full border p-2 rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50">
                <option value="72">72 (Fastest Preview)</option>
                <option value="150">150 (Standard)</option>
              </select>
              {taskId && <p className="text-xs text-gray-500 mt-1">Re-upload to change preview DPI. High-res output is chosen during Download.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reading Direction</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full border p-2 rounded-md dark:bg-gray-700 dark:border-gray-600">
                <option>Left to Right (LTR)</option>
                <option>Right to Left (RTL)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Binding Style</label>
              <select value={bindingStyle} onChange={(e) => setBindingStyle(e.target.value)} className="w-full border p-2 rounded-md dark:bg-gray-700 dark:border-gray-600">
                <option>Soft Cover (Paperback)</option>
                <option>Hard Cover</option>
                <option>Magazine</option>
                <option>Spiral</option>
                <option>Plastic Comb</option>
                <option>Double Wire</option>
              </select>
            </div>
            
            {showMagPadding && (
              <div className="p-3 bg-blue-50 dark:bg-gray-700 rounded-md border border-blue-100 dark:border-gray-600 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">
                  ⚠️ Magazine Padding (Needs {4 - (numPages % 4)} blank pages)
                </label>
                <select value={magPadChoice} onChange={(e) => setMagPadChoice(e.target.value)} className="w-full text-sm border p-2 rounded-md">
                  <option>After front cover</option>
                  <option>Before back cover</option>
                  <option>At the very end</option>
                </select>
              </div>
            )}
            
            {showHardCoverOptions && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border dark:border-gray-600 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
                <input type="checkbox" id="flyleaves" checked={addFlyleaves} onChange={(e) => setAddFlyleaves(e.target.checked)} className="rounded" />
                <label htmlFor="flyleaves" className="text-sm font-medium">
                  Insert 3 blank flyleaves
                </label>
              </div>
            )}

            {!taskId && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || files.length === 0}
                className="w-full py-3 mt-4 bg-blue-600 text-white rounded-md font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Eye size={20} />}
                <span>{isGenerating ? "Generating Preview..." : "Generate Preview"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {isGenerating && (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <Loader2 className="animate-spin text-blue-500" size={48} />
              <div className="text-lg font-medium">{statusMsg}</div>
              <div className="w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="text-sm text-gray-500">{progress}% Complete</div>
            </div>
          )}

          {!isGenerating && !resultUrl && (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col items-center justify-center min-h-[500px] text-gray-400">
              <BookOpen size={64} className="mb-4 opacity-50" />
              <p>Upload PDFs to generate a fast Live Preview.</p>
            </div>
          )}

          {!isGenerating && resultUrl && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col h-[700px] overflow-hidden relative">
              <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center space-x-3">
                  <h3 className="font-medium flex items-center space-x-2"><Eye size={18} /> <span>Live Preview (Fast Mode)</span></h3>
                  {isUpdating && <span className="text-sm text-blue-500 flex items-center"><Loader2 className="animate-spin mr-1" size={14}/> Updating...</span>}
                </div>
                <button 
                  onClick={() => setShowExportModal(true)} 
                  className="px-5 py-2 bg-green-600 text-white rounded-md text-sm font-medium flex items-center space-x-2 hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Download size={16} />
                  <span>Export & Download</span>
                </button>
              </div>
              <iframe src={resultUrl} className="w-full flex-1 border-none bg-gray-950" allowFullScreen title="Flipbook Preview" />
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border dark:border-gray-700 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold flex items-center gap-2"><Download size={22} className="text-green-500"/> Export Flipbook</h3>
              {!isExporting && <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>}
            </div>

            {exportError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {exportError}
              </div>
            )}

            {!isExporting ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1">Output Resolution (DPI)</label>
                  <select value={exportDpi} onChange={(e) => setExportDpi(e.target.value)} className="w-full border p-2.5 rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <option value="72">72 (Smallest size, good for email)</option>
                    <option value="150">150 (Standard quality)</option>
                    <option value="300">300 (High-res, massive file size)</option>
                  </select>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg space-y-3">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="radio" checked={!exportZip} onChange={() => setExportZip(false)} className="mt-1" />
                    <div>
                      <div className="font-medium flex items-center gap-2"><FileCode2 size={16} className="text-blue-500"/> Standalone HTML File</div>
                      <div className="text-xs text-gray-500 mt-1">One massive Base64-encoded .html file. Easy to open, but can be too large for emails.</div>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="radio" checked={exportZip} onChange={() => setExportZip(true)} className="mt-1" />
                    <div>
                      <div className="font-medium flex items-center gap-2"><FileArchive size={16} className="text-orange-500"/> ZIP Archive (Recommended)</div>
                      <div className="text-xs text-gray-500 mt-1">Compresses the HTML file into a .zip. Drastically reduces file size for sharing.</div>
                    </div>
                  </label>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
                  <button onClick={handleStartExport} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium shadow-sm transition-colors">
                    Start Export
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center space-y-5">
                <Loader2 className="animate-spin text-green-500" size={48} />
                <div className="text-center">
                  <div className="text-lg font-medium mb-1">{exportStatus}</div>
                  <div className="text-sm text-gray-500">Generating standalone file at {exportDpi} DPI</div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                </div>
                <div className="text-xs text-gray-500 font-medium">{exportProgress}% Complete</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
