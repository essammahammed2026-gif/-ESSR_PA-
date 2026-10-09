import { ModulePageScope } from "@/types/book_studio";

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
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && pageNum >= start && pageNum <= end) {
          return true;
        }
      } else {
        const val = parseInt(part, 10);
        if (!isNaN(val) && pageNum === val) {
          return true;
        }
      }
    }
    return false;
  }
  return true;
}
