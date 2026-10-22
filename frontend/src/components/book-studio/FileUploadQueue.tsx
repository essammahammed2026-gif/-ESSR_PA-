"use client";

import React, { useRef } from "react";
import { Upload, FileText, ImageIcon, ChevronUp, ChevronDown, Trash2, Plus, Sparkles, RefreshCw } from "lucide-react";

interface FileUploadQueueProps {
  files: File[];
  onAddFiles: (newFiles: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  reverseFileIndices?: number[];
  onToggleReverse?: (index: number) => void;
  onClear: () => void;
  onCombineAndOpen: () => void;
  isInitializing: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "tiff", "tif", "bmp"].includes(ext || "")) {
    return <ImageIcon size={15} className="shrink-0 text-amber-400" />;
  }
  return <FileText size={15} className="shrink-0 text-cyan-400" />;
}

export function FileUploadQueue({
  files,
  onAddFiles,
  onRemoveFile,
  onMoveUp,
  onMoveDown,
  reverseFileIndices = [],
  onToggleReverse,
  onClear,
  onCombineAndOpen,
  isInitializing,
}: FileUploadQueueProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3.5">
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

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="p-4 rounded-xl border border-dashed border-[#2E3648] hover:border-slate-500 bg-[#131720]/40 hover:bg-[#131720]/70 cursor-pointer text-center transition-all group"
      >
        <Upload size={20} className="mx-auto mb-1.5 group-hover:scale-110 transition-transform" style={{ color: "var(--app-accent, #f59e0b)" }} />
        <div className="text-xs font-semibold text-slate-200">
          {files.length === 0 ? "Drop Files or Click to Add" : "Add More Parts"}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          PDFs or scan image batches (PNG, JPG, TIFF)
        </div>
      </div>

      {/* Queue List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span className="font-semibold text-slate-300">
              Parts to Combine ({files.length})
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
            {files.map((file, idx) => {
              const isReversed = reverseFileIndices.includes(idx);
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="p-2 rounded-lg bg-[#131720] border border-[#242A38] flex items-center justify-between space-x-2 text-xs"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="w-4 text-center text-[10px] font-mono text-slate-500 shrink-0">
                      {idx + 1}
                    </span>
                    {getFileIcon(file.name)}
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-200 font-medium truncate text-[11px]" title={file.name}>{file.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-2">
                        <span>{formatBytes(file.size)}</span>
                        {isReversed && (
                          <span className="text-[9px] text-amber-400 font-sans font-semibold">
                            (Reversed)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-0.5 shrink-0">
                    {onToggleReverse && (
                      <button
                        type="button"
                        onClick={() => onToggleReverse(idx)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                          isReversed
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-[#181D27] text-slate-400 border-[#2E3648] hover:text-slate-200 hover:bg-slate-800"
                        }`}
                        title="Reverse page sequence for this part"
                      >
                        Rev
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveUp(idx)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === files.length - 1}
                      onClick={() => onMoveDown(idx)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(idx)}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 ml-0.5 cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-[#131720] hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] border border-[#2E3648] transition-colors cursor-pointer"
          >
            <Plus size={12} style={{ color: "var(--app-accent, #f59e0b)" }} />
            <span>Add More Files</span>
          </button>
        </div>
      )}

      {/* Combine & Open CTA */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onCombineAndOpen}
          disabled={files.length === 0 || isInitializing}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
          style={
            !(files.length === 0 || isInitializing)
              ? { backgroundColor: "var(--app-accent, #f59e0b)", color: "var(--app-accent-fg, #0f172a)" }
              : undefined
          }
        >
          {isInitializing ? (
            <>
              <RefreshCw className="animate-spin" size={13} />
              <span>Combining & Opening Studio...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>
                {files.length > 1 ? `Combine ${files.length} Files & Open Studio` : "Open in Studio"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
