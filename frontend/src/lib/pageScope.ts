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
    if (activePageNum === undefined) return true;
    if (scope.dualSides && scope.dualSides.length > 0) {
      const pairStartIdx = Math.floor((activePageNum - 1) / 2) * 2;
      const leftPageNum = pairStartIdx + 1;
      const rightPageNum = pairStartIdx + 2;
      if (scope.dualSides.includes("left") && pageNum === leftPageNum) return true;
      if (scope.dualSides.includes("right") && pageNum === rightPageNum) return true;
      return false;
    }
    return pageNum === activePageNum;
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
    const selIdx = pages.findIndex((p) => p.id === selectedPageId);
    const sides = target.dualSides;
    if (sides && sides.length > 0 && selIdx >= 0) {
      const pairStartIdx = Math.floor(selIdx / 2) * 2;
      const ids: string[] = [];
      if (sides.includes("left") && pages[pairStartIdx]) ids.push(pages[pairStartIdx].id);
      if (sides.includes("right") && pages[pairStartIdx + 1]) ids.push(pages[pairStartIdx + 1].id);
      if (ids.length > 0) {
        return { applyToAll: false, ids, label: ids.length > 1 ? "Both Pages" : "Current Page" };
      }
    }
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

export interface DualSpreadState {
  pairStartIdx: number;
  leftPage: BookStudioPage | null;
  rightPage: BookStudioPage | null;
  leftPageId: string;
  rightPageId: string;
  leftPageNum: number;
  rightPageNum: number | undefined;
  isDualActive: boolean;
  isDualLinked: boolean;
  activeDualSide: "left" | "right" | null;
  activePage: BookStudioPage | null;
  activePageId: string | null;
}

/**
 * Canonical dual-page spread state resolver shared across all Book Studio tools
 * (Crop, Split, Deskew, Cleanup, Colors & Tone, and Print Bleed).
 */
export function resolveDualSpreadState(
  pages: BookStudioPage[] | undefined,
  selectedPageId: string | null | undefined,
  isDualPage: boolean = false,
  dualSides?: Array<"left" | "right">
): DualSpreadState {
  const list = pages || [];
  const rawIdx = selectedPageId ? list.findIndex((p) => p.id === selectedPageId) : -1;
  const pairStartIdx = isDualPage && rawIdx >= 0 ? Math.floor(rawIdx / 2) * 2 : rawIdx;
  const leftPage = pairStartIdx >= 0 && list[pairStartIdx] ? list[pairStartIdx] : (list[0] ?? null);
  const leftPageId = leftPage?.id ?? (selectedPageId ?? "");
  const leftPageNum = pairStartIdx >= 0 ? pairStartIdx + 1 : 1;
  const hasRightPage = Boolean(isDualPage && pairStartIdx >= 0 && pairStartIdx + 1 < list.length);
  const rightPage = hasRightPage ? list[pairStartIdx + 1] : null;
  const rightPageId = rightPage?.id ?? "";
  const rightPageNum = hasRightPage ? leftPageNum + 1 : undefined;

  const isDualActive = Boolean(isDualPage && hasRightPage);
  const isDualLinked = isDualActive && (dualSides?.length ?? 2) >= 2;
  const activeDualSide: "left" | "right" | null =
    isDualActive && dualSides?.length === 1 ? dualSides[0] : null;

  let activePage: BookStudioPage | null = leftPage;
  if (isDualActive && activeDualSide === "right" && rightPage) {
    activePage = rightPage;
  } else if (!isDualActive && selectedPageId) {
    activePage = list.find((p) => p.id === selectedPageId) ?? leftPage;
  }

  return {
    pairStartIdx,
    leftPage,
    rightPage,
    leftPageId,
    rightPageId,
    leftPageNum,
    rightPageNum,
    isDualActive,
    isDualLinked,
    activeDualSide,
    activePage,
    activePageId: activePage?.id ?? null,
  };
}

/**
 * Computes the next ModulePageScope when the user clicks the "Dual" scope button.
 * Switches between Linked (both pages: ["left", "right"]) and Unlinked (individual page: ["left"]).
 */
export function toggleDualModuleScope(
  scope: ModulePageScope,
  dualState: DualSpreadState,
  onSelectPageId?: (id: string) => void
): ModulePageScope {
  if (scope.mode !== "current") {
    return { ...scope, mode: "current", dualSides: ["left", "right"] };
  }
  if (dualState.isDualLinked) {
    if (dualState.leftPageId && onSelectPageId) {
      onSelectPageId(dualState.leftPageId);
    }
    return { ...scope, dualSides: ["left"] };
  }
  return { ...scope, dualSides: ["left", "right"] };
}

/**
 * Resolves a ModulePageScopeMode ("current" | "all" | "odds" | "evens" | "range")
 * into explicit target page IDs and a human-readable summary label,
 * honoring dual-page sides when in "current" mode.
 */
export function resolveMaskTargetIds(
  pages: BookStudioPage[],
  selectedPageId: string | null | undefined,
  selectedPageIds: string[],
  scopeMode: MaskApplyScopeMode,
  customRange: string = "",
  dualSides?: Array<"left" | "right">
): { ids: string[]; label: string } {
  const concrete = resolveConcretePageNumbers(
    pages,
    { mode: scopeMode, customRange, dualSides },
    selectedPageId
  );
  if (scopeMode === "current" && (!dualSides || dualSides.length === 0) && selectedPageIds.length > 0) {
    return {
      ids: selectedPageIds,
      label: selectedPageIds.length > 1 ? `Dual (${selectedPageIds.length}p)` : concrete.scopeLabel,
    };
  }
  return {
    ids: concrete.pageIds,
    label: concrete.scopeLabel,
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
    if (scope.dualSides && scope.dualSides.length > 0 && activeIdx >= 0) {
      const pairStartIdx = Math.floor(activeIdx / 2) * 2;
      const pageNumbers: number[] = [];
      const pageIndices: number[] = [];
      const pageIds: string[] = [];
      if (scope.dualSides.includes("left") && pages[pairStartIdx]) {
        pageIndices.push(pairStartIdx);
        pageNumbers.push(pairStartIdx + 1);
        pageIds.push(pages[pairStartIdx].id);
      }
      if (scope.dualSides.includes("right") && pages[pairStartIdx + 1]) {
        pageIndices.push(pairStartIdx + 1);
        pageNumbers.push(pairStartIdx + 2);
        pageIds.push(pages[pairStartIdx + 1].id);
      }
      if (pageNumbers.length > 0) {
        return {
          pageNumbers,
          pageIndices,
          pageIds,
          scopeLabel: pageNumbers.length > 1 ? `Dual (P.${pageNumbers.join(", P.")})` : `P.${pageNumbers[0]}`,
        };
      }
    }
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
 * Retrieves the active applied entry governing a specific page from a list of applied entries.
 * Evaluates in reverse order (last applied has priority) and honors the entry's `visible` flag.
 */
export function getAppliedEntryForPage<T extends {
  targetPages?: number[];
  targetPageIds?: string[];
  visible?: boolean;
}>(
  pageNum: number,
  pageId: string | undefined,
  entries: T[] | undefined
): T | undefined {
  if (!entries || entries.length === 0) return undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.visible === false) continue;
    if (entry.targetPageIds && pageId && entry.targetPageIds.includes(pageId)) {
      return entry;
    }
    if (entry.targetPages && entry.targetPages.includes(pageNum)) {
      return entry;
    }
  }
  return undefined;
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
  return Boolean(getAppliedEntryForPage(pageNum, pageId, entries));
}

/**
 * Unlinks a specific page (by pageId and/or 1-based pageNum) from an applied entry in a stack.
 * Prunes the entry completely if no target pages remain, or updates `excludedPages` and
 * `scopeLabel` cleanly (e.g. "Custom" or explicit remaining pages).
 */
export function unlinkPageFromEntries<T extends {
  id: string;
  targetPages?: number[];
  targetPageIds?: string[];
  origScope?: "all" | "odds" | "evens" | "range" | "current";
  excludedPages?: number[];
  scopeLabel?: string;
}>(
  entries: T[] | undefined,
  entryId: string,
  pageId: string | undefined,
  pageNum: number | undefined,
  totalPages: number
): T[] {
  if (!entries || entries.length === 0) return [];
  return entries
    .map((e) => {
      if (e.id !== entryId) return e;
      const nextIds = pageId
        ? (e.targetPageIds || []).filter((id) => id !== pageId)
        : (e.targetPageIds || []);
      const nextPages = pageNum !== undefined
        ? (e.targetPages || []).filter((n) => n !== pageNum)
        : (e.targetPages || []);
      const isFromAll = e.origScope === "all" || (e.targetPages?.length ?? 0) + (e.excludedPages?.length ?? 0) >= totalPages;
      const nextExcluded = pageNum !== undefined
        ? Array.from(new Set([...(e.excludedPages || []), pageNum])).sort((a, b) => a - b)
        : (e.excludedPages || []);

      return {
        ...e,
        origScope: e.origScope || (isFromAll ? "all" : undefined),
        excludedPages: nextExcluded,
        targetPageIds: nextIds,
        targetPages: nextPages,
        scopeLabel: isFromAll && nextExcluded.length > 0
          ? "Custom"
          : nextPages.length === 1
            ? `P.${nextPages[0]}`
            : nextPages.length > 0
              ? `P.${nextPages.join(",")}`
              : "None",
      };
    })
    .filter((e) => (e.targetPageIds && e.targetPageIds.length > 0) || (e.targetPages && e.targetPages.length > 0));
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
