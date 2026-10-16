"""Imposition spec preparation — pure helpers moved out of the router (fix.md Phase 1.4).

Converts validated `ImposingItem` requests into packer artwork specs and
aligns placed results. No HTTP, no FastAPI — importable and testable.
"""
import os
from typing import Iterator, List, Tuple

from engines.schemas import ImposingItem
from engines.sheet_packer import SheetArtworkSpec
from engines.roll_packer import ArtworkSpec as RollArtworkSpec
from engines.thumbnails import (
    get_dimensions_mm,
    list_pdf_pages_mm,
    probe_source_dims,
    resolve_temp_file,
)
from engines.units import parse_page_range


def compute_opposing_rotation_deg(
    page_rotation_setting: str,
    src_w: float,
    src_h: float,
    target_w: float,
    target_h: float,
) -> int:
    """Calculates user-requested content rotation in PyMuPDF CCW degrees (0, 90, 270).

    Only rotates pages whose source aspect orientation opposes the target slot orientation:
    - 'cw'  -> 270 CCW (90° Clockwise)
    - 'ccw' -> 90 CCW (90° Counter-Clockwise)
    """
    if not page_rotation_setting or page_rotation_setting not in ("cw", "ccw"):
        return 0
    src_is_landscape = (src_w or 0) > (src_h or 0)
    target_is_landscape = (target_w or 0) > (target_h or 0)
    if src_is_landscape == target_is_landscape:
        return 0
    return 270 if page_rotation_setting == "cw" else 90


def effective_page_rotation(pdf_path_val: str, page_num: int, raw_rot: str,
                            target_w: float, target_h: float,
                            open_docs: dict) -> str:
    """Single-copy opposing-orientation gate (moved out of router preview).

    Only pages whose source orientation opposes the user target get rotated.
    Keeps fitz/cv2 probing inside engines via `probe_source_dims`.
    """
    if raw_rot not in ("cw", "ccw"):
        return "none"
    src_pw, src_ph = target_w, target_h
    if pdf_path_val and os.path.exists(pdf_path_val):
        try:
            src_pw, src_ph = probe_source_dims(pdf_path_val, page_num, open_docs)
            if src_pw == 0 and src_ph == 0:
                src_pw, src_ph = target_w, target_h
        except Exception:
            pass
    deg = compute_opposing_rotation_deg(raw_rot, src_pw, src_ph, target_w, target_h)
    return raw_rot if deg != 0 else "none"


def build_imposing_pages_meta(
    file_path: str, file_id_ext: str
) -> Tuple[float, float, int, List[dict]]:
    """Build per-page metadata list and primary (w, h, page_count) for an uploaded imposing asset."""
    ext = os.path.splitext(file_path)[1].lower()
    pages_meta: List[dict] = []
    if ext == ".pdf":
        dims = list_pdf_pages_mm(file_path)
        page_count = len(dims)
        w, h = dims[0] if page_count > 0 else (100.0, 100.0)
        for p, (pw_raw, ph_raw) in enumerate(dims):
            pw = round(pw_raw, 2)
            ph = round(ph_raw, 2)
            pages_meta.append({
                "page_num": p,
                "width_mm": pw,
                "height_mm": ph,
                "aspect_ratio": round(pw / ph, 3) if ph > 0 else 1.0,
                "thumb_url": f"/api/imposing/thumbnail/{file_id_ext}/{p}",
            })
        return w, h, page_count, pages_meta

    w, h = get_dimensions_mm(file_path)
    pw = round(w, 2)
    ph = round(h, 2)
    pages_meta.append({
        "page_num": 0,
        "width_mm": pw,
        "height_mm": ph,
        "aspect_ratio": round(pw / ph, 3) if ph > 0 else 1.0,
        "thumb_url": f"/api/imposing/thumbnail/{file_id_ext}/0",
    })
    return w, h, 1, pages_meta


def _iter_expanded_item_pages(
    items: List[ImposingItem],
) -> Iterator[Tuple[ImposingItem, str, float, float, str, bool, str, int]]:
    """Yields (item, path, w, h, fit_mode, keep_aspect, resolved_name, page_num) for each item page."""
    for item in items:
        path = resolve_temp_file(item.file_id) or f"temp_uploads/{item.file_id}"
        dims = None
        if item.w is None or item.h is None:
            dims = get_dimensions_mm(path)
        w = item.w if item.w is not None else dims[0]  # type: ignore[index]
        h = item.h if item.h is not None else dims[1]  # type: ignore[index]
        fit_mode = item.fit_mode or "stretch"
        keep_aspect_derived = fit_mode == "fit"

        if item.page_count and item.page_count > 1:
            target_pages = parse_page_range(item.page_range or "all", item.page_count)
            for p_idx in target_pages:
                yield (
                    item,
                    path,
                    w,
                    h,
                    fit_mode,
                    keep_aspect_derived,
                    f"{item.name}#p{p_idx + 1}",
                    p_idx,
                )
        else:
            yield (
                item,
                path,
                w,
                h,
                fit_mode,
                keep_aspect_derived,
                item.name,
                item.page_num or 0,
            )


def build_sheet_specs(items: List[ImposingItem]) -> List[SheetArtworkSpec]:
    specs: List[SheetArtworkSpec] = []
    for item, path, w, h, fit_mode, keep_aspect_derived, name, p_idx in _iter_expanded_item_pages(items):
        bleed_mode = item.bleed_mode or "none"
        bleed_mm = item.bleed_mm or 0.0
        bleed_color = item.bleed_color or "#FFFFFF"
        bleed_type = item.bleed_type or "inside"

        # If outside bleed, the total piece bounding box on the sheet expands by 2*bleed_mm
        expand = 2 * bleed_mm if (bleed_type == "outside" and bleed_mode != "none" and bleed_mm > 0) else 0.0
        specs.append(SheetArtworkSpec(
            name=name,
            piece_w_mm=w + expand,
            piece_h_mm=h + expand,
            quantity=item.copies,
            pdf_path=path,
            keep_aspect=keep_aspect_derived,
            fill_color=item.fill_color,
            page_num=p_idx,
            file_id=item.file_id,
            fit_mode=fit_mode,
            page_rotation=item.page_rotation or "none",
            bleed_mode=bleed_mode,
            bleed_mm=bleed_mm,
            bleed_color=bleed_color,
            bleed_type=bleed_type,
            target_w_mm=w,
            target_h_mm=h,
        ))
    return specs


def build_roll_specs(items: List[ImposingItem]) -> List[RollArtworkSpec]:
    return [
        RollArtworkSpec(
            name=name,
            piece_w_mm=w,
            piece_h_mm=h,
            quantity=item.copies,
            keep_aspect=keep_aspect_derived,
            fill_color=item.fill_color,
            page_num=p_idx,
            file_id=item.file_id,
        )
        for item, _path, w, h, _fit_mode, keep_aspect_derived, name, p_idx in _iter_expanded_item_pages(items)
    ]


def apply_alignment(items, sheet_w, sheet_h, margin, align):
    if not items or align == "Top Left":
        return
    min_x = min(i.x_mm for i in items)
    max_x = max(i.x_mm + i.w_mm for i in items)
    min_y = min(i.y_mm for i in items)
    max_y = max(i.y_mm + i.h_mm for i in items)

    content_w = max_x - min_x
    content_h = max_y - min_y
    usable_w = sheet_w - (margin * 2)
    usable_h = sheet_h - (margin * 2)

    shift_x = 0
    shift_y = 0

    if "Center" in align:
        shift_x = (usable_w - content_w) / 2.0
    elif "Right" in align:
        shift_x = usable_w - content_w

    if "Center" == align or "Left" == align or "Right" == align:
        # Middle vertical alignment
        shift_y = (usable_h - content_h) / 2.0
    elif "Bottom" in align:
        shift_y = usable_h - content_h

    # Prevent negative shifts if content overflows usable bounds slightly
    shift_x = max(0, shift_x)
    shift_y = max(0, shift_y)

    for i in items:
        i.x_mm += shift_x
        i.y_mm += shift_y
