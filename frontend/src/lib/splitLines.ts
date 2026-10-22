import type { SplitLine, SplitDirection } from "@/types/book_studio";

export const MIN_CUT = 0.01;
export const MAX_CUT = 0.99;

export function clampCut(v: number): number {
  return Math.round(Math.max(MIN_CUT, Math.min(MAX_CUT, v)) * 1000) / 1000;
}

/** Sorted, deduped positions for one direction (backend-ready). */
export function positionsFor(lines: SplitLine[], direction: SplitDirection): number[] {
  const out = lines
    .filter((l) => l.direction === direction)
    .map((l) => clampCut(l.pos));
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export interface SplitGroups {
  vertical: number[];
  horizontal: number[];
}

/** Partition cut lines by direction for phased backend splits. */
export function groupSplitLines(lines: SplitLine[]): SplitGroups {
  return {
    vertical: positionsFor(lines, "vertical"),
    horizontal: positionsFor(lines, "horizontal"),
  };
}

/** Millimeter sizes of the segments produced along one axis. */
export function segmentSizes(totalMm: number, positions: number[]): number[] {
  const cuts = [0, ...positions, 1];
  return cuts.slice(0, -1).map((start, i) =>
    Math.round(totalMm * (cuts[i + 1] - start) * 10) / 10
  );
}

export interface AxisSegments {
  vertical: number[];
  horizontal: number[];
}

/** Per-axis millimeter segment lists for the dimension readouts. */
export function buildSegments(lines: SplitLine[], widthMm: number, heightMm: number): AxisSegments {
  const groups = groupSplitLines(lines);
  return {
    vertical: segmentSizes(widthMm, groups.vertical),
    horizontal: segmentSizes(heightMm, groups.horizontal),
  };
}

/** Total page count produced by the cut grid. */
export function cutPageCount(lines: SplitLine[]): number {
  const groups = groupSplitLines(lines);
  return (groups.vertical.length + 1) * (groups.horizontal.length + 1);
}

/** Calculates the next non-overlapping cut line position (0.50, 0.67, or 0.33). */
export function getNextCutLine(lines: SplitLine[], preferredDirection?: SplitDirection): SplitLine {
  const dir = preferredDirection ?? (lines.length > 0 ? lines[lines.length - 1].direction : "vertical");
  const sameDirLines = lines.filter((l) => l.direction === dir);
  const lastPos = sameDirLines.length > 0 ? sameDirLines[sameDirLines.length - 1].pos : 0.5;
  const hasCenter = sameDirLines.some((l) => Math.abs(l.pos - 0.5) < 0.08);
  const nextPos = hasCenter ? (lastPos <= 0.5 ? 0.67 : 0.33) : 0.5;
  return { pos: clampCut(nextPos), direction: dir };
}
