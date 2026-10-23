from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class SheetArtworkSpec:
    name: str
    piece_w_mm: float
    piece_h_mm: float
    quantity: int
    pdf_path: str = ""
    shape_type: str = "rectangle"
    keep_aspect: bool = False
    fill_color: str = "#FFFFFF"
    page_num: int = 0
    file_id: str = ""
    # Fit mode: "stretch" (force fill), "fit" (letterbox/pad), "crop" (fill+clip)
    fit_mode: str = "stretch"
    # User-requested content rotation (independent of packer auto-rotation)
    page_rotation: str = "none"   # "none" | "cw" | "ccw"
    # Bleed mode: "none" | "solid" | "mirror"
    bleed_mode: str = "none"
    bleed_mm: float = 0.0
    bleed_color: str = "#FFFFFF"
    # Bleed placement: "inside" (trim size locked, artwork inset) | "outside" (artwork locked, outer box expands)
    bleed_type: str = "inside"   # "inside" | "outside"
    # Unrotated target trim dimensions configured by the user
    target_w_mm: float = 0.0
    target_h_mm: float = 0.0


@dataclass
class PlacedSheetItem:
    item_id: int
    name: str
    sheet_index: int
    x_mm: float
    y_mm: float
    w_mm: float
    h_mm: float
    rotated: bool
    pdf_path: str = ""
    shape_type: str = "rectangle"
    keep_aspect: bool = False
    fill_color: str = "#FFFFFF"
    page_num: int = 0
    file_id: str = ""
    fit_mode: str = "stretch"
    page_rotation: str = "none"
    bleed_mode: str = "none"
    bleed_mm: float = 0.0
    bleed_color: str = "#FFFFFF"
    bleed_type: str = "inside"
    target_w_mm: float = 0.0
    target_h_mm: float = 0.0



@dataclass
class SingleSheetResult:
    sheet_index: int
    sheet_w_mm: float
    sheet_h_mm: float
    placed_items: List[PlacedSheetItem] = field(default_factory=list)
    used_area_m2: float = 0.0
    efficiency_pct: float = 0.0


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float


class MaxRectsSheetPacker:
    """
    Max-Rects 2D Bin Packing Engine for fixed press sheet dimensions (SRA3, A3, 13x19", etc.).
    Evaluates 0° and 90° piece rotations to optimize paper yield and efficiency.
    """

    @staticmethod
    def pack_sheets(
        sheet_w_mm: float,
        sheet_h_mm: float,
        margin_l_mm: float,
        margin_r_mm: float,
        margin_t_mm: float,
        margin_b_mm: float,
        gap_mm: float,
        artworks: List[SheetArtworkSpec],
        allow_rotation: bool = True,
        uniform_orientation: bool = True,
        job_mode: str = "gang",
        rows: int = 0,
        cols: int = 0
    ) -> List[SingleSheetResult]:
        usable_x = margin_l_mm
        usable_y = margin_t_mm
        usable_w = max(1.0, sheet_w_mm - margin_l_mm - margin_r_mm)
        usable_h = max(1.0, sheet_h_mm - margin_t_mm - margin_b_mm)

        # In uniform_orientation mode (Polar / Guillotine cutter friendly),
        # all copies of a given artwork must have the exact same orientation.
        # We determine whether 0° or 90° yields better grid yield for that artwork.
        art_orientations = {}
        for art in artworks:
            if not allow_rotation:
                art_orientations[art.name] = False
            elif uniform_orientation:
                eff_gap = gap_mm
                cols_unrot = max(0, int((usable_w + eff_gap) // (art.piece_w_mm + eff_gap))) if (art.piece_w_mm + eff_gap) > 0 else 0
                rows_unrot = max(0, int((usable_h + eff_gap) // (art.piece_h_mm + eff_gap))) if (art.piece_h_mm + eff_gap) > 0 else 0
                yield_unrot = cols_unrot * rows_unrot

                cols_rot = max(0, int((usable_w + eff_gap) // (art.piece_h_mm + eff_gap))) if (art.piece_h_mm + eff_gap) > 0 else 0
                rows_rot = max(0, int((usable_h + eff_gap) // (art.piece_w_mm + eff_gap))) if (art.piece_w_mm + eff_gap) > 0 else 0
                yield_rot = cols_rot * rows_rot

                # Prefer rotation if it fits strictly more items, or if unrotated doesn't fit at all
                if yield_unrot == 0 and yield_rot > 0:
                    art_orientations[art.name] = True
                elif yield_rot > yield_unrot:
                    art_orientations[art.name] = True
                else:
                    art_orientations[art.name] = False
            else:
                art_orientations[art.name] = None  # Free per-piece rotation

        # Expand item instances
        unplaced_items = []
        item_id_counter = 1
        for art in artworks:
            forced_rot = art_orientations.get(art.name)
            pw = art.piece_h_mm if forced_rot is True else art.piece_w_mm
            ph = art.piece_w_mm if forced_rot is True else art.piece_h_mm
            for _ in range(art.quantity):
                unplaced_items.append({
                    "item_id": item_id_counter,
                    "name": art.name,
                    "w": pw,
                    "h": ph,
                    "forced_rot": forced_rot,
                    "pdf_path": art.pdf_path,
                    "shape_type": art.shape_type,
                    "keep_aspect": art.keep_aspect,
                    "fill_color": art.fill_color,
                    "page_num": getattr(art, "page_num", 0),
                    "file_id": getattr(art, "file_id", ""),
                    "fit_mode": getattr(art, "fit_mode", "stretch"),
                    "page_rotation": getattr(art, "page_rotation", "none"),
                    "bleed_mode": getattr(art, "bleed_mode", "none"),
                    "bleed_mm": getattr(art, "bleed_mm", 0.0),
                    "bleed_color": getattr(art, "bleed_color", "#FFFFFF"),
                    "bleed_type": getattr(art, "bleed_type", "inside"),
                    "target_w_mm": getattr(art, "target_w_mm", 0.0) or art.piece_w_mm,
                    "target_h_mm": getattr(art, "target_h_mm", 0.0) or art.piece_h_mm,
                })
                item_id_counter += 1

        if not unplaced_items:
            return []

        if job_mode == "book":
            # For books, keep pieces strictly in sequential item_id (page order)
            unplaced_items.sort(key=lambda p: p["item_id"])
        else:
            # Sort pieces by area descending, preserving item_id sequence for identical sizes
            unplaced_items.sort(key=lambda p: (round(p["w"] * p["h"], 2), -p["item_id"]), reverse=True)

        sheets_results: List[SingleSheetResult] = []
        sheet_index = 1

        # MANUAL ROWS x COLUMNS GRID OVERRIDE
        # If user explicitly specifies rows > 0 or cols > 0, generate a strict grid layout
        if (rows and rows > 0) or (cols and cols > 0):
            req_cols = max(1, cols) if (cols and cols > 0) else None
            req_rows = max(1, rows) if (rows and rows > 0) else None

            sample_w = unplaced_items[0]["w"]
            sample_h = unplaced_items[0]["h"]

            # Compute unspecified dimension from sheet bounds if only one is specified
            eff_gap = gap_mm
            if req_cols is None:
                req_cols = max(1, int((usable_w + eff_gap) // (sample_w + eff_gap))) if (sample_w + eff_gap) > 0 else 1
            if req_rows is None:
                req_rows = max(1, int((usable_h + eff_gap) // (sample_h + eff_gap))) if (sample_h + eff_gap) > 0 else 1

            capacity_per_sheet = req_cols * req_rows
            total_items = len(unplaced_items)
            curr_idx = 0

            while curr_idx < total_items:
                chunk = unplaced_items[curr_idx:curr_idx + capacity_per_sheet]
                chunk_placed = [
                    MaxRectsSheetPacker._make_placed_item(
                        itm,
                        sheet_index=sheet_index,
                        x_mm=usable_x + (idx_in_sheet % req_cols) * (itm["w"] + gap_mm),
                        y_mm=usable_y + (idx_in_sheet // req_cols) * (itm["h"] + gap_mm),
                        w_mm=itm["w"],
                        h_mm=itm["h"],
                        rotated=bool(itm.get("forced_rot")),
                    )
                    for idx_in_sheet, itm in enumerate(chunk)
                ]

                sheets_results.append(
                    MaxRectsSheetPacker._make_sheet_result(
                        sheet_index, sheet_w_mm, sheet_h_mm, chunk_placed
                    )
                )

                curr_idx += capacity_per_sheet
                sheet_index += 1

            return sheets_results

        # FAST PATH FOR BOOK IMPOSITION:
        # In book mode, all pages have identical target trim dimensions and are placed sequentially.
        # Once Sheet 1 is packed, every subsequent sheet has the exact same grid/box coordinates,
        # differing only by sequential page assignment. Instead of solving 125+ heavy MaxRects
        # geometric bin-packing passes, we calculate Sheet 1 once and replicate the template.
        if job_mode == "book" and unplaced_items:
            sheet1_placed, _ = MaxRectsSheetPacker._pack_single_sheet_pass(
                unplaced_items, 1, usable_x, usable_y, usable_w, usable_h, gap_mm, allow_rotation
            )
            if not sheet1_placed:
                return []

            capacity_per_sheet = len(sheet1_placed)
            sheets_results.append(
                MaxRectsSheetPacker._make_sheet_result(1, sheet_w_mm, sheet_h_mm, sheet1_placed)
            )

            # 2. Replicate Sheet 1 template for all remaining items in chunks of capacity_per_sheet
            curr_idx = capacity_per_sheet
            sheet_counter = 2
            total_items = len(unplaced_items)

            while curr_idx < total_items:
                chunk = unplaced_items[curr_idx:curr_idx + capacity_per_sheet]
                chunk_placed = [
                    MaxRectsSheetPacker._make_placed_item(
                        itm,
                        sheet_index=sheet_counter,
                        x_mm=sheet1_placed[slot_idx].x_mm,
                        y_mm=sheet1_placed[slot_idx].y_mm,
                        w_mm=sheet1_placed[slot_idx].w_mm,
                        h_mm=sheet1_placed[slot_idx].h_mm,
                        rotated=sheet1_placed[slot_idx].rotated,
                    )
                    for slot_idx, itm in enumerate(chunk)
                ]
                sheets_results.append(
                    MaxRectsSheetPacker._make_sheet_result(
                        sheet_counter, sheet_w_mm, sheet_h_mm, chunk_placed
                    )
                )
                curr_idx += capacity_per_sheet
                sheet_counter += 1

            return sheets_results

        # GENERAL GANG RUN PACKING LOOP (Heterogeneous sizes):
        while unplaced_items:
            placed_on_sheet, remaining_unplaced = MaxRectsSheetPacker._pack_single_sheet_pass(
                unplaced_items,
                sheet_index,
                usable_x,
                usable_y,
                usable_w,
                usable_h,
                gap_mm,
                allow_rotation,
            )

            if not placed_on_sheet:
                # Security break to prevent infinite loop if item larger than sheet
                break

            sheets_results.append(
                MaxRectsSheetPacker._make_sheet_result(
                    sheet_index, sheet_w_mm, sheet_h_mm, placed_on_sheet
                )
            )

            sheet_index += 1
            unplaced_items = remaining_unplaced

        return sheets_results

    @staticmethod
    def _make_placed_item(
        itm: dict,
        sheet_index: int,
        x_mm: float,
        y_mm: float,
        w_mm: float,
        h_mm: float,
        rotated: bool,
    ) -> PlacedSheetItem:
        return PlacedSheetItem(
            item_id=itm["item_id"],
            name=itm["name"],
            sheet_index=sheet_index,
            x_mm=x_mm,
            y_mm=y_mm,
            w_mm=w_mm,
            h_mm=h_mm,
            rotated=rotated,
            pdf_path=itm["pdf_path"],
            shape_type=itm["shape_type"],
            keep_aspect=itm["keep_aspect"],
            fill_color=itm["fill_color"],
            page_num=itm.get("page_num", 0),
            file_id=itm.get("file_id", ""),
            fit_mode=itm.get("fit_mode", "stretch"),
            page_rotation=itm.get("page_rotation", "none"),
            bleed_mode=itm.get("bleed_mode", "none"),
            bleed_mm=itm.get("bleed_mm", 0.0),
            bleed_color=itm.get("bleed_color", "#FFFFFF"),
            bleed_type=itm.get("bleed_type", "inside"),
            target_w_mm=itm.get("target_w_mm", 0.0),
            target_h_mm=itm.get("target_h_mm", 0.0),
        )

    @staticmethod
    def _find_best_rect(
        free_rects: List[Rect],
        pw: float,
        ph: float,
        forced_rot,
        allow_rotation: bool,
    ) -> Tuple[int, bool]:
        best_rect_idx = -1
        best_rotated = forced_rot if forced_rot is not None else False
        best_short_side_fit = float("inf")

        for i, r in enumerate(free_rects):
            if forced_rot is not None:
                if r.w >= pw and r.h >= ph:
                    leftover = min(r.w - pw, r.h - ph)
                    if leftover < best_short_side_fit:
                        best_short_side_fit = leftover
                        best_rect_idx = i
                        best_rotated = forced_rot
            else:
                if r.w >= pw and r.h >= ph:
                    leftover = min(r.w - pw, r.h - ph)
                    if leftover < best_short_side_fit:
                        best_short_side_fit = leftover
                        best_rect_idx = i
                        best_rotated = False

                if allow_rotation and r.w >= ph and r.h >= pw:
                    leftover = min(r.w - ph, r.h - pw)
                    if leftover < best_short_side_fit:
                        best_short_side_fit = leftover
                        best_rect_idx = i
                        best_rotated = True

        return best_rect_idx, best_rotated

    @staticmethod
    def _split_and_prune_free_rects(
        free_rects: List[Rect],
        placed_box: Rect,
    ) -> List[Rect]:
        new_free: List[Rect] = []
        for fr in free_rects:
            if not (
                placed_box.x >= fr.x + fr.w
                or placed_box.x + placed_box.w <= fr.x
                or placed_box.y >= fr.y + fr.h
                or placed_box.y + placed_box.h <= fr.y
            ):
                if placed_box.x > fr.x and placed_box.x < fr.x + fr.w:
                    new_free.append(Rect(fr.x, fr.y, placed_box.x - fr.x, fr.h))
                if placed_box.x + placed_box.w < fr.x + fr.w:
                    new_free.append(
                        Rect(
                            placed_box.x + placed_box.w,
                            fr.y,
                            fr.x + fr.w - (placed_box.x + placed_box.w),
                            fr.h,
                        )
                    )
                if placed_box.y > fr.y and placed_box.y < fr.y + fr.h:
                    new_free.append(Rect(fr.x, fr.y, fr.w, placed_box.y - fr.y))
                if placed_box.y + placed_box.h < fr.y + fr.h:
                    new_free.append(
                        Rect(
                            fr.x,
                            placed_box.y + placed_box.h,
                            fr.w,
                            fr.y + fr.h - (placed_box.y + placed_box.h),
                        )
                    )
            else:
                new_free.append(fr)

        pruned: List[Rect] = []
        for i_f, r1 in enumerate(new_free):
            is_contained = False
            for j_f, r2 in enumerate(new_free):
                if (
                    i_f != j_f
                    and r1.x >= r2.x
                    and r1.y >= r2.y
                    and (r1.x + r1.w) <= (r2.x + r2.w)
                    and (r1.y + r1.h) <= (r2.y + r2.h)
                ):
                    is_contained = True
                    break
            if not is_contained:
                pruned.append(r1)
        return pruned

    @staticmethod
    def _make_sheet_result(
        sheet_index: int,
        sheet_w_mm: float,
        sheet_h_mm: float,
        placed_items: List[PlacedSheetItem],
    ) -> SingleSheetResult:
        used_area = sum((p.w_mm * p.h_mm) for p in placed_items) / 1000000.0
        total_sheet_area = (sheet_w_mm * sheet_h_mm) / 1000000.0
        eff = (used_area / total_sheet_area) * 100.0 if total_sheet_area > 0 else 0.0
        return SingleSheetResult(
            sheet_index=sheet_index,
            sheet_w_mm=sheet_w_mm,
            sheet_h_mm=sheet_h_mm,
            placed_items=placed_items,
            used_area_m2=used_area,
            efficiency_pct=eff,
        )

    @staticmethod
    def _pack_single_sheet_pass(
        items: List[dict],
        sheet_index: int,
        usable_x: float,
        usable_y: float,
        usable_w: float,
        usable_h: float,
        gap_mm: float,
        allow_rotation: bool,
    ) -> Tuple[List[PlacedSheetItem], List[dict]]:
        free_rects: List[Rect] = [Rect(usable_x, usable_y, usable_w, usable_h)]
        placed_on_sheet: List[PlacedSheetItem] = []
        remaining_unplaced: List[dict] = []

        for item in items:
            pw, ph = item["w"], item["h"]
            forced_rot = item.get("forced_rot")
            best_rect_idx, best_rotated = MaxRectsSheetPacker._find_best_rect(
                free_rects, pw, ph, forced_rot, allow_rotation
            )

            if best_rect_idx != -1:
                target_rect = free_rects[best_rect_idx]
                placed_w = (ph if best_rotated else pw) if forced_rot is None else pw
                placed_h = (pw if best_rotated else ph) if forced_rot is None else ph

                placed_on_sheet.append(
                    MaxRectsSheetPacker._make_placed_item(
                        item,
                        sheet_index=sheet_index,
                        x_mm=target_rect.x,
                        y_mm=target_rect.y,
                        w_mm=placed_w,
                        h_mm=placed_h,
                        rotated=best_rotated,
                    )
                )

                placed_box = Rect(
                    target_rect.x,
                    target_rect.y,
                    placed_w + gap_mm,
                    placed_h + gap_mm,
                )
                free_rects = MaxRectsSheetPacker._split_and_prune_free_rects(
                    free_rects, placed_box
                )
            else:
                remaining_unplaced.append(item)

        return placed_on_sheet, remaining_unplaced
