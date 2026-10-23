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

export interface ConcreteScopeResult {
  pageNumbers: number[]; // 1-based page numbers
  pageIndices: number[]; // 0-based page indices
  pageIds: string[];
  scopeLabel: string;
}

/**
 * Evaluates any ModulePageScope and statically binds it to concrete page numbers,
 * indices, and IDs based on the current pages deck and active page.
 * Guarantees that "current" produces an explicit single-element array (e.g. [activePageNum])
 * and never persists a dynamic "current" reference.
 */
export function resolveConcretePageNumbers(
  pages: BookStudioPage[],
  scope: ModulePageScope,
  activePageId?: string | null
): ConcreteScopeResult {
  if (!pages || pages.length === 0) {
    return { pageNumbers: [], pageIndices: [], pageIds: [], scopeLabel: "None" };
  }

  const activeIdx = activePageId ? pages.findIndex((p) => p.id === activePageId) : -1;
  const resolvedIdx = activeIdx >= 0 ? activeIdx : 0;
  const resolvedNum = resolvedIdx + 1;

  if (scope.mode === "current") {
    const page = pages[resolvedIdx];
    return {
      pageNumbers: [resolvedNum],
      pageIndices: [resolvedIdx],
      pageIds: page ? [page.id] : [],
      scopeLabel: `P.${resolvedNum}`,
    };
  }

  if (scope.mode === "all") {
    return {
      pageNumbers: pages.map((_, i) => i + 1),
      pageIndices: pages.map((_, i) => i),
      pageIds: pages.map((p) => p.id),
      scopeLabel: "All",
    };
  }

  if (scope.mode === "odds") {
    const indices: number[] = [];
    const numbers: number[] = [];
    const ids: string[] = [];
    pages.forEach((p, i) => {
      const num = i + 1;
      if (num % 2 !== 0) {
        indices.push(i);
        numbers.push(num);
        ids.push(p.id);
      }
    });
    return {
      pageNumbers: numbers,
      pageIndices: indices,
      pageIds: ids,
      scopeLabel: "Odds",
    };
  }

  if (scope.mode === "evens") {
    const indices: number[] = [];
    const numbers: number[] = [];
    const ids: string[] = [];
    pages.forEach((p, i) => {
      const num = i + 1;
      if (num % 2 === 0) {
        indices.push(i);
        numbers.push(num);
        ids.push(p.id);
      }
    });
    return {
      pageNumbers: numbers,
      pageIndices: indices,
      pageIds: ids,
      scopeLabel: "Evens",
    };
  }

  if (scope.mode === "range") {
    const wanted = parsePageRange(scope.customRange);
    const indices: number[] = [];
    const numbers: number[] = [];
    const ids: string[] = [];
    pages.forEach((p, i) => {
      const num = i + 1;
      if (wanted.size === 0 || wanted.has(num)) {
        indices.push(i);
        numbers.push(num);
        ids.push(p.id);
      }
    });
    const label = scope.customRange?.trim()
      ? `Pages ${scope.customRange.trim()}`
      : `All (${pages.length})`;
    return {
      pageNumbers: numbers,
      pageIndices: indices,
      pageIds: ids,
      scopeLabel: label,
    };
  }

  return {
    pageNumbers: pages.map((_, i) => i + 1),
    pageIndices: pages.map((_, i) => i),
    pageIds: pages.map((p) => p.id),
    scopeLabel: "All",
  };
}

/**
 * Checks whether a page is included in a list of applied entries.
 * Honors entry visibility (skips entries toggled off).
 */
export function isPageInAppliedEntries(
  pageNum: number,
  pageId: string | undefined,
  entries: { targetPages?: number[]; targetPageIds?: string[]; visible?: boolean }[] | undefined
): boolean {
  if (!entries || entries.length === 0) return false;
  return entries.some((entry) => {
    if (entry.visible === false) return false;
    if (entry.targetPageIds && pageId && entry.targetPageIds.includes(pageId)) {
      return true;
    }
    if (entry.targetPages && entry.targetPages.includes(pageNum)) {
      return true;
    }
    return false;
  });
}

/**
 * Formats a sorted list of 1-based page numbers into a compact range string,
 * e.g. [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8".
 */
export function formatPageNumbersToRange(pageNumbers: number[]): string {
  if (!pageNumbers || pageNumbers.length === 0) return "";
  const uniqueSorted = Array.from(new Set(pageNumbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = uniqueSorted[0];
  let prev = start;

  for (let i = 1; i < uniqueSorted.length; i++) {
    const curr = uniqueSorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(", ");
}
