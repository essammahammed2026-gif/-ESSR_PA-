import type { BookStudioPage, CropTarget } from "@/types/book_studio";
import { parsePageRange } from "./pageScope";

export interface ResolvedCropTarget {
  /** True when the backend should hit every page (pure all/both). */
  applyToAll: boolean;
  /** Explicit page ids when the target is narrower than everything. */
  ids: string[] | undefined;
  /** Human label for action buttons (e.g. "All", "Odds", "Pages 1-5"). */
  label: string;
}

function parityOk(pageNum: number, target: CropTarget): boolean {
  if (target.parity === "odds") return pageNum % 2 !== 0;
  if (target.parity === "evens") return pageNum % 2 === 0;
  return true;
}

/**
 * Resolves a crop target into backend addressing.
 * - current → just the selected page.
 * - all/both → apply_to_all (backend fan-out).
 * - all/range + odds/evens, or a custom range → explicit ids (parity ∩ range).
 */
export function resolveCropTarget(
  pages: BookStudioPage[],
  selectedPageId: string | null | undefined,
  target: CropTarget
): ResolvedCropTarget {
  if (target.base === "current") {
    return {
      applyToAll: false,
      ids: selectedPageId ? [selectedPageId] : [],
      label: "Current Page",
    };
  }
  if (target.base === "all" && target.parity === "both") {
    return { applyToAll: true, ids: undefined, label: "All" };
  }
  const wanted = target.base === "range" ? parsePageRange(target.customRange) : null;
  const ids = pages
    .filter((_, idx) => {
      const num = idx + 1;
      if (!parityOk(num, target)) return false;
      if (wanted && !wanted.has(num)) return false;
      return true;
    })
    .map((p) => p.id);
  const parityLabel = target.parity === "both" ? "" : target.parity === "odds" ? "Odds" : "Evens";
  const label = target.base === "range"
    ? (target.customRange.trim() ? `Pages ${target.customRange.trim()}${parityLabel ? ` (${parityLabel})` : ""}` : `All${parityLabel ? ` ${parityLabel}` : ""}`)
    : (parityLabel || "All");
  return { applyToAll: false, ids, label };
}
