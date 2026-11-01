"use client";

import React, { useState } from "react";
import { FileText, Search, Loader2, CheckCircle2 } from "lucide-react";

export function OcrPanel() {
  const [selectedLanguage, setSelectedLanguage] = useState<"ara+eng" | "ara" | "eng">("ara+eng");
  const [generateSearchable, setGenerateSearchable] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedSnippet, setExtractedSnippet] = useState<string | null>(null);

  const handleRunOcr = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setExtractedSnippet("OCR Engine initialized for Arabic & English text detection.");
    }, 1200);
  };

  return (
    <div className="space-y-4 select-none">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[var(--text-secondary,#94A3B8)] block">
          Recognition Languages
        </label>
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-inset,#11151E)] p-1 rounded-lg border border-[var(--border-subtle,#242C3D)] text-xs">
          {[
            { id: "ara+eng", label: "Arabic + English" },
            { id: "ara", label: "العربية (Arabic)" },
            { id: "eng", label: "English" },
          ].map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setSelectedLanguage(lang.id as typeof selectedLanguage)}
              className={`py-1.5 rounded font-semibold text-center transition-colors cursor-pointer ${
                selectedLanguage === lang.id
                  ? "bg-[var(--surface-card,#181D27)] text-[var(--app-accent,#F59E0B)] shadow-xs"
                  : "text-[var(--text-muted,#64748B)] hover:text-[var(--text-primary,#F1F5F9)]"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-[var(--surface-card,#181D27)] border border-[var(--border-subtle,#242C3D)] space-y-2">
        <label className="flex items-center space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={generateSearchable}
            onChange={(e) => setGenerateSearchable(e.target.checked)}
            className="rounded bg-[var(--surface-inset,#11151E)] border-[var(--border-subtle,#242C3D)] text-[var(--app-accent,#F59E0B)]"
          />
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary,#F1F5F9)]">
              Searchable PDF Layer
            </div>
            <div className="text-[10px] text-[var(--text-muted,#64748B)]">
              Synthesizes an invisible OCR text layer during export
            </div>
          </div>
        </label>
      </div>

      <button
        type="button"
        onClick={handleRunOcr}
        disabled={isProcessing}
        className="w-full py-2 bg-[var(--app-accent-15)] hover:bg-[var(--app-accent-30)] text-[var(--app-accent,#F59E0B)] border border-[var(--app-accent-30)] rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span>Scanning Artwork...</span>
          </>
        ) : (
          <>
            <Search size={13} />
            <span>Inspect Page OCR</span>
          </>
        )}
      </button>

      {extractedSnippet && (
        <div className="p-2.5 rounded-lg bg-[var(--surface-inset,#11151E)] border border-[var(--border-subtle,#242C3D)] text-xs text-[var(--text-secondary,#94A3B8)] font-mono">
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted,#64748B)] mb-1">OCR Status</div>
          {extractedSnippet}
        </div>
      )}
    </div>
  );
}
