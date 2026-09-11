"""
Auto-Bleed & Edge Extension Engine for BlueWhale Printing Assistant.
Handles PDF & image edge analysis, mirrored reflection, border replication,
OpenCV content-aware inpainting, and PDF BleedBox/TrimBox geometry tagging.
Supports selective page ranges, cumulative working sessions, asymmetric per-side bleed,
duplex LTR/RTL book layout geometries, and advanced mode-specific fill refinements.
"""

import os
import re
import cv2
import numpy as np
import fitz  # PyMuPDF


def parse_page_range_string(range_str: str, total_pages: int) -> list[int]:
    """
    Parses a page range string (e.g., 'all', '1-3, 5, 8-12', '4') into a sorted
    0-indexed list of unique page indices.
    """
    if not range_str or range_str.strip().lower() == "all":
        return list(range(total_pages))

    selected = set()
    parts = range_str.split(",")

    for part in parts:
        part = part.strip()
        if not part:
            continue

        match_range = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
        match_single = re.match(r"^(\d+)$", part)

        if match_range:
            start_p = int(match_range.group(1))
            end_p = int(match_range.group(2))
            if start_p > end_p:
                start_p, end_p = end_p, start_p
            for p in range(start_p, end_p + 1):
                if 1 <= p <= total_pages:
                    selected.add(p - 1)
        elif match_single:
            p = int(match_single.group(1))
            if 1 <= p <= total_pages:
                selected.add(p - 1)

    return sorted(list(selected))


def resolve_page_bleed_asymmetric(
    page_num: int,
    layout_mode: str,
    top_enabled: bool, top_mm: float,
    bottom_enabled: bool, bottom_mm: float,
    side1_enabled: bool, side1_mm: float,
    side2_enabled: bool, side2_mm: float
) -> tuple[float, float, float, float]:
    """
    Computes (top_mm, bottom_mm, left_mm, right_mm) for a specific 1-indexed page.
    In duplex modes:
      side1 = Outside (Fore-Edge), side2 = Inside (Spine / Gutter).
    """
    t = top_mm if top_enabled else 0.0
    b = bottom_mm if bottom_enabled else 0.0

    if layout_mode == "single":
        l = side1_mm if side1_enabled else 0.0
        r = side2_mm if side2_enabled else 0.0
        return (t, b, l, r)

    outside_val = side1_mm if side1_enabled else 0.0
    inside_val = side2_mm if side2_enabled else 0.0
    is_odd = (page_num % 2 != 0)

    if layout_mode == "duplex_ltr":
        if is_odd:
            return (t, b, inside_val, outside_val)
        else:
            return (t, b, outside_val, inside_val)

    elif layout_mode == "duplex_rtl":
        if is_odd:
            return (t, b, outside_val, inside_val)
        else:
            return (t, b, inside_val, outside_val)

    return (t, b, outside_val, inside_val)


def detect_pdf_bleed(pdf_path_or_doc) -> list[dict]:
    """
    Analyzes all pages in a PDF file (path or fitz.Document) and returns a list of page geometry dicts.
    """
    if isinstance(pdf_path_or_doc, str):
        if not os.path.exists(pdf_path_or_doc):
            raise FileNotFoundError(f"PDF file not found: {pdf_path_or_doc}")
        doc = fitz.open(pdf_path_or_doc)
        should_close = True
    else:
        doc = pdf_path_or_doc
        should_close = False

    page_info = []
    pt_to_mm = 25.4 / 72.0

    for idx, page in enumerate(doc):
        mb = page.rect
        tb = page.trimbox
        bb = page.bleedbox

        top_bleed = max(0.0, (tb.y0 - bb.y0) * pt_to_mm)
        left_bleed = max(0.0, (tb.x0 - bb.x0) * pt_to_mm)
        right_bleed = max(0.0, (bb.x1 - tb.x1) * pt_to_mm)
        bottom_bleed = max(0.0, (bb.y1 - tb.y1) * pt_to_mm)

        min_bleed_mm = min(top_bleed, left_bleed, right_bleed, bottom_bleed)

        page_info.append({
            "page_num": idx + 1,
            "width_mm": mb.width * pt_to_mm,
            "height_mm": mb.height * pt_to_mm,
            "bleed_mm": round(min_bleed_mm, 2),
            "has_bleed": min_bleed_mm >= 1.0,
            "mediabox": [mb.x0, mb.y0, mb.x1, mb.y1],
            "trimbox": [tb.x0, tb.y0, tb.x1, tb.y1],
            "bleedbox": [bb.x0, bb.y0, bb.x1, bb.y1],
        })

    if should_close:
        doc.close()

    return page_info


def extend_image_bleed_asymmetric(
    img_bgr: np.ndarray,
    top_px: int,
    bottom_px: int,
    left_px: int,
    right_px: int,
    mode: str = "mirrored",
    blur_bleed_margin: bool = True,
    corner_smooth: bool = True,
    inpaint_alg: str = "ns",
    smooth_replicate: bool = True,
    preserve_aspect: bool = True,
    solid_color: tuple = (255, 255, 255)
) -> np.ndarray:
    """
    Extends an OpenCV BGR/BGRA image independently on top, bottom, left, and right borders
    with advanced fill refinements:
      - Mirrored: Margin blur (suppresses reversed text ghosting) + corner seam smoothing
      - Inpaint: Navier-Stokes (ns) vs Telea (telea) fluid dynamics
      - Replicate: Smart edge pre-smoothing to prevent 1-pixel streak artifacts
      - Scale: Aspect-preserving uniform scale cover & crop
    """
    if top_px == 0 and bottom_px == 0 and left_px == 0 and right_px == 0:
        return img_bgr.copy()

    if len(img_bgr.shape) == 2:
        img_bgr = cv2.cvtColor(img_bgr, cv2.COLOR_GRAY2BGR)

    h, w = img_bgr.shape[:2]

    if mode == "mirrored":
        extended = cv2.copyMakeBorder(
            img_bgr, top_px, bottom_px, left_px, right_px, cv2.BORDER_REFLECT_101
        )

        # Refinement B: Smooth out 4 corner reflection seams
        if corner_smooth:
            corners = [
                (0, 0, left_px, top_px),  # Top-Left
                (left_px + w, 0, left_px + w + right_px, top_px),  # Top-Right
                (0, top_px + h, left_px, top_px + h + bottom_px),  # Bottom-Left
                (left_px + w, top_px + h, left_px + w + right_px, top_px + h + bottom_px),  # Bottom-Right
            ]
            for cx1, cy1, cx2, cy2 in corners:
                if cx2 > cx1 and cy2 > cy1:
                    corner_block = extended[cy1:cy2, cx1:cx2]
                    extended[cy1:cy2, cx1:cx2] = cv2.blur(corner_block, (5, 5))

    elif mode == "replicate":
        # Refinement: Pre-smooth 3-pixel edge strip to prevent 1-pixel streak artifacts
        work_img = img_bgr.copy()
        if smooth_replicate:
            work_img[0, :] = cv2.blur(work_img[0:3, :], (3, 3))[0, :]
            work_img[-1, :] = cv2.blur(work_img[-3:, :], (3, 3))[-1, :]
            work_img[:, 0] = cv2.blur(work_img[:, 0:3], (3, 3))[:, 0]
            work_img[:, -1] = cv2.blur(work_img[:, -3:], (3, 3))[:, -1]

        extended = cv2.copyMakeBorder(
            work_img, top_px, bottom_px, left_px, right_px, cv2.BORDER_REPLICATE
        )

    elif mode == "inpaint":
        expanded_h = h + top_px + bottom_px
        expanded_w = w + left_px + right_px

        init_canvas = cv2.copyMakeBorder(
            img_bgr, top_px, bottom_px, left_px, right_px, cv2.BORDER_REFLECT_101
        )
        mask = np.ones((expanded_h, expanded_w), dtype=np.uint8) * 255
        mask[top_px:top_px + h, left_px:left_px + w] = 0

        max_bleed = max(top_px, bottom_px, left_px, right_px)
        flag = cv2.INPAINT_NS if inpaint_alg == "ns" else cv2.INPAINT_TELEA
        extended = cv2.inpaint(init_canvas, mask, inpaintRadius=max(3, max_bleed // 2), flags=flag)

    elif mode == "scale":
        new_w = w + left_px + right_px
        new_h = h + top_px + bottom_px

        if preserve_aspect:
            # Aspect-preserving uniform scale & center crop
            scale = max(new_w / float(w), new_h / float(h))
            scaled_w = int(round(w * scale))
            scaled_h = int(round(h * scale))
            scaled = cv2.resize(img_bgr, (scaled_w, scaled_h), interpolation=cv2.INTER_CUBIC)

            # Center crop to (new_w, new_h)
            crop_x = (scaled_w - new_w) // 2
            crop_y = (scaled_h - new_h) // 2
            extended = scaled[crop_y:crop_y + new_h, crop_x:crop_x + new_w].copy()
        else:
            extended = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    elif mode == "solid":
        extended = cv2.copyMakeBorder(
            img_bgr, top_px, bottom_px, left_px, right_px, cv2.BORDER_CONSTANT, value=solid_color
        )

    else:
        extended = cv2.copyMakeBorder(
            img_bgr, top_px, bottom_px, left_px, right_px, cv2.BORDER_REFLECT_101
        )

    # Refinement: Apply Gaussian blur universally to the extended outer bleed zone if requested
    if blur_bleed_margin:
        bleed_mask = np.ones((h + top_px + bottom_px, w + left_px + right_px), dtype=bool)
        bleed_mask[top_px:top_px + h, left_px:left_px + w] = False

        # Apply a noticeable blur to the bleed margins
        blurred = cv2.GaussianBlur(extended, (15, 15), sigmaX=5.0)
        extended[bleed_mask] = blurred[bleed_mask]

    return extended


def extend_image_bleed(img_bgr: np.ndarray, bleed_px: int, mode: str = "mirrored") -> np.ndarray:
    """Wrapper for uniform 4-side bleed extension."""
    return extend_image_bleed_asymmetric(img_bgr, bleed_px, bleed_px, bleed_px, bleed_px, mode=mode)


def process_page_to_bleed_image(
    page: fitz.Page,
    bleed_mm: float = 3.0,
    dpi: int = 300,
    mode: str = "mirrored",
    top_mm: float = None,
    bottom_mm: float = None,
    left_mm: float = None,
    right_mm: float = None,
    blur_bleed_margin: bool = True,
    corner_smooth: bool = True,
    inpaint_alg: str = "ns",
    smooth_replicate: bool = True,
    preserve_aspect: bool = True,
    solid_color: tuple = (255, 255, 255)
) -> tuple[np.ndarray, float, float]:
    """
    Renders a PyMuPDF page to an OpenCV image and extends borders with mode refinements.
    Returns (extended_bgr_image, new_width_pt, new_height_pt).
    """
    if top_mm is None:
        top_mm = bleed_mm
    if bottom_mm is None:
        bottom_mm = bleed_mm
    if left_mm is None:
        left_mm = bleed_mm
    if right_mm is None:
        right_mm = bleed_mm

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    top_px = int(round(top_mm * (dpi / 25.4)))
    bottom_px = int(round(bottom_mm * (dpi / 25.4)))
    left_px = int(round(left_mm * (dpi / 25.4)))
    right_px = int(round(right_mm * (dpi / 25.4)))

    extended_bgr = extend_image_bleed_asymmetric(
        img_bgr, top_px=top_px, bottom_px=bottom_px, left_px=left_px, right_px=right_px, mode=mode,
        blur_bleed_margin=blur_bleed_margin, corner_smooth=corner_smooth,
        inpaint_alg=inpaint_alg, smooth_replicate=smooth_replicate, preserve_aspect=preserve_aspect,
        solid_color=solid_color
    )

    mm_to_pt = 72.0 / 25.4
    orig_rect = page.rect
    new_w_pt = orig_rect.width + (left_mm + right_mm) * mm_to_pt
    new_h_pt = orig_rect.height + (top_mm + bottom_mm) * mm_to_pt

    return extended_bgr, new_w_pt, new_h_pt


def process_pdf_session_bleed(
    doc_session: fitz.Document,
    target_page_indices: list[int],
    bleed_mm: float = 3.0,
    dpi: int = 300,
    mode: str = "mirrored",
    progress_callback=None,
    cancel_checker=None,
    layout_mode: str = "single",
    custom_sides_enabled: bool = False,
    top_enabled: bool = True, top_mm: float = 3.0,
    bottom_enabled: bool = True, bottom_mm: float = 3.0,
    side1_enabled: bool = True, side1_mm: float = 3.0,
    side2_enabled: bool = True, side2_mm: float = 3.0,
    blur_bleed_margin: bool = True,
    corner_smooth: bool = True,
    inpaint_alg: str = "ns",
    smooth_replicate: bool = True,
    preserve_aspect: bool = True,
    solid_color: tuple = (255, 255, 255)
) -> fitz.Document:
    """
    Modifies specific pages in a fitz.Document session with symmetric/asymmetric bleed and fill options.
    """
    mm_to_pt = 72.0 / 25.4
    total_targets = len(target_page_indices)

    for count, page_idx in enumerate(sorted(target_page_indices, reverse=True)):
        if cancel_checker and cancel_checker():
            raise InterruptedError("Auto-bleed process was cancelled by the user.")

        if progress_callback:
            progress_callback(count + 1, total_targets)

        orig_page = doc_session[page_idx]

        if custom_sides_enabled:
            t_mm, b_mm, l_mm, r_mm = resolve_page_bleed_asymmetric(
                page_num=page_idx + 1,
                layout_mode=layout_mode,
                top_enabled=top_enabled, top_mm=top_mm,
                bottom_enabled=bottom_enabled, bottom_mm=bottom_mm,
                side1_enabled=side1_enabled, side1_mm=side1_mm,
                side2_enabled=side2_enabled, side2_mm=side2_mm
            )
        else:
            t_mm = b_mm = l_mm = r_mm = bleed_mm

        ext_bgr, new_w_pt, new_h_pt = process_page_to_bleed_image(
            orig_page, bleed_mm=bleed_mm, dpi=dpi, mode=mode,
            top_mm=t_mm, bottom_mm=b_mm, left_mm=l_mm, right_mm=r_mm,
            blur_bleed_margin=blur_bleed_margin, corner_smooth=corner_smooth,
            inpaint_alg=inpaint_alg, smooth_replicate=smooth_replicate, preserve_aspect=preserve_aspect,
            solid_color=solid_color
        )

        is_success, buffer = cv2.imencode(".png", ext_bgr)
        if not is_success:
            continue
        img_bytes = buffer.tobytes()

        new_page = doc_session.new_page(page_idx + 1, width=new_w_pt, height=new_h_pt)
        page_rect = fitz.Rect(0, 0, new_w_pt, new_h_pt)
        new_page.insert_image(page_rect, stream=img_bytes)

        l_pt = l_mm * mm_to_pt
        t_pt = t_mm * mm_to_pt
        r_pt = r_mm * mm_to_pt
        b_pt = b_mm * mm_to_pt

        trim_rect = fitz.Rect(
            l_pt,
            t_pt,
            new_w_pt - r_pt,
            new_h_pt - b_pt
        )
        new_page.set_trimbox(trim_rect)
        new_page.set_bleedbox(new_page.rect)

        doc_session.delete_page(page_idx)

    return doc_session


def process_pdf_auto_bleed(
    input_pdf_path: str,
    output_pdf_path: str,
    bleed_mm: float = 3.0,
    dpi: int = 300,
    mode: str = "mirrored",
    page_range_str: str = "all",
    progress_callback=None,
    cancel_checker=None,
    layout_mode: str = "single",
    custom_sides_enabled: bool = False,
    top_enabled: bool = True, top_mm: float = 3.0,
    bottom_enabled: bool = True, bottom_mm: float = 3.0,
    side1_enabled: bool = True, side1_mm: float = 3.0,
    side2_enabled: bool = True, side2_mm: float = 3.0,
    blur_bleed_margin: bool = True,
    corner_smooth: bool = True,
    inpaint_alg: str = "ns",
    smooth_replicate: bool = True,
    preserve_aspect: bool = True,
    solid_color: tuple = (255, 255, 255)
) -> str:
    """
    Processes a PDF file with symmetric/asymmetric bleed and saves to output_pdf_path.
    """
    if not os.path.exists(input_pdf_path):
        raise FileNotFoundError(f"Input PDF not found: {input_pdf_path}")

    doc = fitz.open(input_pdf_path)
    target_indices = parse_page_range_string(page_range_str, len(doc))

    process_pdf_session_bleed(
        doc_session=doc,
        target_page_indices=target_indices,
        bleed_mm=bleed_mm,
        dpi=dpi,
        mode=mode,
        progress_callback=progress_callback,
        cancel_checker=cancel_checker,
        layout_mode=layout_mode,
        custom_sides_enabled=custom_sides_enabled,
        top_enabled=top_enabled, top_mm=top_mm,
        bottom_enabled=bottom_enabled, bottom_mm=bottom_mm,
        side1_enabled=side1_enabled, side1_mm=side1_mm,
        side2_enabled=side2_enabled, side2_mm=side2_mm,
        blur_bleed_margin=blur_bleed_margin, corner_smooth=corner_smooth,
        inpaint_alg=inpaint_alg, smooth_replicate=smooth_replicate, preserve_aspect=preserve_aspect,
        solid_color=solid_color
    )

    out_dir = os.path.dirname(output_pdf_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    doc.save(output_pdf_path, deflate=True)
    doc.close()

    return output_pdf_path
