import { useState, useCallback } from "react";
import type { BasePage } from "@/types/book_studio";

/**
 * Shared page-deck list ops (fix.md Phase 2.3): reorder / rotate / delete /
 * duplicate / reset. Local-first semantics — callers with backend sync
 * (book-studio) keep their own syncing wrappers; imposing delegates directly.
 */
export function usePageDeck<T extends BasePage>(initial: T[] = []) {
  const [pages, setPages] = useState<T[]>(initial);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const removeById = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const rotateByDelta = useCallback((id: string, delta: number) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? ({ ...p, rotation: p.rotation + delta } as T) : p))
    );
  }, []);

  const rotateStepped = useCallback((id: string, dir: "cw" | "ccw") => {
    const delta = dir === "cw" ? 90 : -90;
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? ({ ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 } as T) : p
      )
    );
  }, []);

  const toggleDeletedById = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? ({ ...p, is_deleted: !p.is_deleted } as T) : p))
    );
  }, []);

  const duplicateById = useCallback(
    (id: string, makeId: (page: T) => string, patch?: (page: T) => Partial<T>) => {
      setPages((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx === -1) return prev;
        const clone = { ...prev[idx], id: makeId(prev[idx]), ...(patch ? patch(prev[idx]) : {}) } as T;
        const copy = [...prev];
        copy.splice(idx + 1, 0, clone);
        return copy;
      });
    },
    []
  );

  const clear = useCallback(() => {
    setPages([]);
  }, []);

  return { pages, setPages, reorder, removeById, rotateByDelta, rotateStepped, toggleDeletedById, duplicateById, clear };
}
