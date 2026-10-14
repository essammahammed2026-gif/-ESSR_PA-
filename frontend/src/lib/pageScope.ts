import { ModulePageScope } from "@/types/book_studio";

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
 */
export function isPageInScope(pageNum: number, scope: ModulePageScope): boolean {
  if (scope.mode === "all") {
    return true;
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
