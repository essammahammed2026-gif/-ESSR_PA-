"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Plus, Sparkles, RefreshCw, X } from "lucide-react";

interface StagedIntakeDropzoneProps {
  stagedFiles: File[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onUploadBatch: () => void;
  isUploading: boolean;
  hasStagedAssets?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "tiff", "tif", "bmp"].includes(ext || "")) {
    return <ImageIcon size={14} className="shrink-0 text-amber-400" />;
  }
  return <FileText size={14} className="shrink-0 text-cyan-400" />;
}

export function StagedIntakeDropzone({
  stagedFiles,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onUploadBatch,
  isUploading,
  hasStagedAssets = false,
}: StagedIntakeDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="bg-[#181D27] border border-[#242A38] rounded-xl p-3.5 space-y-3 shadow-lg">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,image/*,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAddFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Dropzone bar (adaptive: sleek compact strip when assets exist, expansive when empty) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border border-dashed transition-all cursor-pointer text-center group ${
          hasStagedAssets && stagedFiles.length === 0
            ? "p-2.5 bg-[#131720]/50 hover:bg-[#131720]"
            : "p-3.5 bg-[#131720]/60 hover:bg-[#131720]"
        } ${
          isDragOver
            ? "border-cyan-400 bg-cyan-950/20"
            : "border-[#2E3648] hover:border-slate-500"
        }`}
      >
        {hasStagedAssets && stagedFiles.length === 0 ? (
          <div className="flex items-center justify-center space-x-2 text-xs">
            <Upload
              size={15}
              className="group-hover:scale-110 transition-transform"
              style={{ color: "var(--app-accent, #06b6d4)" }}
            />
            <span className="font-semibold text-slate-300 group-hover:text-white transition-colors">
              Drop artwork files or click to stage batch intake
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              &bull; PDFs or scan images
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2.5">
            <Upload
              size={18}
              className="group-hover:scale-110 transition-transform"
              style={{ color: "var(--app-accent, #06b6d4)" }}
            />
            <div className="text-left">
              <span className="text-xs font-semibold text-slate-200">
                {stagedFiles.length === 0
                  ? "Drop Artwork Files or Click to Stage"
                  : "Add More Files to Stage"}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Drop one or multiple PDFs / scan images without immediate processing
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Staged Files Queue Preview */}
      {stagedFiles.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#242A38]/60">
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="text-slate-300 font-medium">
              Staged for Intake ({stagedFiles.length} file{stagedFiles.length > 1 ? "s" : ""} &bull; {formatBytes(totalBytes)})
            </span>
            <button
              type="button"
              onClick={onClearFiles}
              disabled={isUploading}
              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
            >
              <X size={11} />
              <span>Clear</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
            {stagedFiles.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1.5 text-xs group"
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  {getFileIcon(f.name)}
                  <span className="truncate text-slate-200 text-[11px] font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {formatBytes(f.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  disabled={isUploading}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors ml-1 cursor-pointer disabled:opacity-50"
                  title="Remove staged file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#131720] hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-[#2E3648] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus size={12} />
              <span>Add More</span>
            </button>

            <button
              type="button"
              onClick={onUploadBatch}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: "var(--app-accent, #06b6d4)",
                color: "var(--app-accent-fg, #0f172a)",
              }}
            >
              {isUploading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Uploading &amp; Probing Geometry...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Upload &amp; Stage {stagedFiles.length} File{stagedFiles.length > 1 ? "s" : ""}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
