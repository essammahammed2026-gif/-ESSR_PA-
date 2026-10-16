import os
import math
import uuid
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
from engines.units import MM_TO_PTS, PTS_TO_MM

class BookScanEngine:
    """
    Engine for processing scanned book pages:
    - Ingestion of dual scan files (odds/evens) or single file
    - Double-page spread splitting & collation
    - Computer vision cleanup (deskew, border/margin crop, paper whitening, contrast & sharpen)
    - 3mm (or custom) print bleed extension & crop marks
    """

    FULL_BOX: Dict[str, float] = {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}

    @staticmethod
    def compose_crop_boxes(outer: Optional[Dict[str, Any]], inner: Optional[Dict[str, Any]]) -> Dict[str, float]:
        """Compose view-relative crop boxes into one absolute box.

        The canvas overlay works in coordinates relative to the *rendered* image
        (which already has `outer` applied), so an Apply/Split commits with
        absolute = outer + inner * outer_size. Missing boxes mean full bed.
        """
        o = outer or BookScanEngine.FULL_BOX
        n = inner or BookScanEngine.FULL_BOX

        def num(box: Dict[str, Any], key: str, fallback: float) -> float:
            try:
                return float(box.get(key, fallback))
            except (TypeError, ValueError):
                return fallback

        ox1, oy1 = num(o, "x1", 0.0), num(o, "y1", 0.0)
        ox2, oy2 = num(o, "x2", 1.0), num(o, "y2", 1.0)
        ow, oh = max(0.0, ox2 - ox1), max(0.0, oy2 - oy1)
        nx1, ny1 = num(n, "x1", 0.0), num(n, "y1", 0.0)
        nx2, ny2 = num(n, "x2", 1.0), num(n, "y2", 1.0)
        return {
            "x1": round(ox1 + nx1 * ow, 4),
            "y1": round(oy1 + ny1 * oh, 4),
            "x2": round(ox1 + nx2 * ow, 4),
            "y2": round(oy1 + ny2 * oh, 4),
        }

    @staticmethod
    def box_frac_w(box: Optional[Dict[str, Any]]) -> float:
        if not box:
            return 1.0
        try:
            return max(0.0, float(box.get("x2", 1.0)) - float(box.get("x1", 0.0)))
        except (TypeError, ValueError):
            return 1.0

    @staticmethod
    def box_frac_h(box: Optional[Dict[str, Any]]) -> float:
        if not box:
            return 1.0
        try:
            return max(0.0, float(box.get("y2", 1.0)) - float(box.get("y1", 0.0)))
        except (TypeError, ValueError):
            return 1.0

    @staticmethod
    def open_session_docs(session: Dict[str, Any]) -> Dict[str, Any]:
        """Single-copy session doc opener — routers must not fitz.open directly."""
        doc_map: Dict[str, Any] = {}
        if session.get("odds_path"):
            doc_map["odds"] = fitz.open(session["odds_path"])
        if session.get("evens_path"):
            doc_map["evens"] = fitz.open(session["evens_path"])
        if session.get("single_path"):
            doc_map["single"] = fitz.open(session["single_path"])
        return doc_map

    @staticmethod
    def close_session_docs(doc_map: Dict[str, Any]) -> None:
        for d in doc_map.values():
            try:
                d.close()
            except Exception:
                pass

    @staticmethod
    def collate_from_paths(
        odds_path: Optional[str] = None,
        evens_path: Optional[str] = None,
        single_path: Optional[str] = None,
        is_spread: bool = False,
        odds_order: str = "forward",
        evens_order: str = "reverse",
        spread_split_pos: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Single-copy collation entry point by path — opens, collates, closes.

        Fixes the router-side unclosed-fitz leak: docs never escape to routers.
        """
        odds_doc = fitz.open(odds_path) if odds_path else None
        evens_doc = fitz.open(evens_path) if evens_path else None
        single_doc = fitz.open(single_path) if single_path else None
        try:
            return BookScanEngine.collate_scans(
                odds_doc=odds_doc,
                evens_doc=evens_doc,
                is_spread=is_spread,
                odds_order=odds_order,
                evens_order=evens_order,
                spread_split_pos=spread_split_pos,
                single_doc=single_doc,
            )
        finally:
            for d in (odds_doc, evens_doc, single_doc):
                if d is not None:
                    try:
                        d.close()
                    except Exception:
                        pass

    @staticmethod
    def write_thumbnail_jpg(img: np.ndarray, thumb_path: str, quality: int = 80) -> bool:
        """Single-copy ndarray → JPEG writer — keeps cv2.imencode out of routers."""
        try:
            success, enc = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
            if not success:
                return False
            with open(thumb_path, "wb") as f:
                f.write(enc.tobytes())
            return True
        except Exception:
            return False

    @staticmethod
    def combine_files_to_pdf(file_paths: List[str], output_pdf_path: str) -> bool:
        """Combines multiple files (PDFs, images: PNG, JPG, TIFF, WEBP, etc.) into a single unified PDF."""
        doc = fitz.open()
        try:
            for fpath in file_paths:
                if not os.path.exists(fpath):
                    continue
                ext = os.path.splitext(fpath)[1].lower()
                if ext == ".pdf":
                    sub_doc = fitz.open(fpath)
                    doc.insert_pdf(sub_doc)
                    sub_doc.close()
                else:
                    img_doc = fitz.open(fpath)
                    pdf_bytes = img_doc.convert_to_pdf()
                    img_doc.close()
                    sub_doc = fitz.open("pdf", pdf_bytes)
                    doc.insert_pdf(sub_doc)
                    sub_doc.close()
            doc.save(output_pdf_path)
            return True
        except Exception as e:
            print(f"Error combining files to PDF: {e}")
            return False
        finally:
            doc.close()

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
        if page_info.get("is_blank") or page_info.get("source") == "blank":
            w_mm = float(page_info.get("width_mm") or 210.0)
            h_mm = float(page_info.get("height_mm") or 297.0)
            px_w = max(10, int(round(w_mm * dpi / 25.4)))
            px_h = max(10, int(round(h_mm * dpi / 25.4)))
            return np.full((px_h, px_w, 3), 255, dtype=np.uint8)

        source = page_info["source"]
        doc = doc_map.get(source)
        if doc is None or page_info["doc_idx"] >= len(doc):
            return np.full((1200, 800, 3), 255, dtype=np.uint8)

        img = BookScanEngine.render_page_to_bgr(doc, page_info["doc_idx"], dpi=dpi)
        h, w = img.shape[:2]

        slice_box = page_info.get("slice_box")
        half = page_info.get("half", "full")

        if slice_box is not None:
            spread_cb = page_info.get("spread_crop_box") or page_info.get("crop_box")
            if spread_cb:
                cx1 = max(0, min(w - 1, int(round(spread_cb.get("x1", 0.0) * w))))
                cy1 = max(0, min(h - 1, int(round(spread_cb.get("y1", 0.0) * h))))
                cx2 = max(cx1 + 1, min(w, int(round(spread_cb.get("x2", 1.0) * w))))
                cy2 = max(cy1 + 1, min(h, int(round(spread_cb.get("y2", 1.0) * h))))
                img = img[cy1:cy2, cx1:cx2]
                h, w = img.shape[:2]

            sb_x1 = max(0, min(w - 1, int(round(slice_box.get("x1", 0.0) * w))))
            sb_y1 = max(0, min(h - 1, int(round(slice_box.get("y1", 0.0) * h))))
            sb_x2 = max(sb_x1 + 1, min(w, int(round(slice_box.get("x2", 1.0) * w))))
            sb_y2 = max(sb_y1 + 1, min(h, int(round(slice_box.get("y2", 1.0) * h))))
            img = img[sb_y1:sb_y2, sb_x1:sb_x2]
            h, w = img.shape[:2]

            page_cb = page_info.get("page_crop_box")
            if page_cb:
                px1 = max(0, min(w - 1, int(round(page_cb.get("x1", 0.0) * w))))
                py1 = max(0, min(h - 1, int(round(page_cb.get("y1", 0.0) * h))))
                px2 = max(px1 + 1, min(w, int(round(page_cb.get("x2", 1.0) * w))))
                py2 = max(py1 + 1, min(h, int(round(page_cb.get("y2", 1.0) * h))))
                img = img[py1:py2, px1:px2]
            extracted = img
        elif half in ["left", "right"]:
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

    # --- Session page-list operations (moved from router, fix.md 1.4b) ---

    @staticmethod
    def split_pages(pages, page_id, crop_box=None, split_pos=0.5,
                    split_lines=None, split_direction="vertical",
                    apply_to_all=False, target_page_ids=None):
        """Split full spreads into slices along vertical or horizontal lines. Returns (new_pages, new_selected_id).

        Raises PageOpError(400) when no split occurred.
        """
        new_pages = []
        split_occurred = False
        new_selected_id = None
        target_ids = set(target_page_ids) if target_page_ids is not None else None

        # Normalize split positions
        if split_lines:
            lines = sorted(list(set([float(x) for x in split_lines if 0.01 <= float(x) <= 0.99])))
            if not lines:
                lines = [split_pos if split_pos is not None else 0.5]
        else:
            lines = [split_pos if split_pos is not None else 0.5]

        direction = (split_direction or "vertical").lower()
        cuts = [0.0] + lines + [1.0]
        num_slices = len(cuts) - 1

        for p in pages:
            if target_ids is not None:
                is_target = p["id"] in target_ids
            elif apply_to_all:
                is_target = True
            else:
                is_target = (p["id"] == page_id)

            is_already_split = p.get("half") in ["left", "right"] or p.get("slice_box") is not None or bool(p.get("parent_page_id"))

            if is_target:
                split_occurred = True
                base_label = p.get("label", "Sheet").replace(" (Spread)", "")

                if not is_already_split:
                    # First split of root spread
                    cb = BookScanEngine.compose_crop_boxes(p.get("crop_box"), crop_box)
                    sp = lines[0] if lines else 0.5

                    p_orig_w = p.get("orig_width_mm") or p.get("width_mm", 297.0)
                    p_orig_h = p.get("orig_height_mm") or p.get("height_mm", 210.0)
                    cb_w = BookScanEngine.box_frac_w(cb)
                    cb_h = BookScanEngine.box_frac_h(cb)
                    cropped_w = p_orig_w * cb_w
                    cropped_h = p_orig_h * cb_h

                    common = {
                        "source": p["source"],
                        "doc_idx": p["doc_idx"],
                        "crop_box": cb,
                        "spread_crop_box": cb,
                        "split_pos": sp,
                        "spread_split_pos": sp,
                        "split_lines": lines,
                        "split_direction": direction,
                        "page_crop_box": None,
                        "rotation": p.get("rotation", 0),
                        "parent_page_id": p["id"],
                        "is_spread": False,
                        "parent_spread_width_mm": round(cropped_w, 1),
                        "parent_spread_height_mm": round(cropped_h, 1),
                    }

                    slice_ids = []
                    for i in range(num_slices):
                        s_start = cuts[i]
                        s_end = cuts[i + 1]
                        s_id = str(uuid.uuid4())[:8]
                        slice_ids.append(s_id)
                        if p["id"] == page_id and new_selected_id is None:
                            new_selected_id = s_id

                        if direction == "horizontal":
                            s_box = {"x1": 0.0, "y1": s_start, "x2": 1.0, "y2": s_end}
                            s_w = round(cropped_w, 1)
                            s_h = round(cropped_h * (s_end - s_start), 1)
                            if num_slices == 2:
                                s_label = f"{base_label} (Top)" if i == 0 else f"{base_label} (Bottom)"
                            else:
                                s_label = f"{base_label} (Row {i+1})"
                            half_name = f"row_{i}"
                        else:
                            s_box = {"x1": s_start, "y1": 0.0, "x2": s_end, "y2": 1.0}
                            s_w = round(cropped_w * (s_end - s_start), 1)
                            s_h = round(cropped_h, 1)
                            if num_slices == 2:
                                s_label = f"{base_label} (Left)" if i == 0 else f"{base_label} (Right)"
                                half_name = "left" if i == 0 else "right"
                            else:
                                s_label = f"{base_label} (Col {i+1})"
                                half_name = f"col_{i}"

                        new_pages.append({
                            **common,
                            "id": s_id,
                            "half": half_name,
                            "slice_box": s_box,
                            "label": s_label,
                            "width_mm": s_w,
                            "orig_width_mm": s_w,
                            "height_mm": s_h,
                            "orig_height_mm": s_h,
                            "rev": 0,
                        })

                    if new_selected_id is None and slice_ids:
                        new_selected_id = slice_ids[0]
                else:
                    # Slicing an already-split page (iterative multi-step split)
                    # Compose any page_crop_box and incoming crop_box
                    effective_pcb = BookScanEngine.compose_crop_boxes(p.get("page_crop_box"), crop_box)
                    parent_sb = p.get("slice_box") or {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}

                    psb_x1 = float(parent_sb.get("x1", 0.0))
                    psb_y1 = float(parent_sb.get("y1", 0.0))
                    psb_x2 = float(parent_sb.get("x2", 1.0))
                    psb_y2 = float(parent_sb.get("y2", 1.0))
                    psb_w = max(0.001, psb_x2 - psb_x1)
                    psb_h = max(0.001, psb_y2 - psb_y1)

                    vis_x1 = psb_x1 + float(effective_pcb.get("x1", 0.0)) * psb_w
                    vis_y1 = psb_y1 + float(effective_pcb.get("y1", 0.0)) * psb_h
                    vis_x2 = psb_x1 + float(effective_pcb.get("x2", 1.0)) * psb_w
                    vis_y2 = psb_y1 + float(effective_pcb.get("y2", 1.0)) * psb_h
                    vis_w = max(0.001, vis_x2 - vis_x1)
                    vis_h = max(0.001, vis_y2 - vis_y1)

                    p_w = float(p.get("orig_width_mm") or p.get("width_mm") or 210.0)
                    p_h = float(p.get("orig_height_mm") or p.get("height_mm") or 297.0)
                    pcb_frac_w = BookScanEngine.box_frac_w(effective_pcb)
                    pcb_frac_h = BookScanEngine.box_frac_h(effective_pcb)
                    base_active_w = p_w * pcb_frac_w
                    base_active_h = p_h * pcb_frac_h

                    sp = lines[0] if lines else 0.5
                    common = {
                        "source": p["source"],
                        "doc_idx": p["doc_idx"],
                        "crop_box": {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0},
                        "spread_crop_box": p.get("spread_crop_box") or p.get("crop_box"),
                        "split_pos": sp,
                        "spread_split_pos": p.get("spread_split_pos", sp),
                        "split_lines": lines,
                        "split_direction": direction,
                        "page_crop_box": None,
                        "rotation": p.get("rotation", 0),
                        "parent_page_id": p.get("parent_page_id") or p["id"],
                        "immediate_parent_id": p["id"],
                        "is_spread": False,
                        "parent_spread_width_mm": p.get("parent_spread_width_mm", round(base_active_w, 1)),
                        "parent_spread_height_mm": p.get("parent_spread_height_mm", round(base_active_h, 1)),
                    }

                    slice_ids = []
                    for i in range(num_slices):
                        s_start = cuts[i]
                        s_end = cuts[i + 1]
                        s_id = str(uuid.uuid4())[:8]
                        slice_ids.append(s_id)
                        if p["id"] == page_id and new_selected_id is None:
                            new_selected_id = s_id

                        if direction == "horizontal":
                            s_box = {
                                "x1": round(vis_x1, 5),
                                "y1": round(vis_y1 + s_start * vis_h, 5),
                                "x2": round(vis_x2, 5),
                                "y2": round(vis_y1 + s_end * vis_h, 5),
                            }
                            s_w = round(base_active_w, 1)
                            s_h = round(base_active_h * (s_end - s_start), 1)
                            if num_slices == 2:
                                s_label = f"{base_label} (Top)" if i == 0 else f"{base_label} (Bottom)"
                            else:
                                s_label = f"{base_label} (Row {i+1})"
                            half_name = f"row_{i}"
                        else:
                            s_box = {
                                "x1": round(vis_x1 + s_start * vis_w, 5),
                                "y1": round(vis_y1, 5),
                                "x2": round(vis_x1 + s_end * vis_w, 5),
                                "y2": round(vis_y2, 5),
                            }
                            s_w = round(base_active_w * (s_end - s_start), 1)
                            s_h = round(base_active_h, 1)
                            if num_slices == 2:
                                s_label = f"{base_label} (Left)" if i == 0 else f"{base_label} (Right)"
                            else:
                                s_label = f"{base_label} (Col {i+1})"
                            half_name = f"col_{i}"

                        new_pages.append({
                            **common,
                            "id": s_id,
                            "half": half_name,
                            "slice_box": s_box,
                            "label": s_label,
                            "width_mm": s_w,
                            "orig_width_mm": s_w,
                            "height_mm": s_h,
                            "orig_height_mm": s_h,
                            "rev": 0,
                        })

                    if new_selected_id is None and slice_ids:
                        new_selected_id = slice_ids[0]
            else:
                new_pages.append(p)

        if not split_occurred:
            raise PageOpError(400, "Target page not found.")
        return new_pages, new_selected_id

    @staticmethod
    def restore_pages(current_pages: List[Dict[str, Any]], new_pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Atomically restores session pages from a history snapshot.
        Validates page format and returns validated pages.
        """
        if not isinstance(new_pages, list):
            raise PageOpError(400, "Snapshot pages must be a list")
        for p in new_pages:
            if not isinstance(p, dict) or "id" not in p or "source" not in p or "doc_idx" not in p:
                raise PageOpError(400, "Invalid page item structure in restore snapshot")
        return new_pages

    @staticmethod
    def revert_pages(pages, page_id=None, revert_all=False, target_page_ids=None):
        """Recombine split slices into parent spreads. Returns (new_pages, new_selected_id).

        Raises PageOpError(400/404) on missing targets.
        """
        def is_split_page(page_item):
            return (
                page_item.get("half") in ["left", "right"]
                or page_item.get("slice_box") is not None
                or bool(page_item.get("parent_page_id"))
            )

        target_pairs = set()

        if revert_all:
            for p in pages:
                if is_split_page(p):
                    target_pairs.add((p["source"], p["doc_idx"]))
        elif target_page_ids:
            t_ids = set(target_page_ids)
            for p in pages:
                if p["id"] in t_ids and is_split_page(p):
                    target_pairs.add((p["source"], p["doc_idx"]))
        elif page_id:
            target_page = next((p for p in pages if p["id"] == page_id), None)
            if not target_page:
                raise PageOpError(404, "Page not found.")
            target_pairs.add((target_page["source"], target_page["doc_idx"]))
        else:
            raise PageOpError(400, "page_id or revert_all required.")

        if not target_pairs:
            raise PageOpError(400, "No split pages found to revert.")

        new_pages = []
        recombined_pairs = set()
        new_selected_id = None

        for p in pages:
            pair = (p["source"], p["doc_idx"])
            if pair in target_pairs and is_split_page(p):
                if pair not in recombined_pairs:
                    recombined_pairs.add(pair)
                    orig_w = p.get("parent_spread_width_mm") or p.get("orig_width_mm") or 297.0
                    orig_h = p.get("parent_spread_height_mm") or p.get("orig_height_mm") or 210.0
                    reverted_id = p.get("parent_page_id") or str(uuid.uuid4())[:8]
                    if new_selected_id is None:
                        new_selected_id = reverted_id
                    # Reused parent id can hit stale cached thumbnails: bump past children.
                    child_rev = 0
                    for q in pages:
                        if (q["source"], q["doc_idx"]) == pair and is_split_page(q):
                            try:
                                child_rev = max(child_rev, int(q.get("rev", 0)))
                            except (TypeError, ValueError):
                                pass
                    new_pages.append({
                        "id": reverted_id,
                        "source": p["source"],
                        "doc_idx": p["doc_idx"],
                        "half": "full",
                        "crop_box": p.get("spread_crop_box") or p.get("crop_box"),
                        "split_pos": p.get("spread_split_pos") if p.get("spread_split_pos") is not None else p.get("split_pos", 0.5),
                        "rotation": p.get("rotation", 0),
                        "label": f"Sheet {p['doc_idx'] + 1} (Spread)",
                        "is_spread": True,
                        "width_mm": orig_w,
                        "height_mm": orig_h,
                        "orig_width_mm": orig_w,
                        "orig_height_mm": orig_h,
                        "rev": child_rev + 1,
                    })
            else:
                new_pages.append(p)

        return new_pages, new_selected_id

    @staticmethod
    def apply_crop_to_pages(pages, page_id, crop_box, apply_to_all=False, target_page_ids=None):
        """Commit a view-relative crop box onto targeted pages (mutates + returns pages).

        The canvas overlay works in coordinates relative to the *rendered* image
        (stored crops already applied), so the incoming box is composed onto the
        stored box instead of replacing it. Repeat crops therefore keep refining
        the visible region instead of corrupting it, and dimensions derive from
        the composed absolute box. The Apply is final: callers reset their
        overlay to full bed afterwards.
        """
        target_ids = set(target_page_ids) if target_page_ids is not None else None

        for p in pages:
            if target_ids is not None:
                is_target = p["id"] in target_ids
            elif apply_to_all:
                is_target = True
            else:
                is_target = (p["id"] == page_id)

            if is_target:
                is_slice = (
                    p.get("half") in ["left", "right"]
                    or p.get("slice_box") is not None
                    or bool(p.get("parent_page_id"))
                )
                if is_slice:
                    composed = BookScanEngine.compose_crop_boxes(p.get("page_crop_box"), crop_box)
                    p["page_crop_box"] = composed
                    base_w = p.get("orig_width_mm") or p.get("width_mm", 210.0)
                    base_h = p.get("orig_height_mm") or p.get("height_mm", 297.0)
                    p["orig_width_mm"] = base_w
                    p["orig_height_mm"] = base_h
                    p["width_mm"] = round(base_w * BookScanEngine.box_frac_w(composed), 1)
                    p["height_mm"] = round(base_h * BookScanEngine.box_frac_h(composed), 1)
                else:
                    composed = BookScanEngine.compose_crop_boxes(p.get("crop_box"), crop_box)
                    p["crop_box"] = composed
                    orig_w = p.get("orig_width_mm") or p.get("width_mm", 210.0)
                    orig_h = p.get("orig_height_mm") or p.get("height_mm", 297.0)
                    p["orig_width_mm"] = orig_w
                    p["orig_height_mm"] = orig_h
                    p["width_mm"] = round(orig_w * BookScanEngine.box_frac_w(composed), 1)
                    p["height_mm"] = round(orig_h * BookScanEngine.box_frac_h(composed), 1)
                try:
                    p["rev"] = int(p.get("rev", 0)) + 1
                except (TypeError, ValueError):
                    p["rev"] = 1
        return pages

    @staticmethod
    def render_export_pages(doc_map, pages, req) -> tuple:
        """Per-page extract + scope evaluation + processing. Returns (images, bleed_list)."""
        processed_images = []
        per_page_bleed_list = []
        for idx, p_info in enumerate(pages):
            page_num = idx + 1
            raw_img = BookScanEngine.extract_page_image(doc_map, p_info, dpi=req.dpi)

            # Evaluate module scope per page
            apply_deskew = req.deskew_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.deskew_scope_mode, req.deskew_custom_range
            )
            apply_restoration = req.restoration_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.restoration_scope_mode, req.restoration_custom_range
            )
            apply_bleed = req.bleed_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.bleed_scope_mode, req.bleed_custom_range
            )

            # Restoration settings
            if req.restoration_module_enabled:
                do_clean_borders = apply_restoration and req.clean_borders
                do_enhance_colors = apply_restoration and req.enhance_colors
            else:
                do_clean_borders = req.clean_borders
                do_enhance_colors = req.enhance_colors

            cleaned = BookScanEngine.process_single_page(
                raw_img,
                clean_borders=do_clean_borders,
                border_margin_px=req.border_margin_px,
                border_threshold=req.border_threshold,
                enhance_colors=do_enhance_colors,
                saturation=req.saturation,
                contrast=req.contrast,
                deskew=req.deskew if not req.deskew_module_enabled else False,
                sharpen=req.sharpen,
                deskew_module_enabled=apply_deskew,
                deskew_mode=req.deskew_mode,
                deskew_angle=req.deskew_angle,
                deskew_max_angle=req.deskew_max_angle,
                deskew_ignore_borders=req.deskew_ignore_borders,
            )
            processed_images.append(cleaned)

            # Bleed settings per page
            if req.bleed_module_enabled:
                p_bleed = req.bleed_mm if apply_bleed else 0.0
                p_marks = req.show_crop_marks if apply_bleed else False
            else:
                p_bleed = 0.0
                p_marks = False

            per_page_bleed_list.append({
                "bleed_mm": p_bleed,
                "show_crop_marks": p_marks
            })
        return processed_images, per_page_bleed_list

    @staticmethod
    def duplicate_page(pages: List[Dict[str, Any]], target_page_id: str, position: str = "after") -> tuple[List[Dict[str, Any]], str]:
        target_idx = next((i for i, p in enumerate(pages) if p["id"] == target_page_id), -1)
        if target_idx == -1:
            raise PageOpError(404, "Target page not found.")

        target = pages[target_idx]
        new_id = str(uuid.uuid4())[:8]
        new_page = dict(target)
        new_page["id"] = new_id
        new_page["label"] = f"{target.get('label', 'Page')} (Copy)"
        try:
            new_page["rev"] = int(target.get("rev", 0)) + 1
        except (TypeError, ValueError):
            new_page["rev"] = 1

        insert_at = target_idx + 1 if position == "after" else target_idx
        new_pages = list(pages)
        new_pages.insert(insert_at, new_page)
        return new_pages, new_id

    @staticmethod
    def insert_blank_page(
        pages: List[Dict[str, Any]],
        target_page_id: str,
        position: str = "after",
        width_mm: Optional[float] = None,
        height_mm: Optional[float] = None,
    ) -> tuple[List[Dict[str, Any]], str]:
        target_idx = next((i for i, p in enumerate(pages) if p["id"] == target_page_id), -1)

        ref_w = 210.0
        ref_h = 297.0
        if 0 <= target_idx < len(pages):
            ref_w = pages[target_idx].get("width_mm", 210.0)
            ref_h = pages[target_idx].get("height_mm", 297.0)

        w = float(width_mm or ref_w)
        h = float(height_mm or ref_h)

        new_id = str(uuid.uuid4())[:8]
        new_page = {
            "id": new_id,
            "source": "blank",
            "doc_idx": 0,
            "half": "full",
            "is_spread": False,
            "is_blank": True,
            "rotation": 0,
            "label": "Blank Page",
            "width_mm": w,
            "height_mm": h,
            "orig_width_mm": w,
            "orig_height_mm": h,
            "rev": 1,
        }

        insert_at = (target_idx + 1 if position == "after" else target_idx) if target_idx >= 0 else len(pages)
        new_pages = list(pages)
        new_pages.insert(insert_at, new_page)
        return new_pages, new_id

    @staticmethod
    def extract_single_page(
        doc_map: Dict[str, Any],
        page_info: Dict[str, Any],
        output_path: str,
        format: str = "pdf",
        dpi: int = 300
    ) -> bool:
        fmt = format.lower()
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=dpi)
        if fmt == "pdf":
            return BookScanEngine.add_bleed_and_export_pdf(
                processed_images=[raw_img],
                output_pdf_path=output_path,
                bleed_mm=0.0,
                show_crop_marks=False,
                dpi=dpi,
                jpeg_quality=95,
            )
        elif fmt in ["png", "jpeg", "jpg", "webp"]:
            return cv2.imwrite(output_path, raw_img)
        return False


class PageOpError(Exception):
    """Engine-side operation failure carrying an HTTP status (router converts)."""

    def __init__(self, status_code: int = 400, detail: str = "Operation failed."):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
