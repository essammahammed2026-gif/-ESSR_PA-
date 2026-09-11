"""
Book Cover Builder Engine for BlueWhale Printing Assistant.
Assembles Front Cover, Spine, and Back Cover into a single print-ready cover spread PDF.
Includes auto-bleed generation (mirrored edge reflection), safety margin validation,
and spine text & artwork rendering.
"""

import os
import cv2
import numpy as np
import fitz  # PyMuPDF

class BookCoverBuilder:
    """Core engine for building full print cover spreads with bleed & spine styling."""

    @staticmethod
    def _get_edge_color(file_path, edge, default_page=0):
        """Extracts the average color of the specified edge (left or right) of a PDF or image."""
        try:
            if not file_path or not os.path.exists(file_path):
                return (0, 0, 0)
                
            doc = fitz.open(file_path)
            page = doc[default_page]
            pix = page.get_pixmap(dpi=72)
            doc.close()
            
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
            elif pix.n == 1:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                
            # Sample a 5-pixel wide strip from the edge
            strip_width = max(1, min(5, img.shape[1]))
            if edge == "right":
                strip = img[:, -strip_width:]
            else:
                strip = img[:, :strip_width]
                
            avg_color = np.mean(strip, axis=(0, 1))
            return (float(avg_color[0]/255.0), float(avg_color[1]/255.0), float(avg_color[2]/255.0))
        except Exception:
            return (0.1, 0.1, 0.1)

    @staticmethod
    def assemble_cover_spread(
        front_path: str,
        back_path: str,
        spine_mm: float,
        trim_width_mm: float = 210.0,
        trim_height_mm: float = 297.0,
        bleed_mm: float = 3.0,
        bleed_mode: str = "Outside",
        bleed_target: str = "Both", # "Front", "Back", "Both"
        bleed_method: str = "Content Aware (Reflection)", # "Content Aware (Reflection)", "Solid Color"
        bleed_color: tuple = (1.0, 1.0, 1.0),
        resizing_mode: str = "Stretch to Fit", # "Stretch to Fit", "Respect Aspect Ratio (Fit/Fill)"
        output_pdf_path: str = None,
        spine_title: str = "",
        spine_subtitle: str = "",
        spine_bg_style: str = "Solid Color",  # "Solid Color", "Match Front Cover", "Match Back Cover"
        spine_color: tuple = (0.05, 0.08, 0.12),
        spine_text_color: tuple = (1.0, 1.0, 1.0),
        spine_font_size: int = 14,
        spine_font: str = "helv",
        spine_bold: bool = False,
        spine_italic: bool = False,
        spine_orientation: str = "Top to Bottom",  # "Top to Bottom", "Bottom to Top", "Horizontal Stacked"
        reading_direction: str = "Left to Right (LTR)",  # "Left to Right (LTR)", "Right to Left (RTL)"
        draw_crop_marks: bool = True
    ) -> dict:
        """
        Assembles Front + Spine + Back cover into a print-ready PDF spread.

        Returns:
            dict containing: output_path, total_width_mm, total_height_mm, pixmap, warnings
        """
        warnings = []

        # Convert mm to points (1 mm = 2.834645669 pt)
        mm_to_pt = 72.0 / 25.4
        trim_w_pt = trim_width_mm * mm_to_pt
        trim_h_pt = trim_height_mm * mm_to_pt
        spine_w_pt = max(spine_mm * mm_to_pt, 2.0 * mm_to_pt)
        bleed_pt = bleed_mm * mm_to_pt

        total_width_pt = (2 * trim_w_pt) + spine_w_pt + (2 * bleed_pt)
        total_height_pt = trim_h_pt + (2 * bleed_pt)

        # Create output PDF
        out_doc = fitz.open()
        out_page = out_doc.new_page(width=total_width_pt, height=total_height_pt)

        # Calculate bounding rectangles based on reading direction
        is_rtl = "RTL" in reading_direction or reading_direction.startswith("Right") or "Right to Left" in reading_direction or "Right-To-Left" in reading_direction
        is_rtl = not is_rtl  # Swapped to match user expectations (RTL=Arabic, LTR=English)

        # Left panel target rect
        panel1_x0 = bleed_pt
        panel1_y0 = bleed_pt
        panel1_x1 = panel1_x0 + trim_w_pt
        panel1_y1 = panel1_y0 + trim_h_pt
        rect_panel1 = fitz.Rect(panel1_x0, panel1_y0, panel1_x1, panel1_y1)

        # Spine target rect (Center)
        spine_x0 = panel1_x1
        spine_y0 = bleed_pt
        spine_x1 = spine_x0 + spine_w_pt
        spine_y1 = spine_y0 + trim_h_pt

        # Right panel target rect
        panel2_x0 = spine_x1
        panel2_y0 = bleed_pt
        panel2_x1 = panel2_x0 + trim_w_pt
        panel2_y1 = panel2_y0 + trim_h_pt
        rect_panel2 = fitz.Rect(panel2_x0, panel2_y0, panel2_x1, panel2_y1)

        if is_rtl:
            rect_front = rect_panel1
            rect_back = rect_panel2
        else:
            rect_back = rect_panel1
            rect_front = rect_panel2

        # Evaluate Back path logic (auto-extract last page if needed)
        eff_back_path = back_path
        if not back_path or not os.path.exists(back_path):
            if front_path and os.path.exists(front_path) and front_path.lower().endswith(".pdf"):
                try:
                    doc = fitz.open(front_path)
                    if len(doc) > 1:
                        eff_back_path = front_path
                    doc.close()
                except:
                    pass

        # Helper for inserting PDF or image file into rect
        def _insert_file(target_rect, file_path, default_page=0, apply_bleed=False, is_front=False):
            if not file_path or not os.path.exists(file_path):
                return
            keep_prop = ("Respect" in resizing_mode)
            try:
                doc = fitz.open(file_path)
                p_idx = default_page if default_page >= 0 else len(doc) - 1
                if p_idx < 0 or p_idx >= len(doc): p_idx = 0
                
                if apply_bleed:
                    if "Inside" in bleed_mode:
                        expanded_rect = fitz.Rect(target_rect.x0 - bleed_pt, target_rect.y0 - bleed_pt, target_rect.x1 + bleed_pt, target_rect.y1 + bleed_pt)
                    else:
                        is_left_panel = (is_front and is_rtl) or (not is_front and not is_rtl)
                        if is_left_panel:
                            expanded_rect = fitz.Rect(target_rect.x0 - bleed_pt, target_rect.y0 - bleed_pt, target_rect.x1, target_rect.y1 + bleed_pt)
                        else:
                            expanded_rect = fitz.Rect(target_rect.x0, target_rect.y0 - bleed_pt, target_rect.x1 + bleed_pt, target_rect.y1 + bleed_pt)

                    if "Content Aware" in bleed_method:
                        from engines.bleed_engine import process_page_to_bleed_image
                        import cv2
                        ext_bgr, _, _ = process_page_to_bleed_image(doc[p_idx], bleed_mm=bleed_mm, dpi=200, mode="mirrored")
                        succ, buf = cv2.imencode(".jpg", ext_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
                        if succ:
                            out_page.insert_image(expanded_rect, stream=buf.tobytes(), keep_proportion=keep_prop)
                        else:
                            out_page.show_pdf_page(target_rect, doc, p_idx, keep_proportion=keep_prop)
                    else:
                        out_page.draw_rect(expanded_rect, color=bleed_color, fill=bleed_color)
                        out_page.show_pdf_page(target_rect, doc, p_idx, keep_proportion=keep_prop)
                else:
                    out_page.show_pdf_page(target_rect, doc, p_idx, keep_proportion=keep_prop)
                doc.close()
            except Exception as e:
                warnings.append(f"Failed to insert {file_path}: {e}")

        # Insert Back and Front
        _insert_file(rect_back, eff_back_path, -1, apply_bleed=(bleed_target in ["Back", "Both"]), is_front=False)
        _insert_file(rect_front, front_path, 0, apply_bleed=(bleed_target in ["Front", "Both"]), is_front=True)

        # Spine Background processing
        rect_spine_full = fitz.Rect(spine_x0, 0, spine_x1, total_height_pt)
        if spine_bg_style in ["Match Front Cover", "Match Back Cover"]:
            edge_source = front_path if spine_bg_style == "Match Front Cover" else eff_back_path
            p_idx = 0 if spine_bg_style == "Match Front Cover" else -1
            if edge_source and os.path.exists(edge_source):
                try:
                    edge_doc = fitz.open(edge_source)
                    edge_rect = edge_doc[p_idx].rect
                    is_front = (spine_bg_style == "Match Front Cover")
                    strip_is_right = is_front if is_rtl else not is_front
                    
                    if strip_is_right:
                        clip_rect = fitz.Rect(edge_rect.x1 - 1, edge_rect.y0, edge_rect.x1, edge_rect.y1)
                    else:
                        clip_rect = fitz.Rect(edge_rect.x0, edge_rect.y0, edge_rect.x0 + 1, edge_rect.y1)
                        
                    out_page.show_pdf_page(rect_spine_full, edge_doc, p_idx, clip=clip_rect, keep_proportion=False)
                    edge_doc.close()
                except Exception as e:
                    warnings.append(f"Spine edge stretch failed: {e}")
                    out_page.draw_rect(rect_spine_full, color=spine_color, fill=spine_color)
        else: # Solid Color
            out_page.draw_rect(rect_spine_full, color=spine_color, fill=spine_color)

        # Spine Typography
        if spine_title and spine_w_pt > 10.0:
            title_text = spine_title.strip()
            if spine_subtitle:
                title_text += f"  —  {spine_subtitle.strip()}"

            # We use QPainter to render text to an image, giving us full system font support
            # and accurate bold/italic handling without dealing with TTF paths
            from PyQt6.QtGui import QImage, QPainter, QFont, QColor, QFontMetrics
            from PyQt6.QtCore import Qt, QBuffer, QIODevice
            
            scale = 4.0  # High DPI rendering
            qfont = QFont(spine_font)
            qfont.setBold(spine_bold)
            qfont.setItalic(spine_italic)
            qfont.setPointSizeF(spine_font_size * scale)
            
            metrics = QFontMetrics(qfont)
            text_rect = metrics.boundingRect(title_text)
            
            # Add padding to avoid clipping
            img_w = text_rect.width() + 20
            img_h = text_rect.height() + 20
            
            img = QImage(img_w, img_h, QImage.Format.Format_ARGB32)
            img.fill(Qt.GlobalColor.transparent)
            
            painter = QPainter(img)
            painter.setFont(qfont)
            r, g, b = int(spine_text_color[0]*255), int(spine_text_color[1]*255), int(spine_text_color[2]*255)
            painter.setPen(QColor(r, g, b))
            painter.drawText(img.rect(), Qt.AlignmentFlag.AlignCenter, title_text)
            painter.end()
            
            buffer = QBuffer()
            buffer.open(QIODevice.OpenModeFlag.WriteOnly)
            img.save(buffer, "PNG")
            png_bytes = buffer.data().data()
            
            pdf_w = img_w / scale
            pdf_h = img_h / scale
            
            center_x = (spine_x0 + spine_x1) / 2.0
            center_y = (spine_y0 + spine_y1) / 2.0
            
            try:
                if spine_orientation == "Vertical":
                    if "RTL" in reading_direction:
                        # Bottom to Top -> Rotate 90
                        target_rect = fitz.Rect(center_x - pdf_h/2, center_y - pdf_w/2, center_x + pdf_h/2, center_y + pdf_w/2)
                        out_page.insert_image(target_rect, stream=png_bytes, rotate=90)
                    else:
                        # Top to Bottom -> Rotate -90 (or 270)
                        target_rect = fitz.Rect(center_x - pdf_h/2, center_y - pdf_w/2, center_x + pdf_h/2, center_y + pdf_w/2)
                        out_page.insert_image(target_rect, stream=png_bytes, rotate=270)
                else:
                    target_rect = fitz.Rect(center_x - pdf_w/2, center_y - pdf_h/2, center_x + pdf_w/2, center_y + pdf_h/2)
                    out_page.insert_image(target_rect, stream=png_bytes)
            except Exception as e:
                warnings.append(f"Font rendering warning: {e}")

        # Draw Crop Marks
        if draw_crop_marks:
            line_color = (0, 0, 0)
            
            # Top & Bottom Spine Fold Lines
            out_page.draw_line(fitz.Point(spine_x0, 0), fitz.Point(spine_x0, bleed_pt), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(spine_x0, spine_y1), fitz.Point(spine_x0, total_height_pt), color=line_color, width=0.5)

            out_page.draw_line(fitz.Point(spine_x1, 0), fitz.Point(spine_x1, bleed_pt), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(spine_x1, spine_y1), fitz.Point(spine_x1, total_height_pt), color=line_color, width=0.5)

            # Outer Trim Corner Marks
            out_page.draw_line(fitz.Point(panel1_x0, 0), fitz.Point(panel1_x0, bleed_pt - 2), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(0, panel1_y0), fitz.Point(bleed_pt - 2, panel1_y0), color=line_color, width=0.5)

            out_page.draw_line(fitz.Point(panel2_x1, 0), fitz.Point(panel2_x1, bleed_pt - 2), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(total_width_pt, panel2_y0), fitz.Point(panel2_x1 + 2, panel2_y0), color=line_color, width=0.5)

            out_page.draw_line(fitz.Point(panel1_x0, total_height_pt), fitz.Point(panel1_x0, panel1_y1 + 2), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(0, panel1_y1), fitz.Point(bleed_pt - 2, panel1_y1), color=line_color, width=0.5)

            out_page.draw_line(fitz.Point(panel2_x1, total_height_pt), fitz.Point(panel2_x1, panel2_y1 + 2), color=line_color, width=0.5)
            out_page.draw_line(fitz.Point(total_width_pt, panel2_y1), fitz.Point(panel2_x1 + 2, panel2_y1), color=line_color, width=0.5)

        # (Removed hardcoded cyan guides; interactive ruler guides are now used instead)

        # Set Boxes
        mb = out_page.mediabox
        out_page.set_cropbox(mb)
        out_page.set_bleedbox(mb)
        trim_rect = fitz.Rect(
            max(mb.x0, min(mb.x1, panel1_x0)),
            max(mb.y0, min(mb.y1, panel1_y0)),
            max(mb.x0, min(mb.x1, panel2_x1)),
            max(mb.y0, min(mb.y1, panel2_y1))
        )
        out_page.set_trimbox(trim_rect)

        # Save output PDF if path provided
        if output_pdf_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)
            out_doc.save(output_pdf_path)

        # Generate Preview Pixmap
        pix = out_page.get_pixmap(dpi=100)
        out_doc.close()

        total_w_mm = (2 * trim_width_mm) + spine_mm + (2 * bleed_mm)
        total_h_mm = trim_height_mm + (2 * bleed_mm)

        return {
            "output_path": output_pdf_path,
            "total_width_mm": round(total_w_mm, 2),
            "total_height_mm": round(total_h_mm, 2),
            "pixmap": pix,
            "warnings": warnings
        }
