"use client";

import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { apiFetch, downloadBlob } from "@/lib/api";
import type { BookStudioPage } from "@/types/book_studio";

export interface UseBookPageOpsArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
  recordStep?: (label: string, nextPages: BookStudioPage[], nextSelectedId?: string | null) => void;
}

export function useBookPageOps({
  sessionId,
  setPages,
  selectedPageId,
  setSelectedPageId,
  recordStep,
}: UseBookPageOpsArgs) {
  const [copiedPage, setCopiedPage] = useState<BookStudioPage | null>(null);

  const rotatePage = useCallback(
    async (pageId: string, delta: number = 90) => {
      if (!sessionId) return;
      try {
        const res = await apiFetch(`/api/book-scan/rotate/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: pageId, rotation_delta: delta }),
        });
        if (res.ok) {
          const data = await res.json();
          setPages((prev) => {
            const updated = prev.map((p) =>
              p.id === pageId
                ? {
                    ...p,
                    rotation: data.page.rotation,
                    rev: data.page.rev,
                    width_mm: data.page.width_mm ?? p.width_mm,
                    height_mm: data.page.height_mm ?? p.height_mm,
                    orig_width_mm: data.page.orig_width_mm ?? p.orig_width_mm,
                    orig_height_mm: data.page.orig_height_mm ?? p.orig_height_mm,
                  }
                : p
            );
            recordStep?.(`Rotate ${delta > 0 ? `+${delta}°` : `${delta}°`}`, updated, pageId);
            return updated;
          });
        }
      } catch (err) {
        console.error("Rotate page failed:", err);
      }
    },
    [sessionId, setPages, recordStep]
  );

  const deletePage = useCallback(
    async (pageId: string) => {
      if (!sessionId) return;
      try {
        const res = await apiFetch(`/api/book-scan/page/${sessionId}/${pageId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setPages((prev) => {
            const remaining = prev.filter((p) => p.id !== pageId);
            const nextId = selectedPageId === pageId ? (remaining.length > 0 ? remaining[0].id : null) : selectedPageId;
            if (selectedPageId === pageId) {
              setSelectedPageId(nextId);
            }
            recordStep?.("Delete Page", remaining, nextId);
            return remaining;
          });
        }
      } catch (err) {
        console.error("Delete page failed:", err);
      }
    },
    [sessionId, selectedPageId, setPages, setSelectedPageId, recordStep]
  );

  const reorderPages = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (!sessionId || fromIdx === toIdx) return;
      setPages((prev) => {
        const copy = [...prev];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);

        apiFetch(`/api/book-scan/reorder/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_ids: copy.map((p) => p.id) }),
        }).catch((err) => console.error("Reorder backend sync error:", err));

        recordStep?.("Reorder Pages", copy, selectedPageId);
        return copy;
      });
    },
    [sessionId, selectedPageId, setPages, recordStep]
  );

  const duplicatePage = useCallback(
    async (targetPageId: string, position: "before" | "after" = "after") => {
      if (!sessionId) return;
      try {
        const res = await apiFetch(`/api/book-scan/duplicate-page/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: targetPageId, position }),
        });
        if (res.ok) {
          const data = await res.json();
          setPages(data.pages);
          if (data.new_page_id) {
            setSelectedPageId(data.new_page_id);
          }
          recordStep?.("Duplicate Page", data.pages, data.new_page_id ?? selectedPageId);
        }
      } catch (err) {
        console.error("Duplicate page failed:", err);
      }
    },
    [sessionId, selectedPageId, setPages, setSelectedPageId, recordStep]
  );

  const insertBlankPage = useCallback(
    async (
      targetPageId: string,
      position: "before" | "after" = "after",
      widthMm?: number,
      heightMm?: number
    ) => {
      if (!sessionId) return;
      try {
        const res = await apiFetch(`/api/book-scan/insert-blank/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_id: targetPageId,
            position,
            width_mm: widthMm,
            height_mm: heightMm,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPages(data.pages);
          if (data.new_page_id) {
            setSelectedPageId(data.new_page_id);
          }
          recordStep?.("Insert Blank Page", data.pages, data.new_page_id ?? selectedPageId);
        }
      } catch (err) {
        console.error("Insert blank page failed:", err);
      }
    },
    [sessionId, selectedPageId, setPages, setSelectedPageId, recordStep]
  );

  const copyPage = useCallback((page: BookStudioPage) => {
    setCopiedPage(page);
  }, []);

  const pastePage = useCallback(
    async (targetPageId: string, position: "before" | "after" = "after") => {
      if (!copiedPage) return;
      await duplicatePage(copiedPage.id, position);
    },
    [copiedPage, duplicatePage]
  );

  const extractPage = useCallback(
    async (pageId: string, format: "pdf" | "png" | "jpeg" | "webp" = "pdf") => {
      if (!sessionId) return;
      const ext = format === "pdf" ? "pdf" : format === "jpeg" ? "jpg" : format;
      await downloadBlob(
        `/api/book-scan/extract-page/${sessionId}/${pageId}?format=${format}`,
        `page_${pageId.slice(0, 8)}.${ext}`
      );
    },
    [sessionId]
  );

  const rotatePages = useCallback(
    async (pageIds: string[], delta: number = 90) => {
      if (!sessionId || pageIds.length === 0) return;
      if (pageIds.length === 1) {
        await rotatePage(pageIds[0], delta);
        return;
      }
      const idSet = new Set(pageIds);
      const swapDims = Math.abs(delta) % 180 === 90;
      setPages((prev) => {
        const updated = prev.map((p) => {
          if (!idSet.has(p.id)) return p;
          const nextRot = ((p.rotation || 0) + delta + 360) % 360;
          return {
            ...p,
            rotation: nextRot,
            rev: (p.rev ?? 0) + 1,
            width_mm: swapDims ? p.height_mm : p.width_mm,
            height_mm: swapDims ? p.width_mm : p.height_mm,
            orig_width_mm: swapDims ? p.orig_height_mm : p.orig_width_mm,
            orig_height_mm: swapDims ? p.orig_width_mm : p.orig_height_mm,
          };
        });
        apiFetch(`/api/book-scan/restore-pages/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: updated }),
        }).catch((err) => console.error("Batch rotate sync error:", err));
        recordStep?.(`Rotate ${pageIds.length} Pages (${delta > 0 ? `+${delta}°` : `${delta}°`})`, updated, selectedPageId);
        return updated;
      });
    },
    [sessionId, selectedPageId, rotatePage, setPages, recordStep]
  );

  const deletePages = useCallback(
    async (pageIds: string[]) => {
      if (!sessionId || pageIds.length === 0) return;
      if (pageIds.length === 1) {
        await deletePage(pageIds[0]);
        return;
      }
      const idSet = new Set(pageIds);
      setPages((prev) => {
        const remaining = prev.filter((p) => !idSet.has(p.id));
        const nextId = selectedPageId && !idSet.has(selectedPageId)
          ? selectedPageId
          : (remaining.length > 0 ? remaining[0].id : null);
        if (nextId !== selectedPageId) {
          setSelectedPageId(nextId);
        }
        apiFetch(`/api/book-scan/restore-pages/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: remaining }),
        }).catch((err) => console.error("Batch delete sync error:", err));
        recordStep?.(`Delete ${pageIds.length} Pages`, remaining, nextId);
        return remaining;
      });
    },
    [sessionId, selectedPageId, deletePage, setPages, setSelectedPageId, recordStep]
  );

  const duplicatePages = useCallback(
    async (pageIds: string[], position: "before" | "after" = "after") => {
      if (!sessionId || pageIds.length === 0) return;
      if (pageIds.length === 1) {
        await duplicatePage(pageIds[0], position);
        return;
      }
      const idSet = new Set(pageIds);
      setPages((prev) => {
        const next: BookStudioPage[] = [];
        for (const p of prev) {
          if (idSet.has(p.id)) {
            const copy: BookStudioPage = {
              ...p,
              id: Math.random().toString(36).slice(2, 10),
              label: `${p.label || "Page"} (Copy)`,
              rev: (p.rev ?? 0) + 1,
            };
            if (position === "before") {
              next.push(copy, p);
            } else {
              next.push(p, copy);
            }
          } else {
            next.push(p);
          }
        }
        apiFetch(`/api/book-scan/restore-pages/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: next }),
        }).catch((err) => console.error("Batch duplicate sync error:", err));
        recordStep?.(`Duplicate ${pageIds.length} Pages`, next, selectedPageId);
        return next;
      });
    },
    [sessionId, selectedPageId, duplicatePage, setPages, recordStep]
  );

  return {
    rotatePage,
    rotatePages,
    deletePage,
    deletePages,
    reorderPages,
    duplicatePage,
    duplicatePages,
    insertBlankPage,
    copyPage,
    pastePage,
    canPaste: copiedPage !== null,
    extractPage,
  };
}
