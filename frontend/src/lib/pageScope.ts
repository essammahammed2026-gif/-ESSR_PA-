import type { BookStudioPage, CropTarget, ModulePageScope, MaskApplyScopeMode } from "@/types/book_studio";

export interface ResolvedCropTarget {
  /** True when the backend should hit every page (pure all/both). */
  applyToAll: boolean;
  /** Explicit page ids when the target is narrower than everything. */
  ids: string[] | undefined;
  /** Human label for action buttons (e.g. "All", "Odds", "Pages 1-5"). */
  label: string;
}

/**
 * Parses a custom range string (e.g. "1-5, 8, 11-14") into a set of 1-based
 * page numbers. Empty/invalid input yields an empty set.
 */
export function parsePageRange(raw: string | undefined): Set<number> {
  const out = new Set<number>();
  const text = raw?.trim();
  if (!text) return out;
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        for (let n = start; n <= end; n++) out.add(n);
      }
    } else {
      const val = parseInt(part, 10);
      if (!isNaN(val)) out.add(val);
    }
  }
  return out;
}

/**
 * Evaluates whether a 1-based page number falls within a ModulePageScope configuration.
 * When `scope.mode === "current"`, compares against `activePageNum` (1-based).
 */
export function isPageInScope(
  pageNum: number,
  scope: ModulePageScope,
  activePageNum?: number
): boolean {
  if (scope.mode === "all") {
    return true;
  }
  if (scope.mode === "current") {
    return activePageNum !== undefined ? pageNum === activePageNum : true;
  }
  if (scope.mode === "odds") {
    return pageNum % 2 !== 0;
  }
  if (scope.mode === "evens") {
    return pageNum % 2 === 0;
  }
  if (scope.mode === "range") {
    const raw = scope.customRange?.trim();
    if (!raw) return true;
    return parsePageRange(raw).has(pageNum);
  }
  return true;
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

/**
 * Resolves a ModulePageScopeMode ("current" | "all" | "odds" | "evens" | "range")
 * into explicit target page IDs and a human-readable summary label.
 */
export function resolveMaskTargetIds(
  pages: BookStudioPage[],
  selectedPageId: string | null | undefined,
  selectedPageIds: string[],
  scopeMode: MaskApplyScopeMode,
  customRange: string = ""
): { ids: string[]; label: string } {
  if (scopeMode === "current") {
    return {
      ids: selectedPageId ? [selectedPageId] : [],
      label: "Current Page",
    };
  }
  if (scopeMode === "all") {
    return {
      ids: pages.map((p) => p.id),
      label: `All Pages (${pages.length})`,
    };
  }
  if (scopeMode === "odds") {
    const ids = pages.filter((_, i) => (i + 1) % 2 !== 0).map((p) => p.id);
    return { ids, label: `Odd Pages (${ids.length})` };
  }
  if (scopeMode === "evens") {
    const ids = pages.filter((_, i) => (i + 1) % 2 === 0).map((p) => p.id);
    return { ids, label: `Even Pages (${ids.length})` };
  }
  // range
  const wanted = parsePageRange(customRange);
  const ids = wanted.size > 0
    ? pages.filter((_, i) => wanted.has(i + 1)).map((p) => p.id)
    : (selectedPageId ? [selectedPageId] : []);
  return {
    ids,
    label: customRange.trim() ? `Range (${customRange.trim()})` : "Range",
  };
}
