"use client";

import { useState, useCallback, useRef } from "react";

export interface StudioHistoryEntry<T> {
  id: string;
  label: string;
  timestamp: number;
  state: T;
}

export interface UseStudioHistoryOptions<T> {
  maxLimit?: number;
  onStepRestored?: (entry: StudioHistoryEntry<T>) => void;
}

/**
 * Universal snapshot-based undo/redo history engine.
 * Maintains an immutable snapshot stack with depth limits, canUndo/canRedo indicators,
 * and arbitrary step jumping (e.g. for visual timeline popovers).
 */
export function useStudioHistory<T>(
  initialState?: T,
  initialLabel: string = "Initial State",
  options: UseStudioHistoryOptions<T> = {}
) {
  const { maxLimit = 50, onStepRestored } = options;
  const onStepRestoredRef = useRef(onStepRestored);
  onStepRestoredRef.current = onStepRestored;

  const [history, setHistory] = useState<StudioHistoryEntry<T>[]>(() => {
    if (initialState !== undefined) {
      return [
        {
          id: "step_0",
          label: initialLabel,
          timestamp: Date.now(),
          state: structuredClone(initialState),
        },
      ];
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    initialState !== undefined ? 0 : -1
  );

  const isRestoringRef = useRef(false);

  const initHistory = useCallback((state: T, label: string = "Initial State") => {
    const entry: StudioHistoryEntry<T> = {
      id: "step_0",
      label,
      timestamp: Date.now(),
      state: structuredClone(state),
    };
    setHistory([entry]);
    setCurrentIndex(0);
  }, []);

  const recordStep = useCallback(
    (label: string, state: T) => {
      if (isRestoringRef.current) return;

      setHistory((prev) => {
        // Truncate any future redo steps
        const validHistory = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : [];

        const newEntry: StudioHistoryEntry<T> = {
          id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          label,
          timestamp: Date.now(),
          state: structuredClone(state),
        };

        const updated = [...validHistory, newEntry];
        if (updated.length > maxLimit) {
          return updated.slice(updated.length - maxLimit);
        }
        return updated;
      });

      setCurrentIndex((prev) => {
        const next = Math.min(prev + 1, maxLimit - 1);
        return next;
      });
    },
    [currentIndex, maxLimit]
  );

  const jumpToStep = useCallback(
    (index: number): T | null => {
      if (index < 0 || index >= history.length) return null;
      const target = history[index];
      if (!target) return null;

      isRestoringRef.current = true;
      setCurrentIndex(index);
      const clonedState = structuredClone(target.state);

      onStepRestoredRef.current?.(target);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 50);

      return clonedState;
    },
    [history]
  );

  const undo = useCallback((): T | null => {
    if (currentIndex <= 0) return null;
    return jumpToStep(currentIndex - 1);
  }, [currentIndex, jumpToStep]);

  const redo = useCallback((): T | null => {
    if (currentIndex >= history.length - 1) return null;
    return jumpToStep(currentIndex + 1);
  }, [currentIndex, history.length, jumpToStep]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const currentStep = currentIndex >= 0 ? history[currentIndex] : null;

  return {
    history,
    currentIndex,
    currentStep,
    canUndo,
    canRedo,
    initHistory,
    recordStep,
    jumpToStep,
    undo,
    redo,
  };
}
