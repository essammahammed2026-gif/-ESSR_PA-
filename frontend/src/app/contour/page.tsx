"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { apiFetch, getApiUrl, downloadBlob } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { ContourControls, DetectedProfile } from "@/components/contour/ContourControls";
import dynamic from "next/dynamic";

const ContourViewport = dynamic(
  () => import("@/components/contour/ContourViewport").then((mod) => mod.ContourViewport),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#0d1017] text-slate-500 text-xs font-mono">
        Loading contour viewport...
      </div>
    ),
  }
);

function ContourStudioContent() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProfile, setDetectedProfile] = useState<DetectedProfile | null>(null);
  const [offsetVal, setOffsetVal] = useState("0");
  const [threshold, setThreshold] = useState("20");
  const [smoothing, setSmoothing] = useState("2");
  const [keepHoles, setKeepHoles] = useState(false);
  const [addWhiteMatte, setAddWhiteMatte] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FF00FF");
  const [artworkOpacity, setArtworkOpacity] = useState("100");
  const isFirstRender = useRef(true);
  const lastGeneratedKey = useRef<string | null>(null);
  const searchParams = useSearchParams();

  const generateContour = useCallback(async (id: string, offset: string, thresh: string, smooth: string, holes: boolean, matte: boolean, color: string) => {
    setIsGenerating(true);
    setError(null);
    const formData = new FormData();
    formData.append("file_id", id);
    formData.append("offset_val", offset);
    formData.append("threshold", thresh);
    formData.append("smoothing_factor", smooth);
    formData.append("keep_holes", String(holes));
    formData.append("add_white_matte", String(matte));
    formData.append("stroke_color", color);
    try {
      const res = await apiFetch(`/api/contour/generate`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        // Ensure relative asset URLs in SVG point to the centralized API
        const displaySvg = (data.svg as string).replace(
          /(href|xlink:href)\s*=\s*["'](\/(?:temp_uploads|storage\/cache)\/[^"']+)["']/g,
          (_match, attr, path) => `${attr}="${getApiUrl(path)}"`
        );
        setSvgContent(displaySvg);
      } else {
        setError(data.error || "Failed to generate die-cut path.");
      }
    } catch {
      setError("Network error communicating with die-cut engine.");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Preload artwork if routed from Hub
  useEffect(() => {
    const fileIdParam = searchParams.get("file_id");
    if (fileIdParam && !fileId) {
      setFileId(fileIdParam);
      generateContour(fileIdParam, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
    }
  }, [searchParams, generateContour, fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    // Reset file input value so user can re-upload or upload the same file
    e.target.value = "";
    // Reset UI canvas state (pan/zoom resets inside ContourViewport on fileId change)
    setArtworkOpacity("100");
    setSvgContent(null);
    setError(null);
    setIsGenerating(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch(`/api/contour/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setFileId(data.file_id);
        // Configure options to fit the uploaded image
        const suggested = data.suggested_options || {};
        const nextOffset = String(suggested.offset_val ?? "0");
        const nextThreshold = String(suggested.threshold ?? "20");
        const nextSmoothing = String(suggested.smoothing_factor ?? "2");
        const nextKeepHoles = Boolean(suggested.keep_holes ?? false);
        const nextAddWhiteMatte = Boolean(suggested.add_white_matte ?? false);
        const nextStrokeColor = String(suggested.stroke_color ?? "#FF00FF");
        setOffsetVal(nextOffset);
        setThreshold(nextThreshold);
        setSmoothing(nextSmoothing);
        setKeepHoles(nextKeepHoles);
        setAddWhiteMatte(nextAddWhiteMatte);
        setStrokeColor(nextStrokeColor);
        setDetectedProfile({
          width: data.width || 0,
          height: data.height || 0,
          hasAlpha: Boolean(data.has_alpha),
          bgType: data.bg_type || "unknown",
          suggestedOptions: {
            offset_val: nextOffset, threshold: nextThreshold, smoothing_factor: nextSmoothing,
            keep_holes: nextKeepHoles, add_white_matte: nextAddWhiteMatte, stroke_color: nextStrokeColor,
          },
        });
        // Mark key so debounced effect doesn't perform a duplicate run
        const generatedKey = `${data.file_id}_${nextOffset}_${nextThreshold}_${nextSmoothing}_${nextKeepHoles}_${nextAddWhiteMatte}_${nextStrokeColor}`;
        lastGeneratedKey.current = generatedKey;
        // Immediately trigger contour generation with the new image & auto-fitted options
        generateContour(data.file_id, nextOffset, nextThreshold, nextSmoothing, nextKeepHoles, nextAddWhiteMatte, nextStrokeColor);
      } else {
        setError(data.error || "Artwork upload failed.");
        setIsGenerating(false);
      }
    } catch {
      setError("Failed to upload artwork to prepress engine.");
      setIsGenerating(false);
    }
  };

  const handleResetToAuto = () => {
    if (!detectedProfile) return;
    const opt = detectedProfile.suggestedOptions;
    setOffsetVal(opt.offset_val);
    setThreshold(opt.threshold);
    setSmoothing(opt.smoothing_factor);
    setKeepHoles(opt.keep_holes);
    setAddWhiteMatte(opt.add_white_matte);
    setStrokeColor(opt.stroke_color);
  };

  // Debounced auto-recalculation key (350ms via shared hook — fix.md Phase 2.5)
  const debouncedContourKey = useDebounce(
    `${fileId}_${offsetVal}_${threshold}_${smoothing}_${keepHoles}_${addWhiteMatte}_${strokeColor}`,
    350
  );
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!fileId) return;
    if (lastGeneratedKey.current === debouncedContourKey) {
      return;
    }
    lastGeneratedKey.current = debouncedContourKey;
    generateContour(fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
  }, [debouncedContourKey, fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor, generateContour]);

  const handleGenerate = () => {
    if (!fileId || isGenerating) return;
    const key = `${fileId}_${offsetVal}_${threshold}_${smoothing}_${keepHoles}_${addWhiteMatte}_${strokeColor}`;
    lastGeneratedKey.current = key;
    generateContour(fileId, offsetVal, threshold, smoothing, keepHoles, addWhiteMatte, strokeColor);
  };

  const handleDownload = async () => {
    if (!fileId) return;
    // Download production SVG with full embedded artwork from the server export endpoint
    const params = new URLSearchParams({
      file_id: fileId, offset_val: offsetVal, threshold: threshold,
      smoothing_factor: smoothing, stroke_color: strokeColor,
      keep_holes: String(keepHoles), add_white_matte: String(addWhiteMatte),
    });
    try {
      await downloadBlob(`/api/contour/export?${params}`, `cut_contour_${Date.now()}.svg`);
    } catch {
      setError("Failed to export production SVG.");
    }
  };

  return (
    <StudioLayout
      title="Contour Cut Studio"
      breadcrumbs={
        fileId
          ? [{ label: searchParams.get("name") || "Die-Cut Artwork" }]
          : undefined
      }
      statusBadge={
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700/50">
          Die-Line Vector
        </span>
      }
      headerActions={
        svgContent ? (
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors shadow-sm self-start sm:self-auto shrink-0"
          >
            <Download size={14} />
            <span>Export CutContour SVG</span>
          </button>
        ) : undefined
      }
      error={error}
      leftLabel="Controls"
      leftPanel={
        <ContourControls
          offsetVal={offsetVal} setOffsetVal={setOffsetVal}
          threshold={threshold} setThreshold={setThreshold}
          smoothing={smoothing} setSmoothing={setSmoothing}
          keepHoles={keepHoles} setKeepHoles={setKeepHoles}
          addWhiteMatte={addWhiteMatte} setAddWhiteMatte={setAddWhiteMatte}
          strokeColor={strokeColor} setStrokeColor={setStrokeColor}
          detectedProfile={detectedProfile}
          fileId={fileId} svgContent={svgContent} isGenerating={isGenerating}
          handleFileUpload={handleFileUpload} handleGenerate={handleGenerate}
          handleDownload={handleDownload} handleResetToAuto={handleResetToAuto}
        />
      }
      centerViewport={
        <ContourViewport
          fileId={fileId} svgContent={svgContent} isGenerating={isGenerating}
          artworkOpacity={artworkOpacity} setArtworkOpacity={setArtworkOpacity}
        />
      }
    />
  );
}

export default function ContourStudio() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#12151B] text-slate-400 text-xs font-mono">
          Loading Contour Studio...
        </div>
      }
    >
      <ContourStudioContent />
    </Suspense>
  );
}
