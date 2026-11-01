"use client";

import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import type {
  BookStudioPage,
  CropModuleConfig,
  CropBox,
  SplitLine,
  DeskewModuleConfig,
  CleanupModuleConfig,
  RestorationModuleConfig,
  BleedModuleConfig,
} from "@/types/book_studio";

export interface ModulesSnapshot {
  cropModule: CropModuleConfig;
  pageCrops: Record<string, { cropBox: CropBox; splitPos: number; splitLines: SplitLine[] }>;
  deskewModule: DeskewModuleConfig;
  cleanupModule: CleanupModuleConfig;
  restorationModule: RestorationModuleConfig;
  bleedModule: BleedModuleConfig;
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  pages: BookStudioPage[];
  selectedPageId: string | null;
  modulesSnapshot?: ModulesSnapshot;
}

export interface UseBookHistoryArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
  clearPageCrops?: (ids?: string[]) => void;
  getModulesSnapshot?: () => ModulesSnapshot;
  onRestoreModules?: (snapshot: ModulesSnapshot) => void;
  onStepRestored?: (target: HistoryEntry) => void;
  maxLimit?: number;
}

export function useBookHistory({
  sessionId,
  setPages,
  setSelectedPageId,
  clearPageCrops,
  getModulesSnapshot,
  onRestoreModules,
  onStepRestored,
  maxLimit = 50,
}: UseBookHistoryArgs) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isSyncingRef = useRef(false);
  const getModulesSnapshotRef = useRef(getModulesSnapshot);
  getModulesSnapshotRef.current = getModulesSnapshot;
  const onRestoreModulesRef = useRef(onRestoreModules);
  onRestoreModulesRef.current = onRestoreModules;

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
  const initHistory = useCallback((
    initialPages: BookStudioPage[],
    initialSelectedId: string | null = null,
    snapshotOverride?: ModulesSnapshot
  ) => {
    const snap = snapshotOverride ?? getModulesSnapshotRef.current?.();
    const entry: HistoryEntry = {
      id: "step_0",
      label: "Original Document",
      timestamp: Date.now(),
      pages: structuredClone(initialPages),
      selectedPageId: initialSelectedId,
      modulesSnapshot: snap ? structuredClone(snap) : undefined,
    };
    setHistory([entry]);
    setCurrentIndex(0);
  }, []);

  // Record a new modification step
  const recordStep = useCallback((
    label: string,
    nextPages: BookStudioPage[],
    nextSelectedId?: string | null,
    snapshotOverride?: ModulesSnapshot
  ) => {
    const snap = snapshotOverride ?? getModulesSnapshotRef.current?.();
    const clonedPages = structuredClone(nextPages);
    const clonedSnap = snap ? structuredClone(snap) : undefined;
    setHistory((prev) => {
      // Prune future redo steps from current pointer
      const validBase = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : prev;
      const newEntry: HistoryEntry = {
        id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label,
        timestamp: Date.now(),
        pages: clonedPages,
        selectedPageId: nextSelectedId ?? null,
        modulesSnapshot: clonedSnap,
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
    const bumpedPages = target.pages.map((p) => ({
      ...p,
      rev: (p.rev ?? 0) + 1,
    }));
    setPages(bumpedPages);
    if (target.selectedPageId) {
      setSelectedPageId(target.selectedPageId);
    } else if (bumpedPages.length > 0) {
      setSelectedPageId(bumpedPages[0].id);
    }
    if (target.modulesSnapshot && onRestoreModulesRef.current) {
      onRestoreModulesRef.current(structuredClone(target.modulesSnapshot));
    } else {
      clearPageCrops?.();
      onStepRestored?.(target);
    }

    await syncToBackend(bumpedPages);
    isSyncingRef.current = false;
  }, [history, currentIndex, setPages, setSelectedPageId, clearPageCrops, onStepRestored, syncToBackend]);

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
