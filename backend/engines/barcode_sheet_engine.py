"""
Barcode & QR Sheet Generator Engine
Handles sheet geometry math in mm, Code128 / QR rendering, 2-column CSV parsing (Content, Quantity),
CSV template export, layered SVG export with CutContour (#FF00FE), PDF press export with crop marks,
and high-DPI PNG/JPEG rendering.
"""

import os
import csv
import io
import math
import hashlib
import logging
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Callable

try:
    import barcode as python_barcode
    from barcode.writer import ImageWriter
    HAS_PYTHON_BARCODE = True
except ImportError:
    HAS_PYTHON_BARCODE = False

MM_TO_PT = 72.0 / 25.4  # 1 mm = 2.834645669 pt

logger = logging.getLogger(__name__)


class BarcodeSheetEngine:
    """Core engine for Barcode & QR sheet layout, CutContour layering, and multi-format export."""

    SHEET_PRESETS_MM = {
        "SRA3 (320 × 450 mm)": (320.0, 450.0),
        "330 × 483 mm (13 × 19 in)": (330.0, 483.0),
        "A3 (297 × 420 mm)": (297.0, 420.0),
        "A4 (210 × 297 mm)": (210.0, 297.0),
        "Custom (User Specified)": (320.0, 450.0)
    }

    # Code128 character set B encoding table (values 0-106)
    # Each value maps to a pattern of bar/space widths (6 elements per character)
    CODE128_PATTERNS = [
        [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
        [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
        [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
        [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
        [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
        [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
        [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
        [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
        [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
        [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
        [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
        [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
        [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
        [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
        [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
        [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
        [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
        [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
        [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
        [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
        [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],
        [2,1,1,2,3,2],[2,3,3,1,1,1,2]
    ]

    START_CODE_B = 104
    STOP_CODE = 106

    @staticmethod
    def _encode_code128b(content: str) -> List[int]:
        """Encode a string using Code128 character set B. Returns list of bar/space widths."""
        if not content:
            content = "SAMPLE"

        # Start with Start Code B
        values = [BarcodeSheetEngine.START_CODE_B]
        checksum = BarcodeSheetEngine.START_CODE_B

        for i, char in enumerate(content):
            code_val = ord(char) - 32
            if code_val < 0 or code_val > 95:
                code_val = 0  # Space for unprintable
            values.append(code_val)
            checksum += code_val * (i + 1)

        # Add checksum character
        values.append(checksum % 103)
        # Add stop code
        values.append(BarcodeSheetEngine.STOP_CODE)

        # Convert values to bar widths
        bars = []
        for val in values:
            bars.extend(BarcodeSheetEngine.CODE128_PATTERNS[val])

        return bars

    @staticmethod
    def generate_csv_template(filepath: str) -> bool:
        """
        Exports a sample 2-column CSV template file (Content, Quantity)
        for the user to edit in Excel/Calc and re-import.
        """
        try:
            with open(filepath, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Content", "Quantity"])
                writer.writerow(["https://bluewhale.print/qr/1001", 50])
                writer.writerow(["https://bluewhale.print/qr/1002", 30])
                writer.writerow(["SN-2026-CODE128-001", 25])
                writer.writerow(["SN-2026-CODE128-002", 25])
            return True
        except Exception as e:
            logger.error("CSV Template export failed: %s", e)
            return False

    @staticmethod
    def parse_vdp_csv(filepath: str) -> Tuple[List[str], List[Dict[str, str]], int]:
        """
        Parses a multi-column CSV file for Variable Data Merge (VDP).
        Returns (headers, list_of_records_dict, total_count).
        """
        if not filepath or not os.path.exists(filepath):
            raise FileNotFoundError(f"CSV file not found: {filepath}")

        headers = []
        records = []

        for encoding in ["utf-8-sig", "utf-8", "latin-1"]:
            try:
                headers = []
                records = []
                with open(filepath, mode="r", encoding=encoding) as f:
                    reader = csv.reader(f)
                    raw_header = next(reader, None)
                    if not raw_header:
                        continue
                    headers = [h.strip() for h in raw_header if h.strip()]
                    
                    for row in reader:
                        if not row or not any(field.strip() for field in row):
                            continue
                        rec = {}
                        for i, h in enumerate(headers):
                            rec[h] = row[i].strip() if i < len(row) else ""
                        records.append(rec)
                if headers and records:
                    break
            except (UnicodeDecodeError, csv.Error):
                continue

        if not records:
            # Fallback for simple single-column or empty files
            return ["Content"], [{"Content": "SAMPLE-VDP-001"}], 1

        return headers, records, len(records)

    @staticmethod
    def parse_quantity_csv(filepath: str) -> Tuple[List[Tuple[str, int]], int]:
        """
        Parses a 2-column CSV file (Content, Quantity).
        Returns (list_of_tuples_content_qty, total_item_count).
        """
        if not filepath or not os.path.exists(filepath):
            raise FileNotFoundError(f"CSV file not found: {filepath}")

        items = []
        total_count = 0
        parse_succeeded = False

        for encoding in ["utf-8-sig", "utf-8", "latin-1"]:
            try:
                items = []
                total_count = 0
                with open(filepath, mode="r", encoding=encoding) as f:
                    reader = csv.reader(f)
                    header = next(reader, None)
                    for row in reader:
                        if not row or len(row) < 1:
                            continue
                        content = row[0].strip()
                        if not content:
                            continue
                        qty = 1
                        if len(row) >= 2:
                            try:
                                parsed_qty = int(row[1].strip())
                                qty = max(1, parsed_qty)
                            except (ValueError, TypeError):
                                pass  # Default to 1 for non-numeric
                        items.append((content, qty))
                        total_count += qty
                parse_succeeded = True
                break
            except (UnicodeDecodeError, csv.Error):
                continue

        if not parse_succeeded:
            raise ValueError(f"Could not parse CSV file with any supported encoding: {filepath}")

        return items, total_count

    @staticmethod
    def calculate_sheet_grid(
        sheet_w_mm: float,
        sheet_h_mm: float,
        margin_mm: float,
        gap_mm: float,
        item_w_mm: float,
        item_h_mm: float
    ) -> Dict:
        """
        Calculates available grid capacity per sheet and positioning coordinates in mm.
        """
        # Validate inputs
        sheet_w_mm = max(1.0, sheet_w_mm)
        sheet_h_mm = max(1.0, sheet_h_mm)
        margin_mm = max(0.0, margin_mm)
        gap_mm = max(0.0, gap_mm)
        item_w_mm = max(1.0, item_w_mm)
        item_h_mm = max(1.0, item_h_mm)

        avail_w = max(0.0, sheet_w_mm - (2 * margin_mm))
        avail_h = max(0.0, sheet_h_mm - (2 * margin_mm))

        cols = max(1, int((avail_w + gap_mm) // (item_w_mm + gap_mm))) if (item_w_mm + gap_mm) > 0 else 1
        rows = max(1, int((avail_h + gap_mm) // (item_h_mm + gap_mm))) if (item_h_mm + gap_mm) > 0 else 1

        capacity_per_sheet = cols * rows

        # Calculate centering offset
        used_w = (cols * item_w_mm) + ((cols - 1) * gap_mm)
        used_h = (rows * item_h_mm) + ((rows - 1) * gap_mm)

        offset_x_mm = margin_mm + max(0.0, (avail_w - used_w) / 2.0)
        offset_y_mm = margin_mm + max(0.0, (avail_h - used_h) / 2.0)

        positions = []
        for r in range(rows):
            for c in range(cols):
                x = offset_x_mm + (c * (item_w_mm + gap_mm))
                y = offset_y_mm + (r * (item_h_mm + gap_mm))
                positions.append((x, y))

        return {
            "cols": cols,
            "rows": rows,
            "capacity": capacity_per_sheet,
            "used_w_mm": used_w,
            "used_h_mm": used_h,
            "positions_mm": positions
        }

    @staticmethod
    def generate_sequential_items(
        prefix: str = "SN-",
        start_val: int = 1001,
        end_val: int = 1024,
        suffix: str = "",
        digits: int = 4
    ) -> List[str]:
        """Generates a sequential range list of formatted serial strings."""
        items = []
        if start_val > end_val:
            start_val, end_val = end_val, start_val
        for num in range(start_val, end_val + 1):
            num_str = f"{num:0{digits}d}" if digits > 0 else str(num)
            items.append(f"{prefix}{num_str}{suffix}")
        return items

    @staticmethod
    def draw_barcode_matrix(
        content: str,
        code_type: str = "QR Code",
        width_px: int = 300,
        height_px: int = 300,
        text_color_bgr: Tuple[int, int, int] = (0, 0, 0)
    ) -> np.ndarray:
        """Generates single QR code or Code128 matrix image as BGR numpy array."""
        img = np.full((height_px, width_px, 3), 255, dtype=np.uint8)

        if not content:
            content = "SAMPLE-CODE"

        code_type_upper = code_type.upper()
        if "QR" in code_type_upper:
            try:
                qrmat = cv2.QRCodeEncoder.create()
                qr_img = qrmat.encode(content)
                if qr_img is not None:
                    padding_px = int(min(width_px, height_px) * 0.08)
                    qr_size = min(width_px - 2 * padding_px, height_px - 2 * padding_px)
                    qr_resized = cv2.resize(qr_img, (qr_size, qr_size), interpolation=cv2.INTER_NEAREST)
                    if len(qr_resized.shape) == 2:
                        qr_bgr = cv2.cvtColor(qr_resized, cv2.COLOR_GRAY2BGR)
                    else:
                        qr_bgr = qr_resized

                    if text_color_bgr != (0, 0, 0):
                        mask = qr_bgr[:, :, 0] < 128
                        qr_bgr[mask] = text_color_bgr

                    x_off = (width_px - qr_size) // 2
                    y_off = (height_px - qr_size) // 2
                    img[y_off:y_off + qr_size, x_off:x_off + qr_size] = qr_bgr
                    return img
            except Exception as e:
                logger.warning("QR encode failed for raster: %s", e)

        # Real Code128 barcode rendering
        bars = BarcodeSheetEngine._encode_code128b(content)
        h, w = height_px, width_px
        padding_x = max(10, int(w * 0.05))
        padding_y = max(10, int(h * 0.08))

        # Calculate total units for scaling
        total_units = sum(bars)
        if total_units == 0:
            return img

        unit_width = (w - 2 * padding_x) / total_units
        bar_x = float(padding_x)

        for i, bar_width in enumerate(bars):
            px_width = bar_width * unit_width
            if i % 2 == 0:  # Even indices are bars (dark)
                x1 = int(bar_x)
                x2 = int(bar_x + px_width)
                cv2.rectangle(img, (x1, padding_y), (x2, h - padding_y), text_color_bgr, -1)
            bar_x += px_width

        return img

    @staticmethod
    def render_sheet_svg(
        sheet_w_mm: float,
        sheet_h_mm: float,
        margin_mm: float,
        gap_mm: float,
        item_w_mm: float,
        item_h_mm: float,
        items: List[str],
        code_type: str = "QR Code",
        font_family: str = "Arial",
        font_size_pt: int = 10,
        code_color_hex: str = "#000000",
        text_color_hex: str = "#000000",
        is_bold: bool = False,
        is_italic: bool = False,
        add_cropmarks: bool = True,
        add_cutcontour: bool = True,
        cutcontour_offset_mm: float = 0.0,
        text_gap_mm: float = 2.0
    ) -> str:
        """
        Generates structured SVG containing separate <g id="Artwork"> and <g id="CutContour"> groups.
        Ensures strict separation between code matrix, text label, and CutContour vector paths.
        """
        grid_info = BarcodeSheetEngine.calculate_sheet_grid(
            sheet_w_mm, sheet_h_mm, margin_mm, gap_mm, item_w_mm, item_h_mm
        )
        positions = grid_info["positions_mm"]

        svg_lines = []
        svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{sheet_w_mm}mm" height="{sheet_h_mm}mm" viewBox="0 0 {sheet_w_mm} {sheet_h_mm}">')

        # ── LAYER 1: ARTWORK GROUP ─────────────────────────────────
        svg_lines.append('  <g id="Artwork">')
        svg_lines.append(f'    <rect width="{sheet_w_mm}" height="{sheet_h_mm}" fill="#FFFFFF"/>')

        item_idx = 0
        txt_weight = "bold" if is_bold else "normal"
        txt_style = "italic" if is_italic else "normal"
        font_size_mm = font_size_pt * 0.352778

        pad_mm = 1.5  # Internal safety padding inside item to keep CutContour clear
        avail_w = max(4.0, item_w_mm - (2 * pad_mm))
        avail_h = max(4.0, item_h_mm - (2 * pad_mm))

        code_h_box = max(4.0, avail_h - font_size_mm - text_gap_mm)
        code_w_box = avail_w
        code_start_y = pad_mm
        text_y = pad_mm + code_h_box + text_gap_mm + (font_size_mm * 0.85)

        for x_mm, y_mm in positions:
            if item_idx >= len(items):
                break
            content = items[item_idx]
            item_idx += 1

            svg_lines.append(f'    <g transform="translate({x_mm}, {y_mm})">')
            
            # Text label at bottom with user-configured gap
            escaped_content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            svg_lines.append(
                f'      <text x="{item_w_mm/2:.2f}" y="{text_y:.2f}" font-family="{font_family}" font-size="{font_size_mm:.2f}mm" '
                f'font-weight="{txt_weight}" font-style="{txt_style}" fill="{text_color_hex}" text-anchor="middle">{escaped_content}</text>'
            )

            # Code matrix element
            if "QR" in code_type.upper():
                try:
                    qrmat = cv2.QRCodeEncoder.create()
                    qr_img = qrmat.encode(content)
                    if qr_img is not None:
                        rows_c, cols_c = qr_img.shape[:2]
                        sq_size = min(code_w_box, code_h_box)
                        start_x = (item_w_mm - sq_size) / 2.0
                        start_y = code_start_y
                        cell_sz = sq_size / max(1, cols_c)

                        # Optimized: merge horizontally adjacent black modules into runs
                        for r in range(rows_c):
                            c = 0
                            while c < cols_c:
                                if qr_img[r, c] == 0:  # Black module
                                    run_start = c
                                    while c < cols_c and qr_img[r, c] == 0:
                                        c += 1
                                    run_len = c - run_start
                                    cell_x = start_x + (run_start * cell_sz)
                                    cell_y = start_y + (r * cell_sz)
                                    run_w = run_len * cell_sz
                                    svg_lines.append(f'      <rect x="{cell_x:.2f}" y="{cell_y:.2f}" width="{run_w:.2f}" height="{cell_sz:.2f}" fill="{code_color_hex}"/>')
                                else:
                                    c += 1
                    else:
                        raise ValueError("QR encoder returned None")
                except Exception as e:
                    logger.warning("QR encode failed for SVG item '%s': %s", content[:50], e)
                    # Draw error indicator (X pattern) instead of misleading solid block
                    svg_lines.append(f'      <rect x="{pad_mm:.2f}" y="{code_start_y:.2f}" width="{code_w_box:.2f}" height="{code_h_box:.2f}" fill="none" stroke="{code_color_hex}" stroke-width="0.3"/>')
                    svg_lines.append(f'      <line x1="{pad_mm:.2f}" y1="{code_start_y:.2f}" x2="{pad_mm + code_w_box:.2f}" y2="{code_start_y + code_h_box:.2f}" stroke="{code_color_hex}" stroke-width="0.3"/>')
                    svg_lines.append(f'      <line x1="{pad_mm + code_w_box:.2f}" y1="{code_start_y:.2f}" x2="{pad_mm:.2f}" y2="{code_start_y + code_h_box:.2f}" stroke="{code_color_hex}" stroke-width="0.3"/>')
            else:
                # Real Code128 barcode as SVG vector bars
                bars = BarcodeSheetEngine._encode_code128b(content)
                total_units = sum(bars)
                if total_units > 0:
                    unit_w = code_w_box / total_units
                    bar_x = pad_mm
                    for i, bar_width in enumerate(bars):
                        px_w = bar_width * unit_w
                        if i % 2 == 0:  # Even indices are bars (dark)
                            svg_lines.append(f'      <rect x="{bar_x:.3f}" y="{code_start_y:.2f}" width="{px_w:.3f}" height="{code_h_box:.2f}" fill="{code_color_hex}"/>')
                        bar_x += px_w

            svg_lines.append('    </g>')

        # Draw Item Crop Marks if enabled (for cutting each shape on a regular cutter)
        if add_cropmarks:
            cm_len = min(3.0, gap_mm / 2.0) if gap_mm > 0 else 2.5
            svg_lines.append('    <!-- Item Crop Marks for Guillotine Cutting -->')
            svg_lines.append('    <g id="CropMarks" stroke="#000000" stroke-width="0.25">')
            item_idx = 0
            for x_mm, y_mm in positions:
                if item_idx >= len(items):
                    break
                item_idx += 1
                w_mm = item_w_mm
                h_mm = item_h_mm

                # Top-Left corner ticks
                svg_lines.append(f'      <line x1="{x_mm}" y1="{y_mm - cm_len:.2f}" x2="{x_mm}" y2="{y_mm:.2f}"/>')
                svg_lines.append(f'      <line x1="{x_mm - cm_len:.2f}" y1="{y_mm}" x2="{x_mm:.2f}" y2="{y_mm}"/>')

                # Top-Right corner ticks
                svg_lines.append(f'      <line x1="{x_mm + w_mm:.2f}" y1="{y_mm - cm_len:.2f}" x2="{x_mm + w_mm:.2f}" y2="{y_mm:.2f}"/>')
                svg_lines.append(f'      <line x1="{x_mm + w_mm:.2f}" y1="{y_mm}" x2="{x_mm + w_mm + cm_len:.2f}" y2="{y_mm}"/>')

                # Bottom-Left corner ticks
                svg_lines.append(f'      <line x1="{x_mm}" y1="{y_mm + h_mm:.2f}" x2="{x_mm}" y2="{y_mm + h_mm + cm_len:.2f}"/>')
                svg_lines.append(f'      <line x1="{x_mm - cm_len:.2f}" y1="{y_mm + h_mm:.2f}" x2="{x_mm:.2f}" y2="{y_mm + h_mm:.2f}"/>')

                # Bottom-Right corner ticks
                svg_lines.append(f'      <line x1="{x_mm + w_mm:.2f}" y1="{y_mm + h_mm:.2f}" x2="{x_mm + w_mm:.2f}" y2="{y_mm + h_mm + cm_len:.2f}"/>')
                svg_lines.append(f'      <line x1="{x_mm + w_mm:.2f}" y1="{y_mm + h_mm:.2f}" x2="{x_mm + w_mm + cm_len:.2f}" y2="{y_mm + h_mm:.2f}"/>')
            svg_lines.append('    </g>')

        svg_lines.append('  </g>')

        # ── LAYER 2: CUTCONTOUR GROUP ───────────────────────────────
        if add_cutcontour:
            off = cutcontour_offset_mm
            svg_lines.append('  <g id="CutContour" stroke="#FF00FE" stroke-width="0.5" fill="none">')
            item_idx = 0
            for x_mm, y_mm in positions:
                if item_idx >= len(items):
                    break
                item_idx += 1
                box_x = x_mm - off
                box_y = y_mm - off
                box_w = item_w_mm + (2 * off)
                box_h = item_h_mm + (2 * off)
                svg_lines.append(f'    <rect x="{box_x:.2f}" y="{box_y:.2f}" width="{box_w:.2f}" height="{box_h:.2f}" rx="1"/>')
            svg_lines.append('  </g>')

        svg_lines.append('</svg>')
        return "\n".join(svg_lines)

    @staticmethod
    def render_sheet_pdf(
        sheet_w_mm: float,
        sheet_h_mm: float,
        margin_mm: float,
        gap_mm: float,
        item_w_mm: float,
        item_h_mm: float,
        items: List[str],
        output_pdf_path: str,
        code_type: str = "QR Code",
        font_family: str = "Arial",
        font_size_pt: int = 10,
        code_color_hex: str = "#000000",
        text_color_hex: str = "#000000",
        is_bold: bool = False,
        is_italic: bool = False,
        add_cropmarks: bool = True,
        add_cutcontour: bool = True,
        cutcontour_offset_mm: float = 0.0,
        text_gap_mm: float = 2.0
    ) -> bool:
        """Generates press-ready vector PDF document with text labels, CutContour lines, and crop marks."""
        try:
            grid_info = BarcodeSheetEngine.calculate_sheet_grid(
                sheet_w_mm, sheet_h_mm, margin_mm, gap_mm, item_w_mm, item_h_mm
            )
            positions = grid_info["positions_mm"]
            cap = grid_info["capacity"]

            doc = fitz.open()
            total_items = len(items)
            num_sheets = max(1, math.ceil(total_items / max(1, cap)))

            def hex_to_rgb(h_str):
                c = h_str.lstrip("#")
                if len(c) == 6:
                    return (int(c[0:2], 16)/255.0, int(c[2:4], 16)/255.0, int(c[4:6], 16)/255.0)
                return (0.0, 0.0, 0.0)

            rgb_text = hex_to_rgb(text_color_hex)
            rgb_code = hex_to_rgb(code_color_hex)
            bgr_code = (int(rgb_code[2]*255), int(rgb_code[1]*255), int(rgb_code[0]*255))

            pad_pt = 1.5 * MM_TO_PT
            text_gap_pt = text_gap_mm * MM_TO_PT

            # Validate font size
            font_size_pt = max(1, font_size_pt)

            # Cache for barcode images to avoid re-rendering identical content
            barcode_cache = {}

            item_idx = 0
            for sheet_idx in range(num_sheets):
                page_w_pt = sheet_w_mm * MM_TO_PT
                page_h_pt = sheet_h_mm * MM_TO_PT
                page = doc.new_page(width=page_w_pt, height=page_h_pt)

                # Batch shapes for CutContour and CropMarks (one per page)
                shape_cc = page.new_shape() if add_cutcontour else None
                shape_cm = page.new_shape() if add_cropmarks else None

                # Draw Items on current sheet
                for x_mm, y_mm in positions:
                    if item_idx >= total_items:
                        break
                    content = items[item_idx]
                    item_idx += 1

                    x_pt = x_mm * MM_TO_PT
                    y_pt = y_mm * MM_TO_PT
                    w_pt = item_w_mm * MM_TO_PT
                    h_pt = item_h_mm * MM_TO_PT

                    font_h_pt = float(font_size_pt) * 1.2
                    avail_h_pt = max(10.0, h_pt - (2 * pad_pt))
                    code_h_pt = max(8.0, avail_h_pt - font_h_pt - text_gap_pt)

                    code_rect = fitz.Rect(x_pt + pad_pt, y_pt + pad_pt, x_pt + w_pt - pad_pt, y_pt + pad_pt + code_h_pt)
                    text_rect = fitz.Rect(x_pt + pad_pt, y_pt + pad_pt + code_h_pt + text_gap_pt, x_pt + w_pt - pad_pt, y_pt + h_pt - pad_pt)

                    # Use cached barcode image or generate new one (M3: press-quality resolution)
                    cache_key = (content, code_type)
                    if cache_key not in barcode_cache:
                        barcode_cache[cache_key] = BarcodeSheetEngine.draw_barcode_matrix(
                            content, code_type,
                            width_px=int(w_pt * 300 / 72),
                            height_px=int(code_h_pt * 300 / 72),
                            text_color_bgr=bgr_code
                        )
                    mat_img = barcode_cache[cache_key]
                    success, enc = cv2.imencode(".png", mat_img)
                    if success:
                        page.insert_image(code_rect, stream=enc.tobytes())

                    # Draw text label below code
                    font_name = "helv"
                    if "courier" in font_family.lower() or "mono" in font_family.lower() or "consolas" in font_family.lower():
                        font_name = "cour"
                    elif "times" in font_family.lower() or "serif" in font_family.lower():
                        font_name = "tiro"
                    else:
                        # Warn for unmapped fonts
                        known_sans = ["arial", "helvetica", "inter", "roboto", "trebuchet", "impact"]
                        if font_family.lower() not in known_sans:
                            logger.info("Font '%s' not available in PDF built-ins, using Helvetica fallback", font_family)

                    if is_bold and is_italic:
                        font_name += "bi"
                    elif is_bold:
                        font_name += "bo"
                    elif is_italic:
                        font_name += "it"

                    page.insert_textbox(
                        text_rect,
                        content,
                        fontsize=font_size_pt,
                        fontname=font_name,
                        color=rgb_text,
                        align=fitz.TEXT_ALIGN_CENTER
                    )

                    # Batch CutContour Magenta Line if enabled
                    if shape_cc is not None:
                        off_pt = cutcontour_offset_mm * MM_TO_PT
                        cc_rect = fitz.Rect(x_pt - off_pt, y_pt - off_pt, x_pt + w_pt + off_pt, y_pt + h_pt + off_pt)
                        shape_cc.draw_rect(cc_rect)

                    # Batch Item Crop Marks if enabled (for cutting each shape)
                    if shape_cm is not None:
                        cm_pt = min(3.0 * MM_TO_PT, (gap_mm / 2.0) * MM_TO_PT) if gap_mm > 0 else 2.5 * MM_TO_PT

                        # Top-Left
                        shape_cm.draw_line(fitz.Point(x_pt, y_pt - cm_pt), fitz.Point(x_pt, y_pt))
                        shape_cm.draw_line(fitz.Point(x_pt - cm_pt, y_pt), fitz.Point(x_pt, y_pt))

                        # Top-Right
                        shape_cm.draw_line(fitz.Point(x_pt + w_pt, y_pt - cm_pt), fitz.Point(x_pt + w_pt, y_pt))
                        shape_cm.draw_line(fitz.Point(x_pt + w_pt, y_pt), fitz.Point(x_pt + w_pt + cm_pt, y_pt))

                        # Bottom-Left
                        shape_cm.draw_line(fitz.Point(x_pt, y_pt + h_pt), fitz.Point(x_pt, y_pt + h_pt + cm_pt))
                        shape_cm.draw_line(fitz.Point(x_pt - cm_pt, y_pt + h_pt), fitz.Point(x_pt, y_pt + h_pt))

                        # Bottom-Right
                        shape_cm.draw_line(fitz.Point(x_pt + w_pt, y_pt + h_pt), fitz.Point(x_pt + w_pt, y_pt + h_pt + cm_pt))
                        shape_cm.draw_line(fitz.Point(x_pt + w_pt, y_pt + h_pt), fitz.Point(x_pt + w_pt + cm_pt, y_pt + h_pt))

                # Commit batched shapes once per page
                if shape_cc is not None:
                    shape_cc.finish(color=(1.0, 0.0, 254/255.0), width=0.5)  # #FF00FE Spot Magenta
                    shape_cc.commit()
                if shape_cm is not None:
                    shape_cm.finish(color=(0, 0, 0), width=0.5)
                    shape_cm.commit()

            doc.save(output_pdf_path)
            doc.close()
            return True
        except Exception as e:
            logger.error("PDF generation failed: %s", e)
            return False

    @staticmethod
    def render_sheet_raster(
        svg_str: str,
        output_filepath: str,
        dpi: int = 300
    ) -> bool:
        """
        Converts SVG layout string into a high-DPI PNG/JPEG image using PyMuPDF SVG rendering.
        Guarantees exact, high-resolution press output.
        """
        # Validate DPI
        dpi = max(72, min(1200, dpi))

        try:
            svg_bytes = svg_str.encode("utf-8")
            doc = fitz.open(stream=svg_bytes, filetype="svg")
            if len(doc) == 0:
                return False
            page = doc[0]
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pix.save(output_filepath)
            doc.close()
            return True
        except Exception as e:
            logger.error("Raster export failed: %s", e)
            return False
