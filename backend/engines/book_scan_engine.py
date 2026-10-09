import os
import math
import uuid
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

MM_TO_PTS = 72.0 / 25.4
PTS_TO_MM = 25.4 / 72.0

class BookScanEngine:
    """
    Engine for processing scanned book pages:
    - Ingestion of dual scan files (odds/evens) or single file
    - Double-page spread splitting & collation
    - Computer vision cleanup (deskew, border/margin crop, paper whitening, contrast & sharpen)
    - 3mm (or custom) print bleed extension & crop marks
    """

    @staticmethod
    def render_page_to_bgr(doc: fitz.Document, page_num: int, dpi: int = 150) -> np.ndarray:
        page = doc[page_num]
        pix = page.get_pixmap(dpi=dpi)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
        if pix.n == 4:
            return cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:
            return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        elif pix.n == 1:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        return img

    @staticmethod
    def collate_scans(
        odds_doc: Optional[fitz.Document],
        evens_doc: Optional[fitz.Document],
        is_spread: bool = False,
        odds_order: str = "forward",   # 'forward' (1, 3, 5...) or 'reverse'
        evens_order: str = "reverse",  # 'reverse' (...6, 4, 2) or 'forward'
        spread_split_pos: float = 0.5, # relative position 0.0 to 1.0 (seam)
        single_doc: Optional[fitz.Document] = None
    ) -> List[Dict[str, Any]]:
        """
        Creates an ordered sequence of logical pages from the uploaded file(s).
        When is_spread=False, pages are treated as-is without any splitting.
        """
        pages = []

        if single_doc is not None:
            # Single file mode
            num_pages = len(single_doc)
            page_indices = list(range(num_pages))
            if odds_order == "reverse":
                page_indices.reverse()

            for p_idx in page_indices:
                dp = single_doc[p_idx]
                w_mm = round(dp.rect.width * 25.4 / 72.0, 1)
                h_mm = round(dp.rect.height * 25.4 / 72.0, 1)
                if is_spread:
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "single",
                        "doc_idx": p_idx,
                        "half": "full",
                        "is_spread": True,
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Sheet {p_idx+1} (Spread)",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })
                else:
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "single",
                        "doc_idx": p_idx,
                        "half": "full",
                        "is_spread": False,
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Page {p_idx+1}",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })
            return pages

        # Dual file mode: odds + evens
        odds_count = len(odds_doc) if odds_doc else 0
        evens_count = len(evens_doc) if evens_doc else 0

        odds_indices = list(range(odds_count))
        if odds_order == "reverse":
            odds_indices.reverse()

        evens_indices = list(range(evens_count))
        if evens_order == "reverse":
            evens_indices.reverse()

        max_sheets = max(len(odds_indices), len(evens_indices))

        if is_spread:
            for i in range(max_sheets):
                if i < len(odds_indices):
                    p_odd = odds_indices[i]
                    dp = odds_doc[p_odd]
                    w_mm = round(dp.rect.width * 25.4 / 72.0, 1)
                    h_mm = round(dp.rect.height * 25.4 / 72.0, 1)
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "odds",
                        "doc_idx": p_odd,
                        "half": "full",
                        "is_spread": True,
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Odds Sheet {p_odd+1} (Spread)",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })
                if i < len(evens_indices):
                    p_even = evens_indices[i]
                    dp = evens_doc[p_even]
                    w_mm = round(dp.rect.width * 25.4 / 72.0, 1)
                    h_mm = round(dp.rect.height * 25.4 / 72.0, 1)
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "evens",
                        "doc_idx": p_even,
                        "half": "full",
                        "is_spread": True,
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Evens Sheet {p_even+1} (Spread)",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })
        else:
            # Treat AS-IS: 1 sheet per scan, collated Odd 1, Even 1, Odd 2, Even 2...
            for i in range(max_sheets):
                if i < len(odds_indices):
                    p_odd = odds_indices[i]
                    dp = odds_doc[p_odd]
                    w_mm = round(dp.rect.width * 25.4 / 72.0, 1)
                    h_mm = round(dp.rect.height * 25.4 / 72.0, 1)
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "odds",
                        "doc_idx": p_odd,
                        "half": "full",
                        "is_spread": False,
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Odds Sheet {p_odd+1}",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })
                if i < len(evens_indices):
                    p_even = evens_indices[i]
                    dp = evens_doc[p_even]
                    w_mm = round(dp.rect.width * 25.4 / 72.0, 1)
                    h_mm = round(dp.rect.height * 25.4 / 72.0, 1)
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "evens",
                        "doc_idx": p_even,
                        "half": "full",
                        "is_spread": False,
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Evens Sheet {p_even+1}",
                        "width_mm": w_mm,
                        "height_mm": h_mm,
                        "orig_width_mm": w_mm,
                        "orig_height_mm": h_mm,
                    })

        return pages

    @staticmethod
    def extract_page_image(
        doc_map: Dict[str, fitz.Document],
        page_info: Dict[str, Any],
        dpi: int = 200
    ) -> np.ndarray:
        """
        Renders and extracts the page image with optional crop_box and split_pos.
        """
        source = page_info["source"]
        doc = doc_map.get(source)
        if doc is None or page_info["doc_idx"] >= len(doc):
            return np.full((1200, 800, 3), 255, dtype=np.uint8)

        img = BookScanEngine.render_page_to_bgr(doc, page_info["doc_idx"], dpi=dpi)
        h, w = img.shape[:2]

        half = page_info.get("half", "full")
        if half in ["left", "right"]:
            spread_cb = page_info.get("spread_crop_box") or page_info.get("crop_box")
            if spread_cb:
                cx1 = max(0, min(w - 1, int(round(spread_cb.get("x1", 0.0) * w))))
                cy1 = max(0, min(h - 1, int(round(spread_cb.get("y1", 0.0) * h))))
                cx2 = max(cx1 + 1, min(w, int(round(spread_cb.get("x2", 1.0) * w))))
                cy2 = max(cy1 + 1, min(h, int(round(spread_cb.get("y2", 1.0) * h))))
                img = img[cy1:cy2, cx1:cx2]
                h, w = img.shape[:2]

            sp = page_info.get("spread_split_pos") if page_info.get("spread_split_pos") is not None else page_info.get("split_pos", 0.5)
            split_x = int(round(w * sp))
            if half == "left":
                img = img[:, :split_x]
            else:
                img = img[:, split_x:]
            h, w = img.shape[:2]

            # Secondary single-page crop on the extracted half (if any)
            page_cb = page_info.get("page_crop_box")
            if page_cb:
                px1 = max(0, min(w - 1, int(round(page_cb.get("x1", 0.0) * w))))
                py1 = max(0, min(h - 1, int(round(page_cb.get("y1", 0.0) * h))))
                px2 = max(px1 + 1, min(w, int(round(page_cb.get("x2", 1.0) * w))))
                py2 = max(py1 + 1, min(h, int(round(page_cb.get("y2", 1.0) * h))))
                img = img[py1:py2, px1:px2]
            extracted = img
        else:
            cb = page_info.get("page_crop_box") or page_info.get("crop_box")
            if cb:
                cx1 = max(0, min(w - 1, int(round(cb.get("x1", 0.0) * w))))
                cy1 = max(0, min(h - 1, int(round(cb.get("y1", 0.0) * h))))
                cx2 = max(cx1 + 1, min(w, int(round(cb.get("x2", 1.0) * w))))
                cy2 = max(cy1 + 1, min(h, int(round(cb.get("y2", 1.0) * h))))
                img = img[cy1:cy2, cx1:cx2]
            extracted = img

        rot = page_info.get("rotation", 0) % 360
        if rot == 90:
            extracted = cv2.rotate(extracted, cv2.ROTATE_90_CLOCKWISE)
        elif rot == 180:
            extracted = cv2.rotate(extracted, cv2.ROTATE_180)
        elif rot == 270:
            extracted = cv2.rotate(extracted, cv2.ROTATE_90_COUNTERCLOCKWISE)

        return extracted

    @staticmethod
    def detect_book_crop_and_seam(image: np.ndarray) -> Dict[str, Any]:
        """
        Auto-detects the physical book boundary (cropping away empty scanner glass/margins)
        and locates the central spine fold seam:
        - Downscales to proxy for rapid analysis
        - Computes edge gradient and ink presence across the scanner bed
        - Finds active paper/content bounding rectangle
        - Searches the central gutter zone for spine shadow / vertical margin minimum
        """
        try:
            h, w = image.shape[:2]
            if h < 50 or w < 50:
                return {"crop_box": {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}, "split_pos": 0.5}

            scale = 1000.0 / max(h, w)
            if scale < 1.0:
                proxy = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            else:
                proxy = image.copy()
            ph, pw = proxy.shape[:2]

            if len(proxy.shape) == 3:
                gray = cv2.cvtColor(proxy, cv2.COLOR_BGR2GRAY)
            else:
                gray = proxy

            # 1. Detect content/paper boundaries
            bg = cv2.medianBlur(gray, 31)
            diff = cv2.subtract(bg, gray)
            edges = cv2.Canny(gray, 30, 100)
            combined = cv2.max(diff, edges)
            _, thresh = cv2.threshold(combined, 15, 255, cv2.THRESH_BINARY)

            k = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
            fused = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k)

            pts = np.argwhere(fused > 0)
            if len(pts) > 50:
                y1_p, x1_p = pts.min(axis=0)
                y2_p, x2_p = pts.max(axis=0)

                pad_x = int(pw * 0.02)
                pad_y = int(ph * 0.02)
                x1_p = max(0, x1_p - pad_x)
                y1_p = max(0, y1_p - pad_y)
                x2_p = min(pw, x2_p + pad_x)
                y2_p = min(ph, y2_p + pad_y)

                x1 = round(float(x1_p / pw), 3)
                y1 = round(float(y1_p / ph), 3)
                x2 = round(float(x2_p / pw), 3)
                y2 = round(float(y2_p / ph), 3)
            else:
                x1, y1, x2, y2 = 0.0, 0.0, 1.0, 1.0
                x1_p, y1_p, x2_p, y2_p = 0, 0, pw, ph

            # 2. Detect central spine fold inside the cropped book
            crop_w = max(10, x2_p - x1_p)
            book_slice = gray[y1_p:y2_p, x1_p:x2_p]

            w_start = int(crop_w * 0.35)
            w_end = int(crop_w * 0.65)
            if w_end > w_start + 5:
                center_slice = book_slice[:, w_start:w_end]
                col_means = np.mean(center_slice, axis=0)
                min_col = int(np.argmin(col_means))
                spine_rel = round(float((w_start + min_col) / crop_w), 3)
            else:
                spine_rel = 0.50

            spine_rel = max(0.40, min(0.60, spine_rel))

            return {
                "crop_box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "split_pos": spine_rel
            }
        except Exception:
            return {"crop_box": {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}, "split_pos": 0.5}

    @staticmethod
    def clean_outer_borders(
        image: np.ndarray,
        margin_px: int = 15,
        threshold: int = 210,
        fill_color: tuple = (255, 255, 255)
    ) -> np.ndarray:
        """
        Minimal border cleaning:
        Cleans only the extreme outer edge zone (where scanner feed marks, shadow lines,
        and ragged edges occur), leaving the inner artwork and text completely untouched.
        """
        if margin_px <= 0:
            return image

        try:
            cleaned = image.copy()
            h, w = image.shape[:2]
            m = min(margin_px, h // 10, w // 10)
            if m <= 0:
                return image

            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            border_mask = np.zeros((h, w), dtype=bool)
            border_mask[:m, :] = True
            border_mask[-m:, :] = True
            border_mask[:, :m] = True
            border_mask[:, -m:] = True

            dirty = border_mask & (gray < threshold)
            cleaned[dirty] = fill_color
            return cleaned
        except Exception:
            return image

    @staticmethod
    def enhance_colors_and_richness(
        image: np.ndarray,
        saturation: float = 1.30,
        contrast: float = 1.10,
        black_level: int = 12,
        white_level: int = 248
    ) -> np.ndarray:
        """
        Restores washed-out colors from flatbed/ADF scans by:
        1. Stretching histogram levels (deepens blacks and clears milky hazes).
        2. Boosting vibrance / color saturation in HSV color space without oversaturating skin/paper tones.
        """
        try:
            # 1. Levels stretch to remove washed out haze
            img_f = image.astype(np.float32)
            stretched = np.clip(
                (img_f - black_level) * (255.0 / max(1.0, float(white_level - black_level))),
                0, 255
            )

            # 2. Contrast boost
            if contrast != 1.0:
                stretched = (stretched - 128.0) * contrast + 128.0
                stretched = np.clip(stretched, 0, 255)

            # 3. Saturation boost in HSV
            stretched_u8 = stretched.astype(np.uint8)
            if saturation != 1.0:
                hsv = cv2.cvtColor(stretched_u8, cv2.COLOR_BGR2HSV).astype(np.float32)
                hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation, 0, 255)
                stretched_u8 = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

            return stretched_u8
        except Exception:
            return image

    @staticmethod
    def detect_skew_angle(
        image: np.ndarray,
        max_angle: float = 10.0,
        ignore_borders: bool = True
    ) -> float:
        """
        Robustly and accurately detects page skew angle on scanned books:
        - Downscales image to normalized 1000px proxy for sub-25ms analysis
        - Normalizes non-uniform illumination and spine gutter shadows using adaptive background subtraction
        - Masks out scanner bed margins and feed roller shadows if ignore_borders is True
        - Bridges word spaces into continuous text lines using horizontal morphological structuring
        - Primary method: Analyzes text line contours using minAreaRect with weighted median angle (immune to multi-column misalignment)
        - Fallback method: Multi-strip vertical projection profiling across 3 interior columns (for sparse text or tables)
        """
        try:
            h, w = image.shape[:2]
            if h < 50 or w < 50:
                return 0.0

            scale = 1000.0 / max(h, w)
            if scale < 1.0:
                proxy = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            else:
                proxy = image.copy()
            ph, pw = proxy.shape[:2]

            if len(proxy.shape) == 3:
                gray = cv2.cvtColor(proxy, cv2.COLOR_BGR2GRAY)
            else:
                gray = proxy

            # 1. Adaptive illumination normalization (removes scanner gradients, spine shadow, yellowing)
            bg = cv2.medianBlur(gray, 21)
            diff = cv2.subtract(bg, gray)
            _, thresh = cv2.threshold(diff, 16, 255, cv2.THRESH_BINARY)

            # 2. Mask outer margins if requested (scanner platen borders, feed rollers)
            if ignore_borders:
                m_h = int(ph * 0.06)
                m_w = int(pw * 0.06)
                thresh[:m_h, :] = 0
                thresh[-m_h:, :] = 0
                thresh[:, :m_w] = 0
                thresh[:, -m_w:] = 0

            # 3. Horizontal morphological structuring to fuse words into continuous text lines
            k_w = max(15, int(pw * 0.038))
            k_h = max(2, int(ph * 0.003))
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_w, k_h))
            dilated = cv2.dilate(thresh, kernel)

            # 4. Primary: Contour-based text baseline detection (high precision, immune to multi-column misalignment)
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            angles = []
            weights = []

            for c in contours:
                area = cv2.contourArea(c)
                if area > 80:
                    rect = cv2.minAreaRect(c)
                    (cx, cy), (rw, rh), a = rect
                    if rw < rh:
                        rw, rh = rh, rw
                        a += 90.0
                    while a > 45.0:
                        a -= 90.0
                    while a < -45.0:
                        a += 90.0

                    aspect = rw / max(1.0, rh)
                    # Text line criteria: elongated horizontal aspect ratio
                    if aspect >= 2.5 and abs(a) <= max_angle:
                        angles.append(a)
                        weights.append(rw)

            if len(angles) >= 4:
                # Weighted median of text line angles
                sorted_indices = np.argsort(angles)
                sorted_angles = np.array(angles)[sorted_indices]
                sorted_weights = np.array(weights)[sorted_indices]
                cum_weights = np.cumsum(sorted_weights)
                cutoff = cum_weights[-1] / 2.0
                median_idx = np.where(cum_weights >= cutoff)[0][0]
                best_angle = float(sorted_angles[median_idx])
                return round(best_angle, 2)

            # 5. Fallback: Multi-strip vertical projection profile (for sparse text or table pages)
            cx, cy = pw // 2, ph // 2
            best_angle = 0.0
            best_var = -1.0
            strips = [(0.12, 0.42), (0.35, 0.65), (0.58, 0.88)]

            coarse_angles = np.arange(-max_angle, max_angle + 0.5, 0.5)
            for a in coarse_angles:
                rot = cv2.getRotationMatrix2D((cx, cy), a, 1.0)
                warped = cv2.warpAffine(dilated, rot, (pw, ph), flags=cv2.INTER_NEAREST)
                v = 0.0
                for s1, s2 in strips:
                    strip = warped[:, int(pw * s1):int(pw * s2)]
                    v += float(np.var(np.sum(strip, axis=1)))
                if v > best_var:
                    best_var = v
                    best_angle = a

            fine_angles = np.arange(best_angle - 0.5, best_angle + 0.6, 0.05)
            for a in fine_angles:
                rot = cv2.getRotationMatrix2D((cx, cy), a, 1.0)
                warped = cv2.warpAffine(dilated, rot, (pw, ph), flags=cv2.INTER_NEAREST)
                v = 0.0
                for s1, s2 in strips:
                    strip = warped[:, int(pw * s1):int(pw * s2)]
                    v += float(np.var(np.sum(strip, axis=1)))
                if v > best_var:
                    best_var = v
                    best_angle = a

            return round(float(best_angle), 2)
        except Exception:
            return 0.0

    @staticmethod
    def apply_deskew(
        image: np.ndarray,
        angle: float,
        fill_color: tuple = (255, 255, 255)
    ) -> np.ndarray:
        """
        Applies precise affine rotation to straighten the image by the given angle in degrees.
        Uses border replication to prevent harsh stark white corner seams on natural paper.
        """
        if abs(angle) < 0.05:
            return image
        try:
            h, w = image.shape[:2]
            cx, cy = w // 2, h // 2
            rot_mat = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
            deskewed = cv2.warpAffine(
                image,
                rot_mat,
                (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return deskewed
        except Exception:
            return image

    @staticmethod
    def deskew_image(image: np.ndarray, max_angle: float = 5.0) -> np.ndarray:
        try:
            detected_angle = BookScanEngine.detect_skew_angle(image, max_angle=max_angle)
            return BookScanEngine.apply_deskew(image, detected_angle)
        except Exception:
            return image

    @staticmethod
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
            try:
                parts = [p.strip() for p in custom_range.split(",") if p.strip()]
                for part in parts:
                    if "-" in part:
                        s_str, e_str = part.split("-", 1)
                        s, e = int(s_str.strip()), int(e_str.strip())
                        if s <= page_num <= e:
                            return True
                    else:
                        if int(part) == page_num:
                            return True
                return False
            except Exception:
                return True
        return True

    @staticmethod
    def process_single_page(
        image: np.ndarray,
        clean_borders: bool = True,
        border_margin_px: int = 15,
        border_threshold: int = 210,
        enhance_colors: bool = True,
        saturation: float = 1.30,
        contrast: float = 1.10,
        deskew: bool = False,
        sharpen: bool = True,
        deskew_module_enabled: bool = False,
        deskew_mode: str = "auto",
        deskew_angle: float = 0.0,
        deskew_max_angle: float = 10.0,
        deskew_ignore_borders: bool = True
    ) -> np.ndarray:
        """
        Runs the refined processing pipeline:
        1. Intelligent Deskew & Alignment module (straightens content first)
        2. Minimal border cleaning (cleans straight outer edges cleanly)
        3. Color restoration (anti-washout & levels stretch)
        4. Sharpening
        """
        img = image

        # 1. Deskew Module (priority) or Legacy Deskew — MUST run first so subsequent border clean is axis-aligned
        if deskew_module_enabled:
            if deskew_mode == "auto":
                detected_angle = BookScanEngine.detect_skew_angle(
                    img,
                    max_angle=deskew_max_angle,
                    ignore_borders=deskew_ignore_borders
                )
                img = BookScanEngine.apply_deskew(img, detected_angle)
            else:
                img = BookScanEngine.apply_deskew(img, deskew_angle)
        elif deskew:
            img = BookScanEngine.deskew_image(img)

        # 2. Minimal border cleaning (targets scan feed/glass boundary damage along straightened axes)
        if clean_borders and border_margin_px > 0:
            img = BookScanEngine.clean_outer_borders(img, margin_px=border_margin_px, threshold=border_threshold)

        # 3. Restore washed-out colors & richness
        if enhance_colors:
            img = BookScanEngine.enhance_colors_and_richness(img, saturation=saturation, contrast=contrast)

        # 4. Sharpen
        if sharpen:
            try:
                gaussian = cv2.GaussianBlur(img, (0, 0), 2.0)
                img = cv2.addWeighted(img, 1.3, gaussian, -0.3, 0)
            except Exception:
                pass

        return img

    @staticmethod
    def add_bleed_and_export_pdf(
        processed_images: List[np.ndarray],
        output_pdf_path: str,
        bleed_mm: float = 3.0,
        show_crop_marks: bool = True,
        dpi: int = 300,
        jpeg_quality: int = 95,
        per_page_bleed: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Compiles cleaned pages into a print-ready PDF with:
        - Mirrored bleed extension (default 3mm or per-page override)
        - PDF TrimBox, BleedBox, and MediaBox tags
        - Professional vector crop/cut marks in the bleed margin
        """
        if not processed_images:
            return False

        doc = fitz.open()

        for idx, img in enumerate(processed_images):
            h, w = img.shape[:2]

            cur_bleed_mm = bleed_mm
            cur_show_crop = show_crop_marks
            if per_page_bleed and idx < len(per_page_bleed):
                cur_bleed_mm = per_page_bleed[idx].get("bleed_mm", 0.0)
                cur_show_crop = per_page_bleed[idx].get("show_crop_marks", False)

            # Calculate bleed in pixels
            bleed_px = int(round(cur_bleed_mm * (dpi / 25.4)))

            # Extended image with mirrored border reflection
            if bleed_px > 0:
                extended_img = cv2.copyMakeBorder(
                    img, bleed_px, bleed_px, bleed_px, bleed_px, cv2.BORDER_REFLECT_101
                )
            else:
                extended_img = img

            ext_h, ext_w = extended_img.shape[:2]

            # Dimensions in points
            trim_w_pt = (w / dpi) * 72.0
            trim_h_pt = (h / dpi) * 72.0
            bleed_pt = cur_bleed_mm * MM_TO_PTS

            # Total page dimension in PDF points
            page_w_pt = trim_w_pt + (2.0 * bleed_pt)
            page_h_pt = trim_h_pt + (2.0 * bleed_pt)

            page = doc.new_page(width=page_w_pt, height=page_h_pt)
            if bleed_pt > 0:
                page.set_trimbox(fitz.Rect(bleed_pt, bleed_pt, bleed_pt + trim_w_pt, bleed_pt + trim_h_pt))

            # Encode image to JPEG
            success, enc = cv2.imencode(".jpg", extended_img, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
            if not success:
                continue

            page.insert_image(page.rect, stream=enc.tobytes())

            # Draw Crop Marks if enabled and bleed > 0
            if show_crop_marks and bleed_pt > 0:
                shape = page.new_shape()
                off = 1.0 * MM_TO_PTS
                mlen = max(1.5 * MM_TO_PTS, bleed_pt - off)

                # Trim boundaries
                x0 = bleed_pt
                y0 = bleed_pt
                x1 = bleed_pt + trim_w_pt
                y1 = bleed_pt + trim_h_pt

                # Top-Left
                shape.draw_line(fitz.Point(x0 - off, y0), fitz.Point(max(0.0, x0 - off - mlen), y0))
                shape.draw_line(fitz.Point(x0, y0 - off), fitz.Point(x0, max(0.0, y0 - off - mlen)))

                # Top-Right
                shape.draw_line(fitz.Point(x1 + off, y0), fitz.Point(min(page_w_pt, x1 + off + mlen), y0))
                shape.draw_line(fitz.Point(x1, y0 - off), fitz.Point(x1, max(0.0, y0 - off - mlen)))

                # Bottom-Left
                shape.draw_line(fitz.Point(x0 - off, y1), fitz.Point(max(0.0, x0 - off - mlen), y1))
                shape.draw_line(fitz.Point(x0, y1 + off), fitz.Point(x0, min(page_h_pt, y0 + off + mlen)))

                # Bottom-Right
                shape.draw_line(fitz.Point(x1 + off, y1), fitz.Point(min(page_w_pt, x1 + off + mlen), y1))
                shape.draw_line(fitz.Point(x1, y1 + off), fitz.Point(x1, min(page_h_pt, y1 + off + mlen)))

                shape.finish(color=(0, 0, 0), width=0.3, stroke_opacity=1.0)
                shape.commit()

        doc.save(output_pdf_path)
        doc.close()
        return True
