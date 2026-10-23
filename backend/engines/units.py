"""Shared prepress units & formatting — single copy (fix.md Phase 1.2)."""
from typing import List, Optional, Tuple

MM_PER_INCH = 25.4
MM_TO_PTS = 72.0 / MM_PER_INCH
PTS_TO_MM = MM_PER_INCH / 72.0


def mm_to_px(mm: float, dpi: float = 150.0) -> int:
    """Convert millimeters to screen/print pixels at a given DPI."""
    if mm <= 0:
        return 0
    return int(round((float(mm) / MM_PER_INCH) * dpi))


def px_to_mm(px: float, dpi: float = 150.0) -> float:
    """Convert screen/print pixels to millimeters at a given DPI."""
    if px <= 0 or dpi <= 0:
        return 0.0
    return round((float(px) / dpi) * MM_PER_INCH, 2)


def is_page_in_scope(page_num: int, scope_mode: str, custom_range: str = "") -> bool:
    """
    Determines if a 1-based page number matches the given scope filter:
    - 'all': matches every page
    - 'odds': matches odd page numbers (1, 3, 5, ...)
    - 'evens': matches even page numbers (2, 4, 6, ...)
    - 'range': parses custom ranges like '1-5, 8, 12-14'
    """
    if scope_mode == "all":
        return True
    if scope_mode == "odds":
        return page_num % 2 != 0
    if scope_mode == "evens":
        return page_num % 2 == 0
    if scope_mode == "range":
        if not custom_range or not custom_range.strip():
            return True
        sel = parse_page_selection(custom_range)
        if sel is None:
            return True
        # sel is 0-based page indices
        return (page_num - 1) in sel
    return True


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


def _parse_1based_tokens(range_str: str, max_pages: Optional[int] = None) -> List[int]:
    pages: List[int] = []
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            start = max(1, int(start_s))
            end = int(end_s)
            if max_pages is not None:
                end = min(max_pages, end)
            pages.extend(range(start - 1, end))
        else:
            p = int(part)
            if p >= 1 and (max_pages is None or p <= max_pages):
                pages.append(p - 1)
    return pages


def parse_page_range(range_str: str, max_pages: int) -> List[int]:
    """Parse 'all' / '1-3, 5' (1-based) into 0-based page indices. Single copy."""
    if not range_str or range_str.strip().lower() in ["all", ""]:
        return list(range(max_pages))
    pages: List[int] = []
    for sub in range_str.split(","):
        try:
            pages.extend(_parse_1based_tokens(sub, max_pages=max_pages))
        except (ValueError, TypeError):
            pass
    return sorted(set(pages)) if pages else list(range(max_pages))


def parse_page_selection(page_range: str) -> Optional[List[int]]:
    """Parse '1-3, 5' (1-based) into 0-based indices without a page-count clamp.

    Returns None for 'all'/empty/unparseable (caller renders everything).
    """
    if not page_range or page_range.strip().lower() == "all":
        return None
    try:
        return _parse_1based_tokens(page_range, max_pages=None)
    except (ValueError, TypeError, AttributeError):
        return None
