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
  toggleStraighten?: () => void;
  toggleMaskTool?: () => void;
  toggleCropTool?: () => void;
  addCutLine?: () => void;
  toggleGrid?: () => void;
  toggleEyedropper?: () => void;
  detectPage?: () => void;
  detectAll?: () => void;
  applyAction?: () => void;
  focusModule?: (moduleIndex: number) => void;
  exitModule?: () => void;
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
  straighten_tool: "s",
  mask_tool: "m",
  crop_toggle: "c",
  add_cut: "x",
  grid_toggle: "g",
  eyedropper: "i",
  detect_page: "a",
  detect_all: "shift+a",
  apply_action: "enter",
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
      } else if (combo === activeShortcuts.straighten_tool && handlers.toggleStraighten) {
        e.preventDefault();
        handlers.toggleStraighten();
      } else if (combo === activeShortcuts.mask_tool && handlers.toggleMaskTool) {
        e.preventDefault();
        handlers.toggleMaskTool();
      } else if (combo === activeShortcuts.crop_toggle && handlers.toggleCropTool) {
        e.preventDefault();
        handlers.toggleCropTool();
      } else if (combo === activeShortcuts.add_cut && handlers.addCutLine) {
        e.preventDefault();
        handlers.addCutLine();
      } else if (combo === activeShortcuts.grid_toggle && handlers.toggleGrid) {
        e.preventDefault();
        handlers.toggleGrid();
      } else if (combo === activeShortcuts.eyedropper && handlers.toggleEyedropper) {
        e.preventDefault();
        handlers.toggleEyedropper();
      } else if (combo === activeShortcuts.detect_page && handlers.detectPage) {
        e.preventDefault();
        handlers.detectPage();
      } else if (combo === activeShortcuts.detect_all && handlers.detectAll) {
        e.preventDefault();
        handlers.detectAll();
      } else if (combo === activeShortcuts.apply_action && handlers.applyAction) {
        e.preventDefault();
        handlers.applyAction();
      } else if (["1", "2", "3", "4", "5"].includes(combo) && handlers.focusModule) {
        e.preventDefault();
        handlers.focusModule(Number(combo));
      } else if (combo === "escape" && handlers.exitModule) {
        handlers.exitModule();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, activeShortcuts, handlers]);

  return { formatCombo };
}
