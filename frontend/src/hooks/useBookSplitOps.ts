import { useCallback, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/api";
import { groupSplitLines } from "@/lib/splitLines";
import { resolveCropTarget } from "@/lib/cropTarget";
import type { BookStudioPage, CropModuleConfig } from "@/types/book_studio";

export interface UseBookSplitOpsArgs {
  sessionId: string | null;
  pages: BookStudioPage[];
  setPages: Dispatch<SetStateAction<BookStudioPage[]>>;
  selectedPageId: string | null;
  setSelectedPageId: Dispatch<SetStateAction<string | null>>;
  cropModule: CropModuleConfig;
  setCropModule: Dispatch<SetStateAction<CropModuleConfig>>;
  clearPageCrops?: (ids?: string[]) => void;
}

interface PhaseResult {
  pages: BookStudioPage[];
  newIds: string[];
  newSelectedId: string | null;
}

const FULL_BED = { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 };

/**
 * Split / revert / crop operations for Book Studio.
 * Cut lines carry their own axis, so mixed vertical + horizontal cuts run as
 * two backend phases (vertical first, then horizontal across the new slices).
 * Apply/Split commit view-relative boxes (compose-on-commit), so the overlay
 * resets to full bed afterwards — repeat operations refine the visible region.
 */
export function useBookSplitOps({
  sessionId,
  pages,
  setPages,
  selectedPageId,
  setSelectedPageId,
  cropModule,
  setCropModule,
  clearPageCrops,
}: UseBookSplitOpsArgs) {
  // One backend split pass along a single axis. Returns fresh pages + new slice ids.
  const runSplitPhase = useCallback(async (
    currentPages: BookStudioPage[],
    positions: number[],
    direction: "vertical" | "horizontal",
    parentIds: string[],
    applyToAll: boolean,
    targetPageIds: string[] | undefined,
  ): Promise<PhaseResult | null> => {
    if (!sessionId) return null;
    const anchorId = targetPageIds?.[0] ?? parentIds[0];
    if (!anchorId && !applyToAll) return null;
    const res = await apiFetch(`/api/book-scan/split-spread/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: anchorId,
        crop_box: cropModule.cropBox,
        split_pos: positions[0] ?? 0.5,
        split_lines: positions,
        split_direction: direction,
        apply_to_all: applyToAll,
        target_page_ids: targetPageIds,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const nextPages: BookStudioPage[] = data.pages ?? currentPages;
    const beforeIds = new Set(currentPages.map((p) => p.id));
    const parentSet = new Set(parentIds);
    const newIds = nextPages
      .filter((p) => !beforeIds.has(p.id) && p.parent_page_id && parentSet.has(p.parent_page_id))
      .map((p) => p.id);
    return { pages: nextPages, newIds, newSelectedId: data.new_selected_id ?? null };
  }, [sessionId, cropModule.cropBox]);

  // Cut along the configured cut lines across the crop target (empty = plain crop)
  const splitSpread = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    const { vertical, horizontal } = groupSplitLines(cropModule.splitLines);
    if (vertical.length === 0 && horizontal.length === 0) return;
    try {
      const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
      let applyToAll = resolved.applyToAll;
      let targetPageIds = resolved.ids;
      let parentIds = targetPageIds ?? pages.filter((p) => !p.parent_page_id).map((p) => p.id);

      let current = pages;
      let newSelectedId: string | null = null;
      // Phase 1: vertical cuts
      if (vertical.length > 0) {
        const phase = await runSplitPhase(current, vertical, "vertical", parentIds, applyToAll, targetPageIds);
        if (!phase) return;
        current = phase.pages;
        newSelectedId = phase.newSelectedId;
        // Phase 2 targets the slices just created (y-range is unchanged by vertical cuts)
        parentIds = phase.newIds.length > 0
          ? Array.from(new Set(phase.pages.filter((p) => phase.newIds.includes(p.id)).map((p) => p.parent_page_id).filter((id): id is string => Boolean(id))))
          : parentIds;
        targetPageIds = phase.newIds.length > 0 ? phase.newIds : targetPageIds;
        applyToAll = false;
      }
      // Phase 2 (or single pass): horizontal cuts
      if (horizontal.length > 0) {
        const phase = await runSplitPhase(current, horizontal, "horizontal", parentIds, applyToAll, targetPageIds);
        if (!phase) return;
        current = phase.pages;
        newSelectedId = phase.newSelectedId ?? newSelectedId;
      }
      setPages(current);
      if (newSelectedId) {
        setSelectedPageId(newSelectedId);
      } else if (!current.some((p) => p.id === selectedPageId) && current[0]) {
        setSelectedPageId(current[0].id);
      }
      // Committed: overlay back to full bed over the new slices
      clearPageCrops?.();
      setCropModule((prev) => ({ ...prev, cropBox: { ...FULL_BED } }));
    } catch (err) {
      console.error("Split spread failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule, pages, setPages, setSelectedPageId, setCropModule, runSplitPhase, clearPageCrops]);

  // Recombine split slices back into the uncut spread
  const revertSpread = useCallback(async (mode: "current" | "all" = "current", pageId?: string) => {
    const targetId = pageId || selectedPageId;
    if (!sessionId) return;
    if (mode === "current" && !targetId) return;
    try {
      const res = await apiFetch(`/api/book-scan/revert-spread/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: mode === "current" ? targetId : undefined,
          revert_all: mode === "all",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
        clearPageCrops?.();
        if (data.new_selected_id) {
          setSelectedPageId(data.new_selected_id);
        }
      }
    } catch (err) {
      console.error("Revert spread failed:", err);
    }
  }, [sessionId, selectedPageId, setPages, setSelectedPageId, clearPageCrops]);

  // Commit the crop box across the crop target (final: overlay resets to full bed)
  const applyCrop = useCallback(async () => {
    if (!sessionId || !selectedPageId) return;
    try {
      const resolved = resolveCropTarget(pages, selectedPageId, cropModule.target);
      const res = await apiFetch(`/api/book-scan/crop-page/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPageId,
          crop_box: cropModule.cropBox,
          apply_to_all: resolved.applyToAll,
          target_page_ids: resolved.ids,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
        if (resolved.applyToAll) {
          clearPageCrops?.();
        } else if (resolved.ids) {
          clearPageCrops?.(resolved.ids);
        } else if (selectedPageId) {
          clearPageCrops?.([selectedPageId]);
        }
        // Committed: the view now shows the cropped region, so the overlay
        // resets to full bed — repeat crops refine the visible region.
        // Cut lines transfer unchanged (relative to the committed region).
        setCropModule((prev) => ({ ...prev, cropBox: { ...FULL_BED } }));
      }
    } catch (err) {
      console.error("Apply crop failed:", err);
    }
  }, [sessionId, selectedPageId, cropModule.cropBox, cropModule.target, pages, setPages, setCropModule, clearPageCrops]);

  return { splitSpread, revertSpread, applyCrop };
}
