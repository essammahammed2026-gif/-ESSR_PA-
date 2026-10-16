"use client";

import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import type { BookStudioPage } from "@/types/book_studio";

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  pages: BookStudioPage[];
  selectedPageId: string | null;
}

export interface UseBookHistoryArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
  clearPageCrops?: (ids?: string[]) => void;
  maxLimit?: number;
}

export function useBookHistory({
  sessionId,
  setPages,
  setSelectedPageId,
  clearPageCrops,
  maxLimit = 50,
}: UseBookHistoryArgs) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isSyncingRef = useRef(false);

  // Sync state to backend
  const syncToBackend = useCallback(async (pagesToRestore: BookStudioPage[]) => {
    if (!sessionId) return;
    try {
      await apiFetch(`/api/book-scan/restore-pages/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pagesToRestore }),
      });
    } catch (err) {
      console.error("Failed to sync restored snapshot to backend:", err);
    }
  }, [sessionId]);

  // Initialize or reset history when a session opens
  const initHistory = useCallback((initialPages: BookStudioPage[], initialSelectedId: string | null = null) => {
    const entry: HistoryEntry = {
      id: "step_0",
      label: "Original Document",
      timestamp: Date.now(),
      pages: structuredClone(initialPages),
      selectedPageId: initialSelectedId,
    };
    setHistory([entry]);
    setCurrentIndex(0);
  }, []);

  // Record a new modification step
  const recordStep = useCallback((label: string, nextPages: BookStudioPage[], nextSelectedId?: string | null) => {
    setHistory((prev) => {
      // Prune future redo steps from current pointer
      const validBase = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : prev;
      const newEntry: HistoryEntry = {
        id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label,
        timestamp: Date.now(),
        pages: structuredClone(nextPages),
        selectedPageId: nextSelectedId ?? null,
      };

      const combined = [...validBase, newEntry];
      // Keep Original (index 0) anchor + last (maxLimit - 1) items
      if (combined.length > maxLimit && combined.length > 2) {
        const original = combined[0];
        const recent = combined.slice(-(maxLimit - 1));
        const pruned = [original, ...recent];
        setCurrentIndex(pruned.length - 1);
        return pruned;
      }

      setCurrentIndex(combined.length - 1);
      return combined;
    });
  }, [currentIndex, maxLimit]);

  // Jump directly to any historical snapshot
  const jumpToStep = useCallback(async (index: number) => {
    if (index < 0 || index >= history.length || index === currentIndex) return;
    const target = history[index];
    if (!target) return;

    isSyncingRef.current = true;
    setCurrentIndex(index);
    setPages(structuredClone(target.pages));
    if (target.selectedPageId) {
      setSelectedPageId(target.selectedPageId);
    } else if (target.pages.length > 0) {
      setSelectedPageId(target.pages[0].id);
    }
    clearPageCrops?.();

    await syncToBackend(target.pages);
    isSyncingRef.current = false;
  }, [history, currentIndex, setPages, setSelectedPageId, clearPageCrops, syncToBackend]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      jumpToStep(currentIndex - 1);
    }
  }, [currentIndex, jumpToStep]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      jumpToStep(currentIndex + 1);
    }
  }, [currentIndex, history.length, jumpToStep]);

  const revertToOriginal = useCallback(() => {
    if (history.length > 0 && currentIndex !== 0) {
      jumpToStep(0);
    }
  }, [history.length, currentIndex, jumpToStep]);

  const resetHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    history,
    currentIndex,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1 && currentIndex >= 0,
    initHistory,
    recordStep,
    jumpToStep,
    undo,
    redo,
    revertToOriginal,
    resetHistory,
  };
}
