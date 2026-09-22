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
                if is_spread:
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "single",
                        "doc_idx": p_idx,
                        "half": "left",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Sheet {p_idx+1} (Left)"
                    })
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "single",
                        "doc_idx": p_idx,
                        "half": "right",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Sheet {p_idx+1} (Right)"
                    })
                else:
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "single",
                        "doc_idx": p_idx,
                        "half": "full",
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Page {p_idx+1}"
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
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "odds",
                        "doc_idx": p_odd,
                        "half": "left",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Odds Sheet {p_odd+1} (L)"
                    })
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "odds",
                        "doc_idx": p_odd,
                        "half": "right",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Odds Sheet {p_odd+1} (R)"
                    })
                if i < len(evens_indices):
                    p_even = evens_indices[i]
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "evens",
                        "doc_idx": p_even,
                        "half": "left",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Evens Sheet {p_even+1} (L)"
                    })
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "evens",
                        "doc_idx": p_even,
                        "half": "right",
                        "split_pos": spread_split_pos,
                        "rotation": 0,
                        "label": f"Evens Sheet {p_even+1} (R)"
                    })
        else:
            # Treat AS-IS: 1 sheet per scan, collated Odd 1, Even 1, Odd 2, Even 2...
            for i in range(max_sheets):
                if i < len(odds_indices):
                    p_odd = odds_indices[i]
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "odds",
                        "doc_idx": p_odd,
                        "half": "full",
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Odds Sheet {p_odd+1}"
                    })
                if i < len(evens_indices):
                    p_even = evens_indices[i]
                    pages.append({
                        "id": str(uuid.uuid4())[:8],
                        "source": "evens",
                        "doc_idx": p_even,
                        "half": "full",
                        "split_pos": 0.5,
                        "rotation": 0,
                        "label": f"Evens Sheet {p_even+1}"
                    })

        return pages

    @staticmethod
    def extract_page_image(
        doc_map: Dict[str, fitz.Document],
        page_info: Dict[str, Any],
        dpi: int = 200
    ) -> np.ndarray:
        """
        Renders and extracts the page image.
        """
        source = page_info["source"]
        doc = doc_map.get(source)
        if doc is None or page_info["doc_idx"] >= len(doc):
            return np.full((1200, 800, 3), 255, dtype=np.uint8)

        img = BookScanEngine.render_page_to_bgr(doc, page_info["doc_idx"], dpi=dpi)
        h, w = img.shape[:2]

        half = page_info.get("half", "full")
        split_pos = page_info.get("split_pos", 0.5)
        split_x = int(round(w * split_pos))

        if half == "left":
            extracted = img[:, :split_x]
        elif half == "right":
            extracted = img[:, split_x:]
        else:
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
    def deskew_image(image: np.ndarray, max_angle: float = 5.0) -> np.ndarray:
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=120, maxLineGap=15)
            if lines is None:
                return image

            angles = []
            for x1, y1, x2, y2 in lines.reshape(-1, 4):
                deg = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                if abs(deg) <= max_angle:
                    angles.append(deg)

            if not angles:
                return image

            median_angle = float(np.median(angles))
            if abs(median_angle) < 0.1:
                return image

            h, w = image.shape[:2]
            center = (w // 2, h // 2)
            rot_mat = cv2.getRotationMatrix2D(center, median_angle, 1.0)
            deskewed = cv2.warpAffine(
                image, rot_mat, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return deskewed
        except Exception:
            return image

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
        sharpen: bool = True
    ) -> np.ndarray:
        """
        Runs the refined processing pipeline:
        - Minimal border cleaning (edges only)
        - Color restoration (anti-washout & levels stretch)
        - Optional deskew and sharpening
        """
        img = image

        # 1. Minimal border cleaning (targets scan feed/glass boundary damage)
        if clean_borders and border_margin_px > 0:
            img = BookScanEngine.clean_outer_borders(img, margin_px=border_margin_px, threshold=border_threshold)

        # 2. Deskew if enabled
        if deskew:
            img = BookScanEngine.deskew_image(img)

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
        jpeg_quality: int = 95
    ) -> bool:
        """
        Compiles cleaned pages into a print-ready PDF with:
        - Mirrored bleed extension (default 3mm)
        - PDF TrimBox, BleedBox, and MediaBox tags
        - Professional vector crop/cut marks in the bleed margin
        """
        if not processed_images:
            return False

        doc = fitz.open()

        for idx, img in enumerate(processed_images):
            h, w = img.shape[:2]

            # Calculate bleed in pixels
            bleed_px = int(round(bleed_mm * (dpi / 25.4)))

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
            bleed_pt = bleed_mm * MM_TO_PTS

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
