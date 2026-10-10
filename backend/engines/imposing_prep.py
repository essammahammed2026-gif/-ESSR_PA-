"""Imposition spec preparation — pure helpers moved out of the router (fix.md Phase 1.4).

Converts validated `ImposingItem` requests into packer artwork specs and
aligns placed results. No HTTP, no FastAPI — importable and testable.
"""
from typing import List

from engines.schemas import ImposingItem
from engines.sheet_packer import SheetArtworkSpec
from engines.roll_packer import ArtworkSpec as RollArtworkSpec
from engines.thumbnails import get_dimensions_mm, resolve_temp_file
from engines.units import parse_page_range


def build_sheet_specs(items: List[ImposingItem]) -> List[SheetArtworkSpec]:
    specs = []
    for item in items:
        path = resolve_temp_file(item.file_id) or f"temp_uploads/{item.file_id}"
        w = item.w if item.w is not None else get_dimensions_mm(path)[0]
        h = item.h if item.h is not None else get_dimensions_mm(path)[1]
        # fit_mode is authoritative; keep_aspect is derived for backward compat
        fit_mode = item.fit_mode or "stretch"
        keep_aspect_derived = (fit_mode == "fit")

        bleed_mode = item.bleed_mode or "none"
        bleed_mm = item.bleed_mm or 0.0
        bleed_color = item.bleed_color or "#FFFFFF"
        bleed_type = item.bleed_type or "inside"

        # If outside bleed, the total piece bounding box on the sheet expands by 2*bleed_mm
        pack_w = (w + 2 * bleed_mm) if (bleed_type == "outside" and bleed_mode != "none" and bleed_mm > 0) else w
        pack_h = (h + 2 * bleed_mm) if (bleed_type == "outside" and bleed_mode != "none" and bleed_mm > 0) else h

        if item.page_count and item.page_count > 1:
            target_pages = parse_page_range(item.page_range or "all", item.page_count)
            for p_idx in target_pages:
                specs.append(SheetArtworkSpec(
                    name=f"{item.name}#p{p_idx + 1}",
                    piece_w_mm=pack_w, piece_h_mm=pack_h,
                    quantity=item.copies, pdf_path=path,
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
        else:
            specs.append(SheetArtworkSpec(
                name=item.name, piece_w_mm=pack_w, piece_h_mm=pack_h,
                quantity=item.copies, pdf_path=path,
                keep_aspect=keep_aspect_derived,
                fill_color=item.fill_color,
                page_num=item.page_num or 0,
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
    specs = []
    for item in items:
        path = resolve_temp_file(item.file_id) or f"temp_uploads/{item.file_id}"
        w = item.w if item.w is not None else get_dimensions_mm(path)[0]
        h = item.h if item.h is not None else get_dimensions_mm(path)[1]
        fit_mode = item.fit_mode or "stretch"
        keep_aspect_derived = (fit_mode == "fit")

        if item.page_count and item.page_count > 1:
            target_pages = parse_page_range(item.page_range or "all", item.page_count)
            for p_idx in target_pages:
                specs.append(RollArtworkSpec(
                    name=f"{item.name}#p{p_idx + 1}",
                    piece_w_mm=w, piece_h_mm=h,
                    quantity=item.copies,
                    keep_aspect=keep_aspect_derived,
                    fill_color=item.fill_color,
                    page_num=p_idx,
                    file_id=item.file_id,
                ))
        else:
            specs.append(RollArtworkSpec(
                name=item.name, piece_w_mm=w, piece_h_mm=h,
                quantity=item.copies,
                keep_aspect=keep_aspect_derived,
                fill_color=item.fill_color,
                page_num=item.page_num or 0,
                file_id=item.file_id,
            ))
    return specs


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
