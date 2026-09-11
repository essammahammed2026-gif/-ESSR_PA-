import fitz
from typing import List
from engines.sheet_packer import SingleSheetResult, PlacedSheetItem


class SheetGangExporter:
    """
    Press-Ready PDF Exporter for Gang Sheets.
    Renders placed PDF artwork items, registration corner marks, crosshair crop marks,
    and optional vector CutContour stroke layers.
    """

    MM_TO_PTS = 72.0 / 25.4

    @staticmethod
    def export_pdf(
        sheet_results: List[SingleSheetResult],
        output_pdf_path: str,
        show_crop_marks: bool = True,
        show_reg_marks: bool = True,
        draw_cut_contour: bool = True,
        draw_border: bool = False,
        border_color: str = "#000000"
    ) -> bool:
        if not sheet_results:
            return False

        doc = fitz.open()

        for sheet in sheet_results:
            sw_pt = sheet.sheet_w_mm * SheetGangExporter.MM_TO_PTS
            sh_pt = sheet.sheet_h_mm * SheetGangExporter.MM_TO_PTS

            page = doc.new_page(width=sw_pt, height=sh_pt)
            shape = page.new_shape()

            # Draw registration corner marks if enabled
            if show_reg_marks:
                reg_size_pt = 5.0 * SheetGangExporter.MM_TO_PTS
                offset_pt = 6.0 * SheetGangExporter.MM_TO_PTS
                corners = [
                    (offset_pt, offset_pt),
                    (sw_pt - offset_pt, offset_pt),
                    (offset_pt, sh_pt - offset_pt),
                    (sw_pt - offset_pt, sh_pt - offset_pt)
                ]
                for cx, cy in corners:
                    shape.draw_circle(fitz.Point(cx, cy), reg_size_pt / 2.0)
                    shape.finish(color=(0, 0, 0), fill=(0, 0, 0), stroke_opacity=1.0)

            # Insert placed artwork items & draw crop marks
            for item in sheet.placed_items:
                ix_pt = item.x_mm * SheetGangExporter.MM_TO_PTS
                iy_pt = item.y_mm * SheetGangExporter.MM_TO_PTS
                iw_pt = item.w_mm * SheetGangExporter.MM_TO_PTS
                ih_pt = item.h_mm * SheetGangExporter.MM_TO_PTS

                target_rect = fitz.Rect(ix_pt, iy_pt, ix_pt + iw_pt, iy_pt + ih_pt)

                # Draw artwork if PDF path valid
                if item.pdf_path and fitz.os.path.exists(item.pdf_path):
                    try:
                        src_doc = fitz.open(item.pdf_path)
                        if len(src_doc) > 0:
                            page.show_pdf_page(target_rect, src_doc, 0, rotate=90 if item.rotated else 0)
                        src_doc.close()
                    except Exception as e:
                        print(f"Error rendering PDF artwork item {item.name}: {e}")
                else:
                    # Draw dummy item fill
                    shape.draw_rect(target_rect)
                    shape.finish(color=(0.3, 0.5, 0.8), fill=(0.9, 0.95, 1.0), stroke_opacity=1.0)

                if draw_border:
                    def hex_to_rgb(h):
                        h = h.lstrip('#')
                        return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4)) if len(h)==6 else (0,0,0)
                    shape.draw_rect(target_rect)
                    shape.finish(color=hex_to_rgb(border_color), width=1.0, stroke_opacity=1.0)
                    
                # Draw CutContour stroke if enabled
                if draw_cut_contour:
                    shape.draw_rect(target_rect)
                    # Spot magenta stroke for CutContour
                    shape.finish(color=(1.0, 0.0, 1.0), width=0.5, stroke_opacity=1.0)

                # Draw Crop Marks (Standard Offset)
                if show_crop_marks:
                    off = 1.5 * SheetGangExporter.MM_TO_PTS
                    mlen = 3.0 * SheetGangExporter.MM_TO_PTS
                    
                    # Top-left corner
                    shape.draw_line(fitz.Point(ix_pt - off, iy_pt), fitz.Point(ix_pt - off - mlen, iy_pt))
                    shape.draw_line(fitz.Point(ix_pt, iy_pt - off), fitz.Point(ix_pt, iy_pt - off - mlen))
                    # Top-right corner
                    shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt))
                    shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt - off), fitz.Point(ix_pt + iw_pt, iy_pt - off - mlen))
                    # Bottom-left corner
                    shape.draw_line(fitz.Point(ix_pt - off, iy_pt + ih_pt), fitz.Point(ix_pt - off - mlen, iy_pt + ih_pt))
                    shape.draw_line(fitz.Point(ix_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt, iy_pt + ih_pt + off + mlen))
                    # Bottom-right corner
                    shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt + ih_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt + ih_pt))
                    shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off + mlen))
                    
                    shape.finish(color=(0, 0, 0), width=0.2, stroke_opacity=1.0)

            shape.commit()

        doc.save(output_pdf_path)
        doc.close()
        return True
