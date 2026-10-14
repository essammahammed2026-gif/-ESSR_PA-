"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Layers, Download } from "lucide-react";
import { apiFetch, getApiUrl } from "@/lib/api";
import { FlipbookControls } from "@/components/flipbook/FlipbookControls";
import { FlipbookViewport } from "@/components/flipbook/FlipbookViewport";
interface InstantSettings { direction: string; bindingStyle: string; magPadChoice: string; addFlyleaves: boolean; }
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const fd = (o: Record<string, string>) => { const d = new FormData(); for (const k of Object.keys(o)) d.append(k, o[k]); return d; };
function FlipbookStudioContent() {
const searchParams = useSearchParams();
const [files, setFiles] = useState<File[]>([]);
const [numPages, setNumPages] = useState<number>(0);
const [taskId, setTaskId] = useState<string | null>(null);
const [progress, setProgress] = useState(0);
const [statusMsg, setStatusMsg] = useState("");
const [isGenerating, setIsGenerating] = useState(false);
const [isUpdating, setIsUpdating] = useState(false);
const [resultUrl, setResultUrl] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
const [dpi, setDpi] = useState("72");
const [direction, setDirection] = useState("Left to Right (LTR)");
const [bindingStyle, setBindingStyle] = useState("Soft Cover (Paperback)");
const [magPadChoice, setMagPadChoice] = useState("At the very end");
const [addFlyleaves, setAddFlyleaves] = useState(false);
const [pageRange, setPageRange] = useState("");
const [showExportModal, setShowExportModal] = useState(false);
const [exportDpi, setExportDpi] = useState("150");
const [exportFormat, setExportFormat] = useState("zip");
const [exportTaskId, setExportTaskId] = useState<string | null>(null);
const [exportProgress, setExportProgress] = useState(0);
const [exportStatus, setExportStatus] = useState("");
const [isExporting, setIsExporting] = useState(false);
const [exportError, setExportError] = useState<string | null>(null);
const prevBindingRef = useRef(bindingStyle);
const lastApplied = useRef<InstantSettings>({ direction: "", bindingStyle: "", magPadChoice: "", addFlyleaves: false });
useEffect(() => { const fid = searchParams.get("file_id"); if (!fid || taskId || isGenerating || resultUrl) return; setIsGenerating(true); setProgress(15); setStatusMsg("Loading preloaded artwork into 3D Flipbook engine...");
apiFetch(`/api/flipbook`, { method: "POST", body: fd({ existing_file_id: fid, dpi: "72", direction, binding_style: bindingStyle, bg_texture: "Dark Mode", mag_pad_choice: "At the very end", add_flyleaves: "false", export_mode: "Folder Assets (Ultra-Fast & Light HTML)" }) }).then((r) => r.json()).then((j) => { if (j.task_id) setTaskId(j.task_id); else { setError(j.error || "Failed to initialize flipbook."); setIsGenerating(false); } }).catch((e: unknown) => { setError(errMsg(e, "Error initializing flipbook")); setIsGenerating(false); }); }, [searchParams, taskId, isGenerating, resultUrl, direction, bindingStyle]);
const runPreflight = async (s: File[]) => { if (s.length === 0) return; const d = new FormData(); s.forEach((f) => d.append("files", f));
try { const r = await apiFetch(`/api/preflight`, { method: "POST", body: d }); const j = await r.json(); if (j.success) setNumPages(j.data.num_pages); } catch { /* optional non-blocking preflight count */ } };
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; const a = Array.from(e.target.files); setFiles(a); runPreflight(a); setTaskId(null); setResultUrl(null); lastApplied.current = { direction: "", bindingStyle: "", magPadChoice: "", addFlyleaves: false }; };
const handleGenerate = async () => { if (files.length === 0) return; setIsGenerating(true); setError(null); setResultUrl(null); setProgress(0); setStatusMsg("Uploading artwork files...");
const d = new FormData(); files.forEach((f) => d.append("files", f)); Object.entries({ dpi, direction, binding_style: bindingStyle, bg_texture: "Dark Mode", mag_pad_choice: magPadChoice, add_flyleaves: String(addFlyleaves), export_mode: "Folder Assets (Ultra-Fast & Light HTML)", page_range: pageRange }).forEach(([k, v]) => d.append(k, v));
try { const r = await apiFetch(`/api/flipbook`, { method: "POST", body: d }); if (!r.ok) throw new Error("Failed to start flipbook generation"); setTaskId((await r.json()).task_id); } catch (e: unknown) { setError(errMsg(e, "Error generating preview")); setIsGenerating(false); } };
const handleInstantUpdate = useCallback(async (n: InstantSettings) => { if (!taskId) return; setIsUpdating(true);
try { const r = await apiFetch(`/api/flipbook/update`, { method: "POST", body: fd({ task_id: taskId, direction: n.direction, binding_style: n.bindingStyle, bg_texture: "Dark Mode", mag_pad_choice: n.magPadChoice, add_flyleaves: String(n.addFlyleaves) }) }); const j = await r.json();
if (j.success) setResultUrl(getApiUrl(`/flipbooks/${(j.output as string).replace("public_flipbooks/", "")}`) + `?t=${Date.now()}`); else setError(j.error || "Failed to update flipbook preview."); } catch (e: unknown) { setError(errMsg(e, "Error updating preview")); } finally { setIsUpdating(false); } }, [taskId]);
const triggerDownload = async (url: string) => { try { const b = await (await fetch(url)).blob(); const u = window.URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = url.split("/").pop() || "flipbook.zip"; document.body.appendChild(l); l.click(); document.body.removeChild(l); window.URL.revokeObjectURL(u); } catch { /* download error */ } };
const handleStartExport = async () => { if (!taskId) return; setIsExporting(true); setExportError(null); setExportProgress(0); setExportStatus("Preparing standalone digital package...");
try { const r = await apiFetch(`/api/flipbook/export`, { method: "POST", body: fd({ task_id: taskId, dpi: exportDpi, export_format: exportFormat }) }); if (!r.ok) throw new Error("Failed to start export task"); setExportTaskId((await r.json()).task_id); } catch (e: unknown) { setExportError(errMsg(e, "Failed to export")); setIsExporting(false); } };
useEffect(() => { let t: NodeJS.Timeout | undefined; if (taskId && isGenerating) { t = setInterval(async () => {
try { const j = await (await apiFetch(`/api/tasks/${taskId}`)).json(); setProgress(j.progress); setStatusMsg(j.message || j.status);
if (j.state === "SUCCESS") { if (t) clearInterval(t); setIsGenerating(false); lastApplied.current = { direction, bindingStyle, magPadChoice, addFlyleaves }; prevBindingRef.current = bindingStyle; setResultUrl(getApiUrl(`/flipbooks/${(j.result.output as string).replace("public_flipbooks/", "")}`)); }
else if (j.state === "FAILURE") { if (t) clearInterval(t); setIsGenerating(false); setError(j.status); } } catch { /* polling error */ } }, 1000); } return () => { if (t) clearInterval(t); }; }, [taskId, isGenerating, direction, bindingStyle, magPadChoice, addFlyleaves]);
useEffect(() => { let t: NodeJS.Timeout | undefined; if (exportTaskId && isExporting) { t = setInterval(async () => {
try { const j = await (await apiFetch(`/api/tasks/${exportTaskId}`)).json(); setExportProgress(j.progress); setExportStatus(j.message || j.status);
if (j.state === "SUCCESS") { if (t) clearInterval(t); setIsExporting(false); setExportTaskId(null); setShowExportModal(false); triggerDownload(getApiUrl(`/flipbooks/${(j.result.output as string).replace("public_flipbooks/", "")}`)); }
else if (j.state === "FAILURE") { if (t) clearInterval(t); setIsExporting(false); setExportTaskId(null); setExportError(j.status); } } catch { /* polling error */ } }, 1000); } return () => { if (t) clearInterval(t); }; }, [exportTaskId, isExporting]);
useEffect(() => { if (!taskId || isGenerating || !lastApplied.current.direction) return; let nf = addFlyleaves;
if (bindingStyle !== prevBindingRef.current) { if (bindingStyle !== "Hard Cover") { setAddFlyleaves(false); nf = false; } prevBindingRef.current = bindingStyle; }
const pr = lastApplied.current; if (pr.direction === direction && pr.bindingStyle === bindingStyle && pr.magPadChoice === magPadChoice && pr.addFlyleaves === nf) return;
lastApplied.current = { direction, bindingStyle, magPadChoice, addFlyleaves: nf }; handleInstantUpdate({ direction, bindingStyle, magPadChoice, addFlyleaves: nf }); }, [direction, bindingStyle, magPadChoice, addFlyleaves, taskId, isGenerating, handleInstantUpdate]);
const showMagPadding = bindingStyle === "Magazine" && numPages > 0 && numPages % 4 !== 0; const showHardCoverOptions = bindingStyle === "Hard Cover";
return (
<div className="w-full space-y-3 pb-4">
<div className="flex items-center space-x-2 text-xs text-slate-400 pb-1"><Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Home</Link><span>/</span><span className="text-white font-medium">Flipbook Studio</span></div>
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#242A38]">
<div className="flex items-center space-x-2.5"><Layers className="text-indigo-400" size={20} /><h1 className="text-base md:text-lg font-bold tracking-tight text-white">Flipbook Studio</h1><span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">HTML5 3D Proof</span><span className="hidden xl:inline text-xs text-slate-400 border-l border-[#242A38] pl-2.5">Convert print PDFs into realistic 3D virtual publications for digital soft-proofing</span></div>
{resultUrl && !isGenerating && (<button type="button" onClick={() => setShowExportModal(true)} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm self-start sm:self-auto shrink-0"><Download size={14} /><span>Export & Download</span></button>)}
</div>
<div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
<FlipbookControls files={files} numPages={numPages} taskId={taskId} isGenerating={isGenerating} dpi={dpi} direction={direction} bindingStyle={bindingStyle} magPadChoice={magPadChoice} addFlyleaves={addFlyleaves} pageRange={pageRange} showMagPadding={showMagPadding} showHardCoverOptions={showHardCoverOptions} onFileChange={handleFileChange} onPageRangeChange={setPageRange} onDpiChange={setDpi} onDirectionChange={setDirection} onBindingChange={setBindingStyle} onMagPadChange={setMagPadChoice} onFlyleavesChange={setAddFlyleaves} onGenerate={handleGenerate} showExportModal={showExportModal} exportDpi={exportDpi} exportFormat={exportFormat} isExporting={isExporting} exportError={exportError} exportStatus={exportStatus} exportProgress={exportProgress} onCloseExport={() => setShowExportModal(false)} onExportDpiChange={setExportDpi} onExportFormatChange={setExportFormat} onStartExport={handleStartExport} />
<FlipbookViewport error={error} isGenerating={isGenerating} statusMsg={statusMsg} progress={progress} resultUrl={resultUrl} isUpdating={isUpdating} />
</div>
</div>
);
}
export default function FlipbookStudio() {
return (<Suspense fallback={<div className="p-6 text-xs text-slate-400">Loading Flipbook Studio...</div>}><FlipbookStudioContent /></Suspense>);
}
