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
              p.id === pageId ? { ...p, rotation: data.page.rotation, rev: data.page.rev } : p
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

  return {
    rotatePage,
    deletePage,
    reorderPages,
    duplicatePage,
    insertBlankPage,
    copyPage,
    pastePage,
    canPaste: copiedPage !== null,
    extractPage,
  };
}
