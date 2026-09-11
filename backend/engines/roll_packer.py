import math
from dataclasses import dataclass, field
from typing import List, Dict, Tuple


@dataclass
class ArtworkSpec:
    name: str
    piece_w_mm: float
    piece_h_mm: float
    quantity: int
    shape_type: str = "rectangle"


@dataclass
class PlacedItem:
    item_id: int
    name: str
    slot_index: int
    x_mm: float
    y_mm: float
    w_mm: float
    h_mm: float
    shape_type: str
    segment_index: int


@dataclass
class SegmentBlock:
    segment_index: int
    is_full_segment: bool
    width_mm: float
    length_mm: float
    cutoff_y_mm: float  # Y-coordinate on roll canvas where cutoff line is drawn
    area_m2: float
    items_count: int
    placed_items: List[PlacedItem] = field(default_factory=list)


@dataclass
class MeterSegmentPackingResult:
    roll_width_mm: float
    segment_limit_mm: float
    total_roll_length_mm: float = 0.0
    segments: List[SegmentBlock] = field(default_factory=list)
    total_invoiced_m2: float = 0.0
    total_used_item_m2: float = 0.0
    scrap_offcut_m2: float = 0.0
    waste_percentage: float = 0.0


class MeterSegmentPacker:
    @staticmethod
    def pack_multi_artworks(
        roll_width_mm: float,
        segment_limit_mm: float,
        margin_l_mm: float,
        margin_r_mm: float,
        margin_t_mm: float,
        margin_b_mm: float,
        gap_mm: float,
        artworks: List[ArtworkSpec]
    ) -> MeterSegmentPackingResult:
        """
        Packs multiple artwork specs onto continuous roll media, segmenting into blocks
        up to segment_limit_mm and tracking leftover partial segments.
        Uses FFDH (First-Fit Decreasing Height) shelf packing.
        """
        # Expand individual piece instances
        all_pieces = []
        item_id_counter = 1
        for art in artworks:
            for _ in range(art.quantity):
                all_pieces.append({
                    "item_id": item_id_counter,
                    "name": art.name,
                    "w": art.piece_w_mm,
                    "h": art.piece_h_mm,
                    "shape": art.shape_type
                })
                item_id_counter += 1

        if not all_pieces:
            return MeterSegmentPackingResult(
                roll_width_mm=roll_width_mm,
                segment_limit_mm=segment_limit_mm
            )

        # Sort pieces by height descending for shelf packing
        all_pieces.sort(key=lambda p: p["h"], reverse=True)

        usable_w = max(1.0, roll_width_mm - margin_l_mm - margin_r_mm)

        segments: List[SegmentBlock] = []
        current_y_offset_mm = 0.0
        seg_idx = 1

        total_used_item_m2 = sum((p["w"] * p["h"]) for p in all_pieces) / 1000000.0
        total_invoiced_m2 = 0.0

        unplaced = list(all_pieces)

        while unplaced:
            # Create a new segment block
            seg_start_y = current_y_offset_mm + margin_t_mm
            current_shelf_y = seg_start_y
            max_seg_y = current_y_offset_mm + max(100.0, segment_limit_mm - margin_b_mm)

            placed_in_seg: List[PlacedItem] = []
            placed_indices = []

            # Shelf packing within segment bounds
            while unplaced:
                # Start a new shelf in current segment
                shelf_h = 0.0
                shelf_x = margin_l_mm
                placed_on_this_shelf = False

                for idx, piece in enumerate(unplaced):
                    if idx in placed_indices:
                        continue
                    pw = piece["w"]
                    ph = piece["h"]

                    # Check if fits horizontally on shelf (with 0.5mm floating point tolerance)
                    if shelf_x + pw <= roll_width_mm - margin_r_mm + 0.5:
                        # Check if fits vertically within segment limit
                        test_shelf_h = max(shelf_h, ph)
                        if current_shelf_y + test_shelf_h <= max_seg_y + 0.1 or not placed_in_seg:
                            # Place piece
                            shelf_h = test_shelf_h
                            placed_in_seg.append(PlacedItem(
                                item_id=piece["item_id"],
                                name=piece["name"],
                                slot_index=len(placed_in_seg) + 1,
                                x_mm=shelf_x,
                                y_mm=current_shelf_y,
                                w_mm=pw,
                                h_mm=ph,
                                shape_type=piece["shape"],
                                segment_index=seg_idx
                            ))
                            placed_indices.append(idx)
                            shelf_x += pw + gap_mm
                            placed_on_this_shelf = True

                if not placed_on_this_shelf:
                    # No more pieces fit on current shelf or segment
                    break

                current_shelf_y += shelf_h + gap_mm

            # Remove placed pieces from unplaced list
            unplaced = [p for i, p in enumerate(unplaced) if i not in placed_indices]

            # Segment metrics
            if placed_in_seg:
                max_placed_y = max(p.y_mm + p.h_mm for p in placed_in_seg)
                seg_length_mm = (max_placed_y - current_y_offset_mm) + margin_b_mm
                max_placed_x = max(p.x_mm + p.w_mm for p in placed_in_seg)
                seg_width_mm = max_placed_x + margin_r_mm

                # Check if this segment hit the segment_limit_mm (is_full_segment)
                is_full = (seg_length_mm >= segment_limit_mm - margin_t_mm - margin_b_mm - 1.0) and len(unplaced) > 0
                actual_seg_width = roll_width_mm if is_full else min(roll_width_mm, seg_width_mm)

                seg_area_m2 = (actual_seg_width * seg_length_mm) / 1000000.0
                total_invoiced_m2 += seg_area_m2

                cutoff_y_mm = current_y_offset_mm + seg_length_mm

                segments.append(SegmentBlock(
                    segment_index=seg_idx,
                    is_full_segment=is_full,
                    width_mm=actual_seg_width,
                    length_mm=seg_length_mm,
                    cutoff_y_mm=cutoff_y_mm,
                    area_m2=seg_area_m2,
                    items_count=len(placed_in_seg),
                    placed_items=placed_in_seg
                ))

                current_y_offset_mm = cutoff_y_mm
                seg_idx += 1
            else:
                break

        total_roll_length_mm = current_y_offset_mm
        scrap_offcut_m2 = max(0.0, total_invoiced_m2 - total_used_item_m2)
        waste_pct = (scrap_offcut_m2 / total_invoiced_m2 * 100.0) if total_invoiced_m2 > 0 else 0.0

        return MeterSegmentPackingResult(
            roll_width_mm=roll_width_mm,
            segment_limit_mm=segment_limit_mm,
            total_roll_length_mm=total_roll_length_mm,
            segments=segments,
            total_invoiced_m2=total_invoiced_m2,
            total_used_item_m2=total_used_item_m2,
            scrap_offcut_m2=scrap_offcut_m2,
            waste_percentage=waste_pct
        )

class GridRollPacker:
    @staticmethod
    def pack_multi_artworks(
        roll_width_mm: float, segment_limit_mm: float,
        margin_l_mm: float, margin_r_mm: float, margin_t_mm: float, margin_b_mm: float,
        gap_mm: float, artworks: List[ArtworkSpec]
    ) -> MeterSegmentPackingResult:
        segments = []
        current_items = []
        current_x = margin_l_mm
        current_y = margin_t_mm
        row_h = 0
        
        usable_w = roll_width_mm - margin_r_mm
        usable_h = segment_limit_mm - margin_b_mm
        
        item_id = 1
        for art in artworks:
            for _ in range(art.quantity):
                if current_x + art.piece_w_mm > usable_w + 0.1:
                    current_x = margin_l_mm
                    if row_h == 0: row_h = art.piece_h_mm
                    current_y += row_h + gap_mm
                    row_h = 0
                    
                if current_y + art.piece_h_mm > usable_h + 0.1:
                    seg_h = current_y - gap_mm + margin_b_mm
                    segments.append(SegmentResult(
                        segment_index=len(segments), segment_length_mm=seg_h,
                        items=current_items,
                        used_m2=sum(i.w_mm*i.h_mm for i in current_items)/1e6,
                        invoiced_m2=(roll_width_mm*seg_h)/1e6
                    ))
                    current_items = []
                    current_x = margin_l_mm
                    current_y = margin_t_mm
                    row_h = 0
                    
                current_items.append(PlacedItem(
                    item_id=item_id, name=art.name, slot_index=0,
                    x_mm=current_x, y_mm=current_y, w_mm=art.piece_w_mm, h_mm=art.piece_h_mm,
                    shape_type="rectangle", segment_index=len(segments)
                ))
                item_id += 1
                row_h = max(row_h, art.piece_h_mm)
                current_x += art.piece_w_mm + gap_mm
                
        if current_items:
            seg_h = current_y + row_h + margin_b_mm
            segments.append(SegmentResult(
                segment_index=len(segments), segment_length_mm=seg_h,
                items=current_items,
                used_m2=sum(i.w_mm*i.h_mm for i in current_items)/1e6,
                invoiced_m2=(roll_width_mm*seg_h)/1e6
            ))
            
        return MeterSegmentPackingResult(
            total_roll_length_mm=sum(s.segment_length_mm for s in segments),
            total_used_item_m2=sum(s.used_m2 for s in segments),
            total_invoiced_m2=sum(s.invoiced_m2 for s in segments),
            segments=segments
        )
