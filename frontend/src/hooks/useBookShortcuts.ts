"use client";

import { useEffect, useCallback, useMemo } from "react";

export interface BookShortcutHandlers {
  undo?: () => void;
  redo?: () => void;
  restoreOriginal?: () => void;
  prevPage?: () => void;
  nextPage?: () => void;
  toggleOriginal?: () => void;
  rotateCW?: () => void;
  deletePage?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
  togglePan?: () => void;
}

export interface UseBookShortcutsArgs {
  handlers: BookShortcutHandlers;
  shortcuts?: Record<string, string>;
  enabled?: boolean;
}

export const DEFAULT_BOOK_SHORTCUTS: Record<string, string> = {
  undo: "ctrl+z",
  redo: "ctrl+y",
  restore_original: "ctrl+shift+r",
  prev_page: "[",
  next_page: "]",
  toggle_original: "o",
  rotate: "r",
  zoom_in: "=",
  zoom_out: "-",
  zoom_reset: "ctrl+0",
  pan: "h",
};

export function useBookShortcuts({
  handlers,
  shortcuts = DEFAULT_BOOK_SHORTCUTS,
  enabled = true,
}: UseBookShortcutsArgs) {
  const activeShortcuts = useMemo(
    () => ({ ...DEFAULT_BOOK_SHORTCUTS, ...shortcuts }),
    [shortcuts]
  );

  const formatCombo = useCallback((action: string): string => {
    const raw = activeShortcuts[action] || DEFAULT_BOOK_SHORTCUTS[action] || "";
    if (!raw) return "";
    return raw
      .split("+")
      .map((p) => (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
      .join("+");
  }, [activeShortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when typing in inputs or textareas
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");

      let keyName = e.key.toLowerCase();
      if (keyName === " ") keyName = "space";
      else if (keyName === "arrowleft") keyName = "left";
      else if (keyName === "arrowright") keyName = "right";
      else if (keyName === "arrowup") keyName = "up";
      else if (keyName === "arrowdown") keyName = "down";

      parts.push(keyName);
      const combo = parts.join("+");

      // Match actions
      if (combo === activeShortcuts.undo && handlers.undo) {
        e.preventDefault();
        handlers.undo();
      } else if (
        (combo === activeShortcuts.redo || combo === "ctrl+shift+z") &&
        handlers.redo
      ) {
        e.preventDefault();
        handlers.redo();
      } else if (combo === activeShortcuts.restore_original && handlers.restoreOriginal) {
        e.preventDefault();
        handlers.restoreOriginal();
      } else if (combo === activeShortcuts.prev_page && handlers.prevPage) {
        e.preventDefault();
        handlers.prevPage();
      } else if (combo === activeShortcuts.next_page && handlers.nextPage) {
        e.preventDefault();
        handlers.nextPage();
      } else if (combo === activeShortcuts.toggle_original && handlers.toggleOriginal) {
        e.preventDefault();
        handlers.toggleOriginal();
      } else if (combo === activeShortcuts.rotate && handlers.rotateCW) {
        e.preventDefault();
        handlers.rotateCW();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, activeShortcuts, handlers]);

  return { formatCombo };
}
