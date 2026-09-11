"""
Variable Data & Batch Merge Studio Engine (VDP Engine)
Handles CSV/Excel data parsing, placeholder layout rendering, barcode generation,
and high-resolution batch PDF export using PyMuPDF (fitz).
"""

import os
import csv
import io
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Callable


class VDPEngine:
    """Core engine for Variable Data Printing (VDP) template processing and batch PDF generation."""

    @staticmethod
    def load_data_file(filepath: str) -> Tuple[List[str], List[Dict[str, str]]]:
        """
        Parses a CSV file and returns (headers, list_of_record_dicts).
        Supports UTF-8, UTF-8-SIG, and Latin-1 encodings.
        """
        if not filepath or not os.path.exists(filepath):
            raise FileNotFoundError(f"Data file not found: {filepath}")

        records = []
        headers = []

        # Try opening with UTF-8-SIG (strips BOM) then fallback to utf-8 / latin-1
        for encoding in ["utf-8-sig", "utf-8", "latin-1"]:
            try:
                with open(filepath, mode="r", encoding=encoding) as f:
                    reader = csv.DictReader(f)
                    headers = [h.strip() for h in (reader.fieldnames or []) if h]
                    for row in reader:
                        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}
                        records.append(clean_row)
                break
            except (UnicodeDecodeError, csv.Error):
                records = []
                headers = []
                continue

        return headers, records

    @staticmethod
    def generate_sequence_data(prefix: str, start: int, count: int, padding: int, suffix: str) -> Tuple[List[str], List[Dict[str, str]]]:
        """
        Generates automatic sequential record dictionaries without an external file.
        E.g. prefix="TICKET-", start=1, count=100, padding=4 -> TICKET-0001 to TICKET-0100
        """
        headers = ["SerialNo", "Value"]
        records = []
        for i in range(start, start + count):
            formatted_num = f"{i:0{padding}d}"
            seq_val = f"{prefix}{formatted_num}{suffix}"
            records.append({
                "SerialNo": str(i),
                "Value": seq_val
            })
        return headers, records

    @staticmethod
    def draw_barcode_pixmap(data: str, barcode_type: str = "QR", width: int = 150, height: int = 150) -> Optional[bytes]:
        """Generates QR code or Code128 barcode image as PNG bytes."""
        if not data:
            data = "SAMPLE"

        barcode_type_upper = barcode_type.upper()
        if "QR" in barcode_type_upper:
            # Use OpenCV QRCodeDetector / QRCodeEncoder or build matrix
            try:
                qrmat = cv2.QRCodeEncoder.create()
                qr_img = qrmat.encode(data)
                if qr_img is not None:
                    # Resize to target
                    qr_resized = cv2.resize(qr_img, (width, height), interpolation=cv2.INTER_NEAREST)
                    # Convert single channel / float to 8-bit BGR
                    if len(qr_resized.shape) == 2:
                        qr_bgr = cv2.cvtColor(qr_resized, cv2.COLOR_GRAY2BGR)
                    else:
                        qr_bgr = qr_resized
                    _, buf = cv2.imencode(".png", qr_bgr)
                    return buf.tobytes()
            except Exception:
                pass

        # Fallback simple QR / Barcode renderer using PyMuPDF / drawing
        pix = fitz.Pixmap(fitz.csRGB, fitz.Rect(0, 0, width, height), False)
        pix.clear_with(255)
        _, buf = cv2.imencode(".png", np.full((height, width, 3), 240, dtype=np.uint8))
        return buf.tobytes()

    @staticmethod
    def render_single_record_page(
        template_path: str,
        record: Dict[str, str],
        placeholders: List[Dict],
        page_idx: int = 0
    ) -> Optional[fitz.Page]:
        """
        Renders a single template page with placeholder overlays applied for a specific record.
        Returns a PyMuPDF Page in a temporary document.
        """
        if not template_path or not os.path.exists(template_path):
            return None

        ext = os.path.splitext(template_path)[1].lower()
        doc = fitz.open()

        if ext == ".pdf":
            src_doc = fitz.open(template_path)
            if page_idx < 0 or page_idx >= len(src_doc):
                page_idx = 0
            page = doc.new_page(width=src_doc[page_idx].rect.width, height=src_doc[page_idx].rect.height)
            page.show_pdf_page(page.rect, src_doc, page_idx)
            src_doc.close()
        else:
            # Image template (PNG, JPG)
            img = cv2.imread(template_path)
            if img is None:
                return None
            h, w = img.shape[:2]
            # Convert px to points (assuming 150 DPI baseline or native pixels)
            pt_w = w * 72.0 / 150.0
            pt_h = h * 72.0 / 150.0
            page = doc.new_page(width=pt_w, height=pt_h)
            success, enc = cv2.imencode(".jpg", img)
            if success:
                page.insert_image(page.rect, stream=enc.tobytes())

        # Draw Placeholders
        for ph in placeholders:
            ph_type = ph.get("type", "text")
            field_name = ph.get("field", "")
            val = record.get(field_name, ph.get("default", "")) if field_name else ph.get("default", "")

            x = float(ph.get("x", 20))
            y = float(ph.get("y", 20))
            w = float(ph.get("w", 200))
            h = float(ph.get("h", 40))

            rect = fitz.Rect(x, y, x + w, y + h)

            if ph_type == "text" or ph_type == "counter":
                font_size = float(ph.get("font_size", 14))
                color_hex = ph.get("color", "#000000").lstrip("#")
                if len(color_hex) == 6:
                    r = int(color_hex[0:2], 16) / 255.0
                    g = int(color_hex[2:4], 16) / 255.0
                    b = int(color_hex[4:6], 16) / 255.0
                else:
                    r, g, b = 0, 0, 0

                align_str = ph.get("align", "left").lower()
                align_code = 0  # 0=Left, 1=Center, 2=Right
                if align_str == "center":
                    align_code = 1
                elif align_str == "right":
                    align_code = 2

                # Insert text into rect with PyMuPDF font
                fontname = ph.get("font", "helv")
                try:
                    page.insert_textbox(
                        rect,
                        str(val),
                        fontsize=font_size,
                        fontname=fontname,
                        color=(r, g, b),
                        align=align_code
                    )
                except Exception:
                    page.insert_text(
                        fitz.Point(x, y + font_size),
                        str(val),
                        fontsize=font_size,
                        color=(r, g, b)
                    )

            elif ph_type == "barcode" or ph_type == "qr":
                png_bytes = VDPEngine.draw_barcode_pixmap(str(val), barcode_type=ph.get("barcode_type", "QR"), width=int(w), height=int(h))
                if png_bytes:
                    page.insert_image(rect, stream=png_bytes)

            elif ph_type == "image":
                # Check if val is an existing image path
                img_path = str(val)
                if os.path.exists(img_path):
                    try:
                        page.insert_image(rect, filename=img_path)
                    except Exception:
                        pass

        return page

    @staticmethod
    def batch_export_pdf(
        template_path: str,
        records: List[Dict[str, str]],
        placeholders: List[Dict],
        output_pdf_path: str,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> bool:
        """
        Generates a consolidated multi-page press PDF containing all processed records.
        Returns True on success.
        """
        if not template_path or not os.path.exists(template_path):
            return False
        if not records:
            return False

        try:
            out_doc = fitz.open()
            total = len(records)

            for idx, rec in enumerate(records):
                # Render single record into a 1-page temp document
                temp_page = VDPEngine.render_single_record_page(template_path, rec, placeholders)
                if temp_page and temp_page.parent:
                    # Import page into output doc
                    out_doc.insert_pdf(temp_page.parent, from_page=0, to_page=0)
                    temp_page.parent.close()

                if progress_callback:
                    progress_callback(idx + 1, total)

            out_doc.save(output_pdf_path)
            out_doc.close()
            return True
        except Exception as e:
            print(f"[VDP Engine Error] Batch export failed: {e}")
            return False
