import os
import base64
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
    def _crop_clip_rect(
        src_w: float, src_h: float,
        target_w: float, target_h: float,
        rotate: int,
    ) -> "fitz.Rect":
        """
        Compute the clip rectangle in source-page coordinates for fill/crop mode.

        PyMuPDF's show_pdf_page ``rotate`` parameter rotates content CCW, so:
        - rotate 90  (CCW 90°)  → source width maps to target height, source height → target width
        - rotate 270 (CCW 270°) → same axis-swap as 90°, just mirrored
        - rotate 0 / 180        → source and target share the same orientation

        The returned Rect, when passed as ``clip`` to show_pdf_page with
        ``keep_proportion=False``, fills the target_w×target_h rectangle exactly
        while centering the crop on the source.
        """
        import fitz as _fitz
        if rotate in (90, 270):
            # After rotation, source height fills target width and vice-versa
            scale = max(target_w / src_h, target_h / src_w)
            clip_w_src = target_h / scale   # extent in source X
            clip_h_src = target_w / scale   # extent in source Y
        else:
            scale = max(target_w / src_w, target_h / src_h)
            clip_w_src = target_w / scale
            clip_h_src = target_h / scale
        x0 = (src_w - clip_w_src) / 2.0
        y0 = (src_h - clip_h_src) / 2.0
        return _fitz.Rect(x0, y0, x0 + clip_w_src, y0 + clip_h_src)

    @staticmethod
    def _compute_user_page_rotation(
        page_rotation_setting: str,
        src_w: float,
        src_h: float,
        target_w: float,
        target_h: float
    ) -> int:
        """
        Calculates user-requested content rotation in PyMuPDF CCW degrees (0, 90, 180, 270).
        Crucially: Only rotates pages whose aspect orientation opposes the target slot orientation!
        - If setting is 'none', returns 0.
        - If the page is already aligned (e.g. both are portrait, or both are landscape), returns 0.
        - If the page opposes the target slot (e.g. landscape page inside a portrait slot, or vice versa):
          'cw'  -> 270 CCW (90° Clockwise)
          'ccw' -> 90 CCW (90° Counter-Clockwise)
        """
        if not page_rotation_setting or page_rotation_setting == "none":
            return 0

        src_is_landscape = src_w > src_h
        target_is_landscape = target_w > target_h

        # Only rotate if the page aspect orientation goes against the target orientation!
        if src_is_landscape == target_is_landscape:
            return 0

        # Opposing orientation: apply the requested rotation
        if page_rotation_setting == "cw":
            return 270  # PyMuPDF CCW 270 = CW 90
        elif page_rotation_setting == "ccw":
            return 90   # PyMuPDF CCW 90 = CCW 90
        return 0

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

            # Helper for colors
            def hex_to_rgb(h):
                h = h.lstrip('#')
                return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4)) if len(h)==6 else (0,0,0)

            # Insert placed artwork items & draw crop marks
            for item in sheet.placed_items:
                ix_pt = item.x_mm * SheetGangExporter.MM_TO_PTS
                iy_pt = item.y_mm * SheetGangExporter.MM_TO_PTS
                iw_pt = item.w_mm * SheetGangExporter.MM_TO_PTS
                ih_pt = item.h_mm * SheetGangExporter.MM_TO_PTS

                target_rect = fitz.Rect(ix_pt, iy_pt, ix_pt + iw_pt, iy_pt + ih_pt)

                # Resolve fit mode (new field, falls back to legacy keep_aspect flag)
                fit_mode = getattr(item, "fit_mode", "fit" if item.keep_aspect else "stretch")

                # Resolve bleed settings
                bleed_mode = getattr(item, "bleed_mode", "none")
                bleed_mm = getattr(item, "bleed_mm", 0.0) or 0.0
                bleed_color = getattr(item, "bleed_color", "#FFFFFF") or "#FFFFFF"
                bleed_type = getattr(item, "bleed_type", "inside")
                bleed_pt = (bleed_mm * SheetGangExporter.MM_TO_PTS) if bleed_mode in ("solid", "mirror") and bleed_mm > 0 else 0.0

                # If bleed is active, content_rect is inset from target_rect
                if bleed_pt > 0 and (iw_pt - 2 * bleed_pt > 0) and (ih_pt - 2 * bleed_pt > 0):
                    content_rect = fitz.Rect(ix_pt + bleed_pt, iy_pt + bleed_pt, ix_pt + iw_pt - bleed_pt, iy_pt + ih_pt - bleed_pt)
                else:
                    content_rect = target_rect
                    bleed_pt = 0.0

                # Packer auto-rotation (90° CCW if rotated by bin packer)
                packer_rot = 90 if item.rotated else 0

                # Draw artwork if PDF path is valid
                if item.pdf_path and os.path.exists(item.pdf_path):
                    try:
                        ext = item.pdf_path.lower().split(".")[-1]

                        # Inspect source page dimensions to check if page orientation opposes target trim size
                        # Unrotated target trim dimensions (configured by the user)
                        unrot_w_pt = (getattr(item, "target_w_mm", 0.0) * SheetGangExporter.MM_TO_PTS) if getattr(item, "target_w_mm", 0.0) > 0 else (ih_pt if item.rotated else iw_pt)
                        unrot_h_pt = (getattr(item, "target_h_mm", 0.0) * SheetGangExporter.MM_TO_PTS) if getattr(item, "target_h_mm", 0.0) > 0 else (iw_pt if item.rotated else ih_pt)

                        src_pw_pt, src_ph_pt = unrot_w_pt, unrot_h_pt
                        if ext in ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"]:
                            try:
                                import cv2
                                tmp_im = cv2.imread(item.pdf_path)
                                if tmp_im is not None:
                                    src_ph_pt, src_pw_pt = tmp_im.shape[:2]
                            except Exception:
                                pass
                        else:
                            try:
                                chk_doc = fitz.open(item.pdf_path)
                                p_chk = min(max(0, getattr(item, "page_num", 0)), len(chk_doc) - 1)
                                src_pw_pt, src_ph_pt = chk_doc[p_chk].rect.width, chk_doc[p_chk].rect.height
                                chk_doc.close()
                            except Exception:
                                pass

                        # User rotation is ONLY applied if the page orientation opposes the user's target trim!
                        user_rot = SheetGangExporter._compute_user_page_rotation(
                            getattr(item, "page_rotation", "none"),
                            src_pw_pt, src_ph_pt,
                            unrot_w_pt, unrot_h_pt
                        )
                        total_rot = (packer_rot + user_rot) % 360

                        # 1. Solid bleed background: fills the outer target_rect with bleed_color
                        if bleed_mode == "solid" and bleed_pt > 0:
                            shape.draw_rect(target_rect)
                            shape.finish(color=None, fill=hex_to_rgb(bleed_color))
                            shape.commit()
                            shape = page.new_shape()

                        # 2. Mirror bleed: synthesize 2-3mm edge reflection around content
                        if bleed_mode == "mirror" and bleed_pt > 0:
                            try:
                                import cv2
                                import numpy as np
                                # Render source page/image to BGR
                                if ext in ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"]:
                                    raw_bgr = cv2.imread(item.pdf_path)
                                else:
                                    src_tmp_doc = fitz.open(item.pdf_path)
                                    p_tmp_idx = min(max(0, getattr(item, "page_num", 0)), len(src_tmp_doc) - 1)
                                    # Render at 200 DPI for high quality edge reflection
                                    pix_mirror = src_tmp_doc[p_tmp_idx].get_pixmap(dpi=200)
                                    raw_bgr = np.frombuffer(pix_mirror.samples, dtype=np.uint8).reshape((pix_mirror.height, pix_mirror.width, pix_mirror.n))
                                    if pix_mirror.n == 4:
                                        raw_bgr = cv2.cvtColor(raw_bgr, cv2.COLOR_RGBA2BGR)
                                    elif pix_mirror.n == 1:
                                        raw_bgr = cv2.cvtColor(raw_bgr, cv2.COLOR_GRAY2BGR)
                                    src_tmp_doc.close()

                                if raw_bgr is not None:
                                    # Target content dimensions in pixels at 200 DPI
                                    cw_px = max(1, int(round((content_rect.width / 72.0) * 200)))
                                    ch_px = max(1, int(round((content_rect.height / 72.0) * 200)))
                                    b_px_x = max(1, int(round((bleed_pt / 72.0) * 200)))
                                    b_px_y = max(1, int(round((bleed_pt / 72.0) * 200)))

                                    # Resize raw to inner content size according to fit_mode
                                    if fit_mode == "stretch":
                                        inner_resized = cv2.resize(raw_bgr, (cw_px, ch_px), interpolation=cv2.INTER_LANCZOS4)
                                    else:
                                        # Proportionate fit
                                        rh, rw = raw_bgr.shape[:2]
                                        scale_val = min(cw_px / rw, ch_px / rh) if fit_mode == "fit" else max(cw_px / rw, ch_px / rh)
                                        scaled_w = max(1, int(rw * scale_val))
                                        scaled_h = max(1, int(rh * scale_val))
                                        scaled = cv2.resize(raw_bgr, (scaled_w, scaled_h), interpolation=cv2.INTER_LANCZOS4)
                                        if fit_mode == "fit":
                                            # Letterbox pad
                                            inner_resized = np.full((ch_px, cw_px, 3), [int(c * 255) for c in hex_to_rgb(item.fill_color)[::-1]], dtype=np.uint8)
                                            ox = (cw_px - scaled_w) // 2
                                            oy = (ch_px - scaled_h) // 2
                                            inner_resized[oy:oy+scaled_h, ox:ox+scaled_w] = scaled
                                        else:
                                            # Crop center
                                            ox = (scaled_w - cw_px) // 2
                                            oy = (scaled_h - ch_px) // 2
                                            inner_resized = scaled[oy:oy+ch_px, ox:ox+cw_px]

                                    # Mirror outer border via BORDER_REFLECT_101
                                    mirrored_full = cv2.copyMakeBorder(
                                        inner_resized, b_px_y, b_px_y, b_px_x, b_px_x, cv2.BORDER_REFLECT_101
                                    )
                                    success_m, enc_m = cv2.imencode(".jpg", mirrored_full, [int(cv2.IMWRITE_JPEG_QUALITY), 96])
                                    if success_m:
                                        page.insert_image(target_rect, stream=enc_m.tobytes(), rotate=total_rot)
                            except Exception as m_err:
                                print(f"Mirror bleed error on {item.name}: {m_err}")

                        # 3. If mirror bleed already placed the complete mirrored visual into target_rect, skip vector overlay.
                        # Otherwise (no bleed or solid bleed), render content into content_rect
                        if bleed_mode != "mirror" or bleed_pt == 0.0:
                            if ext in ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"]:
                                # Raster image — insert_image handles keep_proportion
                                img_stream = None
                                if ext in ["avif", "webp"]:
                                    import cv2
                                    img = cv2.imread(item.pdf_path)
                                    if img is not None:
                                        _, encoded = cv2.imencode(".png", img)
                                        img_stream = encoded.tobytes()
                                if fit_mode == "fit":
                                    shape.draw_rect(content_rect)
                                    shape.finish(color=None, fill=hex_to_rgb(item.fill_color))
                                    shape.commit()
                                    shape = page.new_shape()
                                if img_stream:
                                    page.insert_image(content_rect, stream=img_stream,
                                                      rotate=total_rot,
                                                      keep_proportion=(fit_mode == "fit"))
                                else:
                                    page.insert_image(content_rect, filename=item.pdf_path,
                                                      rotate=total_rot,
                                                      keep_proportion=(fit_mode == "fit"))
                            else:
                                # Vector PDF — show_pdf_page with fit-mode-specific clip/proportion
                                src_doc = fitz.open(item.pdf_path)
                                p_idx = min(max(0, getattr(item, "page_num", 0)), len(src_doc) - 1)
                                src_page = src_doc[p_idx]

                                if fit_mode == "fit":
                                    # Letterbox: fill background then place proportionally
                                    shape.draw_rect(content_rect)
                                    shape.finish(color=None, fill=hex_to_rgb(item.fill_color))
                                    shape.commit()
                                    shape = page.new_shape()
                                    page.show_pdf_page(content_rect, src_doc, p_idx,
                                                       rotate=total_rot, keep_proportion=True)
                                elif fit_mode == "crop":
                                    # Fill+crop: compute centered clip in source coordinates
                                    clip = SheetGangExporter._crop_clip_rect(
                                        src_page.rect.width, src_page.rect.height,
                                        content_rect.width, content_rect.height, total_rot
                                    )
                                    page.show_pdf_page(content_rect, src_doc, p_idx,
                                                       rotate=total_rot, clip=clip,
                                                       keep_proportion=False)
                                else:
                                    # Stretch: force-fill, no aspect correction
                                    page.show_pdf_page(content_rect, src_doc, p_idx,
                                                       rotate=total_rot, keep_proportion=False)
                                src_doc.close()
                    except Exception as e:
                        print(f"Error rendering artwork item {item.name}: {e}")
                else:
                    # Draw placeholder fill for missing files
                    shape.draw_rect(target_rect)
                    shape.finish(color=(0.3, 0.5, 0.8), fill=(0.9, 0.95, 1.0), stroke_opacity=1.0)


                # For outside bleed, the true finished cut line is content_rect (trim box).
                # For inside bleed or no bleed, the cut line is target_rect.
                trim_rect = content_rect if (bleed_type == "outside" and bleed_pt > 0) else target_rect
                tx0, ty0, tx1, ty1 = trim_rect.x0, trim_rect.y0, trim_rect.x1, trim_rect.y1

                if draw_border:
                    def hex_to_rgb(h):
                        h = h.lstrip('#')
                        return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4)) if len(h)==6 else (0,0,0)
                    shape.draw_rect(trim_rect)
                    shape.finish(color=hex_to_rgb(border_color), width=1.0, stroke_opacity=1.0)
                    
                # Draw CutContour stroke if enabled
                if draw_cut_contour:
                    shape.draw_rect(trim_rect)
                    # Spot magenta stroke for CutContour
                    shape.finish(color=(1.0, 0.0, 1.0), width=0.5, stroke_opacity=1.0)

                # Draw Crop Marks (Standard Offset at Trim Box)
                if show_crop_marks:
                    off = 1.5 * SheetGangExporter.MM_TO_PTS
                    mlen = 3.0 * SheetGangExporter.MM_TO_PTS
                    
                    # Top-left corner
                    shape.draw_line(fitz.Point(tx0 - off, ty0), fitz.Point(tx0 - off - mlen, ty0))
                    shape.draw_line(fitz.Point(tx0, ty0 - off), fitz.Point(tx0, ty0 - off - mlen))
                    # Top-right corner
                    shape.draw_line(fitz.Point(tx1 + off, ty0), fitz.Point(tx1 + off + mlen, ty0))
                    shape.draw_line(fitz.Point(tx1, ty0 - off), fitz.Point(tx1, ty0 - off - mlen))
                    # Bottom-left corner
                    shape.draw_line(fitz.Point(tx0 - off, ty1), fitz.Point(tx0 - off - mlen, ty1))
                    shape.draw_line(fitz.Point(tx0, ty1 + off), fitz.Point(tx0, ty1 + off + mlen))
                    # Bottom-right corner
                    shape.draw_line(fitz.Point(tx1 + off, ty1), fitz.Point(tx1 + off + mlen, ty1))
                    shape.draw_line(fitz.Point(tx1, ty1 + off), fitz.Point(tx1, ty1 + off + mlen))
                    
                    shape.finish(color=(0, 0, 0), width=0.2, stroke_opacity=1.0)

            shape.commit()

        doc.save(output_pdf_path)
        doc.close()
        return True

    @staticmethod
    def _get_data_uri(file_path: str, page_num: int = 0) -> str:
        """Helper to convert PDF or image file to a base64 data URI for SVG embedding."""
        if not file_path or not os.path.exists(file_path):
            return ""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            try:
                doc = fitz.open(file_path)
                if len(doc) > 0:
                    p = min(max(0, page_num), len(doc) - 1)
                    pix = doc[p].get_pixmap(dpi=150)
                    img_bytes = pix.tobytes("png")
                    doc.close()
                    return f"data:image/png;base64,{base64.b64encode(img_bytes).decode('utf-8')}"
                doc.close()
            except Exception as e:
                print(f"Error converting PDF {file_path} to image for SVG: {e}")
            return ""
        elif ext in [".avif", ".webp"]:
            try:
                import cv2
                img = cv2.imread(file_path)
                if img is not None:
                    success, encoded = cv2.imencode(".png", img)
                    if success:
                        return f"data:image/png;base64,{base64.b64encode(encoded.tobytes()).decode('utf-8')}"
            except Exception as e:
                print(f"Error converting {ext} {file_path} to image for SVG: {e}")
            return ""
        else:
            try:
                mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png")
                with open(file_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                return f"data:{mime};base64,{b64}"
            except Exception as e:
                print(f"Error reading image {file_path} for SVG: {e}")
                return ""

    @staticmethod
    def export_svg(
        sheet: SingleSheetResult,
        output_svg_path: str,
        show_crop_marks: bool = True,
        show_reg_marks: bool = False,
        draw_border: bool = True,
        border_color: str = "#FF00FF"
    ) -> bool:
        """
        Exports a press-ready SVG with separated layers for Print/Artwork and CutContour/Cutlines.
        Layer 1 ('Artwork'): Embedded raster/vector artwork and background fills.
        Layer 2 ('CutContour'): Vector die-lines, bounding boxes, and prepress crop marks.
        Fully compatible with Inkscape, Illustrator, and digital flatbed cutting plotters (Zünd, Kongsberg, Roland).
        """
        if not sheet:
            return False

        sw_mm = sheet.sheet_w_mm
        sh_mm = sheet.sheet_h_mm
        sw_pt = sw_mm * SheetGangExporter.MM_TO_PTS
        sh_pt = sh_mm * SheetGangExporter.MM_TO_PTS

        artwork_elements: List[str] = []
        cut_elements: List[str] = []

        cut_stroke = border_color if (draw_border and border_color) else "#FF00FF"
        stroke_width = 0.5  # 0.5 pt

        # 1. Registration corner marks
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
                cut_elements.append(
                    f'    <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{reg_size_pt / 2.0:.2f}" fill="#000000" stroke="none" />'
                )

        # 2. Iterate placed artwork items
        for idx, item in enumerate(sheet.placed_items):
            ix_pt = item.x_mm * SheetGangExporter.MM_TO_PTS
            iy_pt = item.y_mm * SheetGangExporter.MM_TO_PTS
            iw_pt = item.w_mm * SheetGangExporter.MM_TO_PTS
            ih_pt = item.h_mm * SheetGangExporter.MM_TO_PTS

            # --- ARTWORK LAYER ---
            # Resolve fit mode (falls back to legacy keep_aspect)
            fit_mode = getattr(item, "fit_mode", "fit" if getattr(item, "keep_aspect", False) else "stretch")
            fill_col = getattr(item, "fill_color", "#FFFFFF") or "#FFFFFF"

            # Inside bleed handling
            bleed_mode = getattr(item, "bleed_mode", "none")
            bleed_mm = getattr(item, "bleed_mm", 0.0) or 0.0
            bleed_color = getattr(item, "bleed_color", "#FFFFFF") or "#FFFFFF"
            bleed_pt = (bleed_mm * SheetGangExporter.MM_TO_PTS) if bleed_mode in ("solid", "mirror") and bleed_mm > 0 else 0.0

            if bleed_pt > 0 and (iw_pt - 2 * bleed_pt > 0) and (ih_pt - 2 * bleed_pt > 0):
                c_ix_pt = ix_pt + bleed_pt
                c_iy_pt = iy_pt + bleed_pt
                c_iw_pt = iw_pt - 2 * bleed_pt
                c_ih_pt = ih_pt - 2 * bleed_pt
            else:
                c_ix_pt, c_iy_pt, c_iw_pt, c_ih_pt = ix_pt, iy_pt, iw_pt, ih_pt
                bleed_pt = 0.0

            # SVG preserveAspectRatio mapping
            if fit_mode == "fit":
                par = "xMidYMid meet"
            elif fit_mode == "crop":
                par = "xMidYMid slice"
            else:
                par = "none"

            # Packer rotation (90° CW if rotated by bin packer)
            packer_rot_svg = 90 if getattr(item, "rotated", False) else 0

            # Determine source dimensions for orientation check
            # Unrotated target trim dimensions (configured by the user)
            unrot_w_pt = (getattr(item, "target_w_mm", 0.0) * SheetGangExporter.MM_TO_PTS) if getattr(item, "target_w_mm", 0.0) > 0 else (ih_pt if getattr(item, "rotated", False) else iw_pt)
            unrot_h_pt = (getattr(item, "target_h_mm", 0.0) * SheetGangExporter.MM_TO_PTS) if getattr(item, "target_h_mm", 0.0) > 0 else (iw_pt if getattr(item, "rotated", False) else ih_pt)

            src_pw_pt, src_ph_pt = unrot_w_pt, unrot_h_pt
            pdf_path_val = getattr(item, "pdf_path", "")
            if pdf_path_val and os.path.exists(pdf_path_val):
                ext = pdf_path_val.lower().split(".")[-1]
                if ext in ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"]:
                    try:
                        import cv2
                        tmp_im = cv2.imread(pdf_path_val)
                        if tmp_im is not None:
                            src_ph_pt, src_pw_pt = tmp_im.shape[:2]
                    except Exception:
                        pass
                else:
                    try:
                        chk_doc = fitz.open(pdf_path_val)
                        p_chk = min(max(0, getattr(item, "page_num", 0)), len(chk_doc) - 1)
                        src_pw_pt, src_ph_pt = chk_doc[p_chk].rect.width, chk_doc[p_chk].rect.height
                        chk_doc.close()
                    except Exception:
                        pass

            # Only rotate if aspect orientation opposes the user's target trim!
            # Note: _compute_user_page_rotation returns PyMuPDF CCW degrees (270 for CW, 90 for CCW).
            # For SVG, CW degrees = (360 - CCW) % 360.
            user_ccw = SheetGangExporter._compute_user_page_rotation(
                getattr(item, "page_rotation", "none"),
                src_pw_pt, src_ph_pt,
                unrot_w_pt, unrot_h_pt
            )
            user_rot_svg = (360 - user_ccw) % 360 if user_ccw != 0 else 0
            total_rot_svg = (packer_rot_svg + user_rot_svg) % 360


            data_uri = SheetGangExporter._get_data_uri(
                getattr(item, "pdf_path", ""), page_num=getattr(item, "page_num", 0)
            )

            if data_uri:
                # Solid bleed background fills the entire target_rect
                if bleed_mode == "solid" and bleed_pt > 0:
                    artwork_elements.append(
                        f'    <rect x="{ix_pt:.2f}" y="{iy_pt:.2f}" width="{iw_pt:.2f}" height="{ih_pt:.2f}" fill="{bleed_color}" stroke="none" />'
                    )

                # Background fill rect for "fit" mode within the content area
                if fit_mode == "fit":
                    artwork_elements.append(
                        f'    <rect x="{c_ix_pt:.2f}" y="{c_iy_pt:.2f}" width="{c_iw_pt:.2f}" height="{c_ih_pt:.2f}" fill="{fill_col}" stroke="none" />'
                    )

                # For crop mode, wrap in a clipPath so the image cannot overflow the content area
                clip_attr = ""
                if fit_mode == "crop":
                    clip_id = f"clip_item_{idx}"
                    artwork_elements.append(
                        f'    <defs><clipPath id="{clip_id}">'
                        f'<rect x="{c_ix_pt:.2f}" y="{c_iy_pt:.2f}" width="{c_iw_pt:.2f}" height="{c_ih_pt:.2f}"/>'
                        f'</clipPath></defs>'
                    )
                    clip_attr = f' clip-path="url(#{clip_id})"'

                if total_rot_svg != 0:
                    # Rotate around the centre of the content box
                    cx = c_ix_pt + c_iw_pt / 2
                    cy = c_iy_pt + c_ih_pt / 2
                    artwork_elements.append(
                        f'    <g transform="rotate({total_rot_svg},{cx:.2f},{cy:.2f})"{clip_attr}>\n'
                        f'      <image x="{c_ix_pt:.2f}" y="{c_iy_pt:.2f}" width="{c_iw_pt:.2f}" height="{c_ih_pt:.2f}" '
                        f'href="{data_uri}" xlink:href="{data_uri}" preserveAspectRatio="{par}" />\n'
                        f'    </g>'
                    )
                else:
                    artwork_elements.append(
                        f'    <image x="{c_ix_pt:.2f}" y="{c_iy_pt:.2f}" width="{c_iw_pt:.2f}" height="{c_ih_pt:.2f}" '
                        f'href="{data_uri}" xlink:href="{data_uri}" preserveAspectRatio="{par}"{clip_attr} />'
                    )
            else:
                artwork_elements.append(
                    f'    <rect x="{ix_pt:.2f}" y="{iy_pt:.2f}" width="{iw_pt:.2f}" height="{ih_pt:.2f}" fill="#F1F5F9" stroke="#94A3B8" stroke-width="0.5" />'
                )


            # --- CUTCONTOUR / CUTLINES LAYER ---
            # For outside bleed, cut line and crop marks align to the finished trim box
            bleed_type_svg = getattr(item, "bleed_type", "inside")
            trim_ix = c_ix_pt if (bleed_type_svg == "outside" and bleed_pt > 0) else ix_pt
            trim_iy = c_iy_pt if (bleed_type_svg == "outside" and bleed_pt > 0) else iy_pt
            trim_iw = c_iw_pt if (bleed_type_svg == "outside" and bleed_pt > 0) else iw_pt
            trim_ih = c_ih_pt if (bleed_type_svg == "outside" and bleed_pt > 0) else ih_pt

            cut_elements.append(
                f'    <rect id="Cut_{idx + 1}" x="{trim_ix:.2f}" y="{trim_iy:.2f}" width="{trim_iw:.2f}" height="{trim_ih:.2f}" '
                f'fill="none" stroke="{cut_stroke}" stroke-width="{stroke_width}" stroke-linecap="round" stroke-linejoin="round" />'
            )

            # Crop Marks
            if show_crop_marks:
                off = 1.5 * SheetGangExporter.MM_TO_PTS
                mlen = 3.0 * SheetGangExporter.MM_TO_PTS
                marks = [
                    # Top-left corner
                    (trim_ix - off, trim_iy, trim_ix - off - mlen, trim_iy),
                    (trim_ix, trim_iy - off, trim_ix, trim_iy - off - mlen),
                    # Top-right corner
                    (trim_ix + trim_iw + off, trim_iy, trim_ix + trim_iw + off + mlen, trim_iy),
                    (trim_ix + trim_iw, trim_iy - off, trim_ix + trim_iw, trim_iy - off - mlen),
                    # Bottom-left corner
                    (trim_ix - off, trim_iy + trim_ih, trim_ix - off - mlen, trim_iy + trim_ih),
                    (trim_ix, trim_iy + trim_ih + off, trim_ix, trim_iy + trim_ih + off + mlen),
                    # Bottom-right corner
                    (trim_ix + trim_iw + off, trim_iy + trim_ih, trim_ix + trim_iw + off + mlen, trim_iy + trim_ih),
                    (trim_ix + trim_iw, trim_iy + trim_ih + off, trim_ix + trim_iw, trim_iy + trim_ih + off + mlen),
                ]
                for x1, y1, x2, y2 in marks:
                    cut_elements.append(
                        f'    <line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="#000000" stroke-width="0.35" stroke-linecap="square" />'
                    )

        artwork_str = "\n".join(artwork_elements)
        cut_str = "\n".join(cut_elements)

        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{sw_mm:.2f}mm" height="{sh_mm:.2f}mm" viewBox="0 0 {sw_pt:.2f} {sh_pt:.2f}"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">
  <defs/>
  <!-- Layer 1: Artwork / Print -->
  <g id="Artwork" inkscape:groupmode="layer" inkscape:label="Artwork">
{artwork_str}
  </g>
  <!-- Layer 2: CutContour / Die-lines -->
  <g id="CutContour" inkscape:groupmode="layer" inkscape:label="CutContour">
{cut_str}
  </g>
</svg>'''

        with open(output_svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)

        return True

