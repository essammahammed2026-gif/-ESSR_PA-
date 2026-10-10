"""Shared prepress units & formatting — single copy (fix.md Phase 1.2)."""
from typing import List, Optional, Tuple
MM_TO_PTS = 72.0 / 25.4
PTS_TO_MM = 25.4 / 72.0


def hex_to_rgb(h: str) -> Tuple[float, float, float]:
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) if len(h) == 6 else (0, 0, 0)  # type: ignore[return-value]


def format_page_ranges(pages: List[int]) -> str:
    """Formats sorted 1-based page numbers into compact ranges: [1,2,3,5] -> '1–3, 5'."""
    if not pages:
        return ""
    sorted_pages = sorted(set(pages))
    ranges = []
    start = prev = sorted_pages[0]
    for p in sorted_pages[1:]:
        if p == prev + 1:
            prev = p
        else:
            ranges.append(str(start) if start == prev else f"{start}–{prev}")
            start = prev = p
    ranges.append(str(start) if start == prev else f"{start}–{prev}")
    return ", ".join(ranges)


def parse_page_range(range_str: str, max_pages: int) -> List[int]:
    """Parse 'all' / '1-3, 5' (1-based) into 0-based page indices. Single copy."""
    if not range_str or range_str.strip().lower() in ["all", ""]:
        return list(range(max_pages))
    pages: List[int] = []
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            try:
                start_s, end_s = part.split("-")
                start = max(1, int(start_s))
                end = min(max_pages, int(end_s))
                pages.extend(range(start - 1, end))
            except (ValueError, TypeError):
                pass
        else:
            try:
                p = int(part)
                if 1 <= p <= max_pages:
                    pages.append(p - 1)
            except (ValueError, TypeError):
                pass
    return sorted(set(pages)) if pages else list(range(max_pages))


def parse_page_selection(page_range: str) -> Optional[List[int]]:
    """Parse '1-3, 5' (1-based) into 0-based indices without a page-count clamp.

    Returns None for 'all'/empty/unparseable (caller renders everything).
    Single copy of the flipbook router's inline splitter.
    """
    if not page_range or page_range.strip().lower() == "all":
        return None
    try:
        indices: List[int] = []
        for part in page_range.split(","):
            part = part.strip()
            if "-" in part:
                start, end = part.split("-")
                indices.extend(range(int(start) - 1, int(end)))
            else:
                indices.append(int(part) - 1)
        return indices
    except (ValueError, TypeError, AttributeError):
        return None
