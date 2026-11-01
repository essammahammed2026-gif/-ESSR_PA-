"use client";

import { useEffect, useCallback, useMemo } from "react";

export interface UseStudioShortcutsArgs {
  /** Map of action identifiers to their callback handlers */
  handlers: Record<string, (() => void) | undefined>;
  /** Optional custom user shortcut overrides (action -> combo string) */
  shortcuts?: Record<string, string>;
  /** Default shortcut mapping for this studio */
  defaultShortcuts?: Record<string, string>;
  /** Whether shortcut listening is active */
  enabled?: boolean;
}

/**
 * Checks if the event target is an interactive text input where shortcuts should be ignored.
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Normalizes a KeyboardEvent into a standard lowercase combo string, e.g. "ctrl+z", "shift+a", "escape".
 */
export function normalizeKeyEvent(e: KeyboardEvent): string {
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
  return parts.join("+");
}

/**
 * Formats a combo string (e.g. "ctrl+z") into a displayable badge text (e.g. "Ctrl+Z").
 */
export function formatShortcutCombo(raw: string): string {
  if (!raw) return "";
  return raw
    .split("+")
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === "escape" || lower === "esc") return "Esc";
      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join("+");
}

/**
 * Universal keyboard shortcut hook for studio views.
 * Handles key combo normalization, input field suppression, and dynamic formatted key badge hints.
 */
export function useStudioShortcuts({
  handlers,
  shortcuts = {},
  defaultShortcuts = {},
  enabled = true,
}: UseStudioShortcutsArgs) {
  const activeShortcuts = useMemo(
    () => ({ ...defaultShortcuts, ...shortcuts }),
    [defaultShortcuts, shortcuts]
  );

  const formatCombo = useCallback(
    (action: string): string => {
      const raw = activeShortcuts[action] || defaultShortcuts[action] || "";
      return formatShortcutCombo(raw);
    },
    [activeShortcuts, defaultShortcuts]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      const combo = normalizeKeyEvent(e);

      // Check each configured action in activeShortcuts
      for (const [action, shortcutCombo] of Object.entries(activeShortcuts)) {
        if (!shortcutCombo) continue;
        const handler = handlers[action];
        if (!handler) continue;

        if (combo === shortcutCombo.toLowerCase()) {
          // Do not preventDefault on Escape so dropdowns can close natively if desired
          if (combo !== "escape" && combo !== "esc") {
            e.preventDefault();
          }
          handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, activeShortcuts, handlers]);

  return { formatCombo, activeShortcuts };
}
