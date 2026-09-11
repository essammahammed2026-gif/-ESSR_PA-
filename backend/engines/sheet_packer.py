import math
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
        allow_rotation: bool = True
    ) -> List[SingleSheetResult]:
        # Expand item instances
        unplaced_items = []
        item_id_counter = 1
        for art in artworks:
            for _ in range(art.quantity):
                unplaced_items.append({
                    "item_id": item_id_counter,
                    "name": art.name,
                    "w": art.piece_w_mm,
                    "h": art.piece_h_mm,
                    "pdf_path": art.pdf_path,
                    "shape_type": art.shape_type
                })
                item_id_counter += 1

        if not unplaced_items:
            return []

        # Sort pieces by area descending
        unplaced_items.sort(key=lambda p: p["w"] * p["h"], reverse=True)

        usable_x = margin_l_mm
        usable_y = margin_t_mm
        usable_w = max(1.0, sheet_w_mm - margin_l_mm - margin_r_mm)
        usable_h = max(1.0, sheet_h_mm - margin_t_mm - margin_b_mm)

        sheets_results: List[SingleSheetResult] = []
        sheet_index = 1

        while unplaced_items:
            free_rects: List[Rect] = [Rect(usable_x, usable_y, usable_w, usable_h)]
            placed_on_sheet: List[PlacedSheetItem] = []
            remaining_unplaced = []

            for item in unplaced_items:
                pw, ph = item["w"], item["h"]
                best_rect_idx = -1
                best_rotated = False
                best_short_side_fit = float('inf')

                for i, r in enumerate(free_rects):
                    # Check 0° rotation
                    if r.w >= pw and r.h >= ph:
                        leftover = min(r.w - pw, r.h - ph)
                        if leftover < best_short_side_fit:
                            best_short_side_fit = leftover
                            best_rect_idx = i
                            best_rotated = False

                    # Check 90° rotation
                    if allow_rotation and r.w >= ph and r.h >= pw:
                        leftover = min(r.w - ph, r.h - pw)
                        if leftover < best_short_side_fit:
                            best_short_side_fit = leftover
                            best_rect_idx = i
                            best_rotated = True

                if best_rect_idx != -1:
                    target_rect = free_rects[best_rect_idx]
                    placed_w = ph if best_rotated else pw
                    placed_h = pw if best_rotated else ph

                    placed_item = PlacedSheetItem(
                        item_id=item["item_id"],
                        name=item["name"],
                        sheet_index=sheet_index,
                        x_mm=target_rect.x,
                        y_mm=target_rect.y,
                        w_mm=placed_w,
                        h_mm=placed_h,
                        rotated=best_rotated,
                        pdf_path=item["pdf_path"],
                        shape_type=item["shape_type"]
                    )
                    placed_on_sheet.append(placed_item)

                    # Split free rect
                    new_free = []
                    placed_box = Rect(target_rect.x, target_rect.y, placed_w + gap_mm, placed_h + gap_mm)

                    for fr in free_rects:
                        # Check intersection
                        if not (placed_box.x >= fr.x + fr.w or placed_box.x + placed_box.w <= fr.x or
                                placed_box.y >= fr.y + fr.h or placed_box.y + placed_box.h <= fr.y):
                            # Split into top, bottom, left, right
                            if placed_box.x > fr.x and placed_box.x < fr.x + fr.w:
                                new_free.append(Rect(fr.x, fr.y, placed_box.x - fr.x, fr.h))
                            if placed_box.x + placed_box.w < fr.x + fr.w:
                                new_free.append(Rect(placed_box.x + placed_box.w, fr.y, fr.x + fr.w - (placed_box.x + placed_box.w), fr.h))
                            if placed_box.y > fr.y and placed_box.y < fr.y + fr.h:
                                new_free.append(Rect(fr.x, fr.y, fr.w, placed_box.y - fr.y))
                            if placed_box.y + placed_box.h < fr.y + fr.h:
                                new_free.append(Rect(fr.x, placed_box.y + placed_box.h, fr.w, fr.y + fr.h - (placed_box.y + placed_box.h)))
                        else:
                            new_free.append(fr)

                    # Prune contained rects
                    pruned = []
                    for i, r1 in enumerate(new_free):
                        is_contained = False
                        for j, r2 in enumerate(new_free):
                            if i != j and r1.x >= r2.x and r1.y >= r2.y and (r1.x + r1.w) <= (r2.x + r2.w) and (r1.y + r1.h) <= (r2.y + r2.h):
                                is_contained = True
                                break
                        if not is_contained:
                            pruned.append(r1)
                    free_rects = pruned
                else:
                    remaining_unplaced.append(item)

            if not placed_on_sheet:
                # Security break to prevent infinite loop if item larger than sheet
                break

            used_area = sum((p.w_mm * p.h_mm) for p in placed_on_sheet) / 1000000.0
            total_sheet_area = (sheet_w_mm * sheet_h_mm) / 1000000.0
            eff = (used_area / total_sheet_area) * 100.0 if total_sheet_area > 0 else 0.0

            sheets_results.append(SingleSheetResult(
                sheet_index=sheet_index,
                sheet_w_mm=sheet_w_mm,
                sheet_h_mm=sheet_h_mm,
                placed_items=placed_on_sheet,
                used_area_m2=used_area,
                efficiency_pct=eff
            ))

            sheet_index += 1
            unplaced_items = remaining_unplaced

        return sheets_results

class GridSheetPacker:
    @staticmethod
    def pack_sheets(
        sheet_w_mm: float, sheet_h_mm: float,
        margin_l_mm: float, margin_r_mm: float, margin_t_mm: float, margin_b_mm: float,
        gap_mm: float, artworks: List[SheetArtworkSpec]
    ) -> List[SingleSheetResult]:
        results = []
        current_sheet_items = []
        current_x = margin_l_mm
        current_y = margin_t_mm
        row_h = 0
        
        usable_w = sheet_w_mm - margin_r_mm
        usable_h = sheet_h_mm - margin_b_mm
        
        item_id = 1
        for art in artworks:
            # Force size consistency for grid mode
            for _ in range(art.quantity):
                if current_x + art.piece_w_mm > usable_w + 0.1:
                    current_x = margin_l_mm
                    if row_h == 0: row_h = art.piece_h_mm
                    current_y += row_h + gap_mm
                    row_h = 0
                    
                if current_y + art.piece_h_mm > usable_h + 0.1:
                    used = sum(i.w_mm * i.h_mm for i in current_sheet_items)
                    results.append(SingleSheetResult(
                        sheet_index=len(results), sheet_w_mm=sheet_w_mm, sheet_h_mm=sheet_h_mm,
                        placed_items=current_sheet_items,
                        total_area_m2=(sheet_w_mm*sheet_h_mm)/1e6,
                        used_area_m2=used/1e6, efficiency_pct=0
                    ))
                    current_sheet_items = []
                    current_x = margin_l_mm
                    current_y = margin_t_mm
                    row_h = 0
                    
                current_sheet_items.append(PlacedSheetItem(
                    item_id=item_id, name=art.name, sheet_index=len(results),
                    x_mm=current_x, y_mm=current_y, w_mm=art.piece_w_mm, h_mm=art.piece_h_mm,
                    rotated=False, pdf_path=""
                ))
                item_id += 1
                row_h = max(row_h, art.piece_h_mm)
                current_x += art.piece_w_mm + gap_mm
                
        if current_sheet_items:
            used = sum(i.w_mm * i.h_mm for i in current_sheet_items)
            results.append(SingleSheetResult(
                sheet_index=len(results), sheet_w_mm=sheet_w_mm, sheet_h_mm=sheet_h_mm,
                placed_items=current_sheet_items,
                total_area_m2=(sheet_w_mm*sheet_h_mm)/1e6,
                used_area_m2=used/1e6, efficiency_pct=0
            ))
            
        for r in results:
            if r.total_area_m2 > 0: r.efficiency_pct = (r.used_area_m2 / r.total_area_m2) * 100
        return results
