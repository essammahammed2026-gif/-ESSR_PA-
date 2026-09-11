"""
Quick Print Engine - Batch Document & Image Converter, Duplex Normalizer, and Job Prep Tool
"""

import os
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import fitz  # PyMuPDF
from PyQt6.QtCore import QThread, pyqtSignal

# Standard Page Sizes in points (72 points = 1 inch)
PAGE_SIZES = {
    "A4": (595.276, 841.89),       # 210 x 297 mm
    "A3": (841.89, 1190.55),      # 297 x 420 mm
    "Letter": (612.0, 792.0),      # 8.5 x 11 in
    "Legal": (612.0, 1008.0),      # 8.5 x 14 in
    "12x18": (864.0, 1296.0),      # 12 x 18 in
    "13x19": (936.0, 1368.0),      # 13 x 19 in
    "SRA3": (907.0, 1275.0),       # 320 x 450 mm
    "33x48": (935.0, 1360.0),      # 330 x 480 mm
}

SUPPORTED_DOC_EXTS = {".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".rtf", ".txt", ".odt", ".ods", ".odp"}
SUPPORTED_IMG_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp"}
SUPPORTED_PDF_EXTS = {".pdf"}

SLUG_COLOR_MAP = {
    "Muted Slate": (0.35, 0.38, 0.45),
    "Dark Charcoal": (0.12, 0.13, 0.16),
    "Pure White": (1.0, 1.0, 1.0),
    "Accent Blue": (0.36, 0.55, 0.98),
    "Black": (0.0, 0.0, 0.0)
}

class QuickPrintEngine:
    """Core backend engine for processing batch print jobs."""

    @staticmethod
    def is_libreoffice_available() -> bool:
        """Check if headless libreoffice or soffice is installed."""
        return (shutil.which("libreoffice") is not None) or (shutil.which("soffice") is not None)

    @staticmethod
    def format_file_size(size_bytes: int) -> str:
        """Formats bytes into human readable string (KB, MB)."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"

    @classmethod
    def inspect_file_metadata(cls, filepath: str) -> Dict[str, Any]:
        """Instantly inspect file metadata (format, size, page count) upon queue upload."""
        info = {
            "filepath": filepath,
            "filename": os.path.basename(filepath),
            "ext": Path(filepath).suffix.upper().replace(".", ""),
            "size_bytes": 0,
            "size_str": "0 KB",
            "page_count": 1,
            "status": "READY"
        }

        if not os.path.exists(filepath):
            info["status"] = "ERROR"
            return info

        try:
            sz = os.path.getsize(filepath)
            info["size_bytes"] = sz
            info["size_str"] = cls.format_file_size(sz)

            ext_lower = Path(filepath).suffix.lower()
            if ext_lower in SUPPORTED_PDF_EXTS:
                doc = fitz.open(filepath)
                info["page_count"] = len(doc)
                doc.close()
            elif ext_lower in SUPPORTED_IMG_EXTS:
                info["page_count"] = 1
            elif ext_lower in SUPPORTED_DOC_EXTS:
                # Fast estimate for office docs
                info["page_count"] = 1
        except Exception as e:
            print(f"[QuickPrintEngine] Error inspecting metadata for {filepath}: {e}")
            info["status"] = "ERROR"

        return info

    @staticmethod
    def convert_image_to_pdf(
        image_path: str,
        output_pdf: str,
        target_size: str = "A4",
        scale_mode: str = "fit",
        margin_pt: float = 0.0,
        custom_page_w: float = 0.0,
        custom_page_h: float = 0.0
    ) -> bool:
        """Convert an image file to a single-page PDF without artificial margins/borders."""
        try:
            img_doc = fitz.open(image_path)
            rect = img_doc[0].rect
            img_w, img_h = rect.width, rect.height
            img_doc.close()

            if custom_page_w > 0 and custom_page_h > 0:
                page_w, page_h = custom_page_w, custom_page_h
                margin = margin_pt
            elif target_size == "Native" or target_size not in PAGE_SIZES:
                page_w, page_h = img_w, img_h
                margin = 0.0
            else:
                page_w, page_h = PAGE_SIZES[target_size]
                margin = margin_pt

            doc = fitz.open()
            page = doc.new_page(width=page_w, height=page_h)

            avail_w = page_w - (2 * margin)
            avail_h = page_h - (2 * margin)

            if scale_mode == "fill":
                scale = max(avail_w / img_w, avail_h / img_h)
            elif scale_mode == "native":
                scale = 1.0
            else:  # 'fit'
                scale = min(avail_w / img_w, avail_h / img_h)

            dest_w = img_w * scale
            dest_h = img_h * scale

            x0 = margin + (avail_w - dest_w) / 2.0
            y0 = margin + (avail_h - dest_h) / 2.0
            x1 = x0 + dest_w
            y1 = y0 + dest_h

            target_rect = fitz.Rect(x0, y0, x1, y1)
            page.insert_image(target_rect, filename=image_path)
            doc.save(output_pdf)
            doc.close()
            return True
        except Exception as e:
            print(f"[QuickPrintEngine] Error converting image {image_path}: {e}")
            return False

    @staticmethod
    def convert_doc_to_pdf(doc_path: str, output_dir: str) -> Optional[str]:
        """Convert Office documents (DOCX, PPTX, XLSX, TXT) to PDF using LibreOffice headless."""
        lo_bin = shutil.which("libreoffice") or shutil.which("soffice")
        if not lo_bin:
            print("[QuickPrintEngine] LibreOffice not found on system path.")
            return None

        cmd = [
            lo_bin,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", output_dir,
            doc_path
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            doc_name = Path(doc_path).stem + ".pdf"
            expected_pdf = os.path.join(output_dir, doc_name)
            if os.path.exists(expected_pdf):
                return expected_pdf
        except Exception as e:
            print(f"[QuickPrintEngine] LibreOffice conversion failed for {doc_path}: {e}")
        return None

    @staticmethod
    def create_cover_sheet(
        output_pdf: str,
        file_index: int,
        total_files: int,
        file_name: str,
        customer_name: str = "Walk-in Customer",
        job_id: str = "QP-1001",
        page_size: str = "A4",
        custom_page_w: float = 0.0,
        custom_page_h: float = 0.0
    ) -> bool:
        """Generate a clean cover sheet / separator page for a document item."""
        try:
            if custom_page_w > 0 and custom_page_h > 0:
                page_w, page_h = custom_page_w, custom_page_h
            else:
                page_w, page_h = PAGE_SIZES.get(page_size, PAGE_SIZES["A4"])

            doc = fitz.open()
            page = doc.new_page(width=page_w, height=page_h)

            header_rect = fitz.Rect(0, 0, page_w, 90)
            page.draw_rect(header_rect, color=(0.1, 0.4, 0.8), fill=(0.1, 0.4, 0.8))

            page.insert_text(
                fitz.Point(36, 55),
                "BLUEWHALE QUICK PRINT - JOB SEPARATOR",
                fontsize=20,
                color=(1, 1, 1),
                fontname="hebo"
            )

            box_rect = fitz.Rect(36, 130, page_w - 36, 380)
            page.draw_rect(box_rect, color=(0.7, 0.7, 0.7), width=1.5, fill=(0.96, 0.97, 0.98))

            y = 170
            line_height = 32

            details = [
                f"JOB ID: {job_id}",
                f"CUSTOMER: {customer_name}",
                f"ITEM INDEX: File {file_index} of {total_files}",
                f"FILE NAME: {file_name}",
                f"PRINT TYPE: Duplex Ready Separator",
            ]

            for line in details:
                page.insert_text(fitz.Point(60, y), line, fontsize=14, color=(0.1, 0.1, 0.1), fontname="helv")
                y += line_height

            page.insert_text(
                fitz.Point(36, page_h - 50),
                "--- DO NOT REMOVE UNTIL ORDER IS COMPLETED ---",
                fontsize=11,
                color=(0.5, 0.5, 0.5),
                fontname="helv"
            )

            doc.save(output_pdf)
            doc.close()
            return True
        except Exception as e:
            print(f"[QuickPrintEngine] Error creating cover sheet: {e}")
            return False

    @classmethod
    def format_slug_text(
        cls,
        job_id: str,
        file_index: int,
        total_files: int,
        file_name: str,
        page_num: int,
        total_pages: int,
        show_job_id: bool = True,
        show_file_index: bool = True,
        show_file_name: bool = True,
        show_page_num: bool = True,
        custom_prefix: str = ""
    ) -> str:
        """Dynamically format tracking slug text based on selected elements."""
        parts = []
        if custom_prefix.strip():
            parts.append(custom_prefix.strip())
        if show_job_id and job_id:
            parts.append(f"[{job_id}]")
        if show_file_index:
            parts.append(f"File {file_index}/{total_files}")
        if show_file_name:
            parts.append(file_name)
        if show_page_num:
            parts.append(f"Pg {page_num} of {total_pages}")

        return " | ".join(parts)

    @classmethod
    def process_single_file(
        cls,
        input_path: str,
        temp_dir: str,
        file_index: int,
        total_files: int,
        duplex_mode: bool = True,
        add_cover_sheet: bool = True,
        add_page_slug: bool = True,
        customer_name: str = "Quick Print Customer",
        job_id: str = "QP-1001",
        target_page_size: str = "A4",
        scale_mode: str = "fit",
        slug_position: str = "Bottom-Right",
        slug_show_job_id: bool = True,
        slug_show_file_index: bool = True,
        slug_show_file_name: bool = True,
        slug_show_page_num: bool = True,
        slug_custom_prefix: str = "",
        slug_font_size: int = 8,
        slug_bold: bool = False,
        slug_color_name: str = "Muted Slate",
        custom_page_w: float = 0.0,
        custom_page_h: float = 0.0
    ) -> Dict[str, Any]:
        """Processes a single input file into standardized, padded PDF with tracking slugs."""
        result = {
            "input_path": input_path,
            "original_name": os.path.basename(input_path),
            "status": "error",
            "output_pdf": None,
            "original_pages": 0,
            "final_pages": 0,
            "padded_blank_pages": 0,
            "error_msg": None
        }

        ext = Path(input_path).suffix.lower()
        base_name = Path(input_path).stem
        working_pdf = os.path.join(temp_dir, f"raw_{file_index:03d}_{base_name}.pdf")

        if ext in SUPPORTED_PDF_EXTS:
            try:
                shutil.copy(input_path, working_pdf)
            except Exception as e:
                result["error_msg"] = f"Failed to copy PDF: {e}"
                return result
        elif ext in SUPPORTED_IMG_EXTS:
            if not cls.convert_image_to_pdf(input_path, working_pdf, target_page_size, scale_mode, custom_page_w=custom_page_w, custom_page_h=custom_page_h):
                result["error_msg"] = "Image conversion failed."
                return result
        elif ext in SUPPORTED_DOC_EXTS:
            doc_pdf = cls.convert_doc_to_pdf(input_path, temp_dir)
            if doc_pdf and os.path.exists(doc_pdf):
                shutil.move(doc_pdf, working_pdf)
            else:
                result["error_msg"] = "Office document conversion failed (LibreOffice required)."
                return result
        else:
            result["error_msg"] = f"Unsupported file extension: {ext}"
            return result

        try:
            doc = fitz.open(working_pdf)
            orig_page_count = len(doc)
            result["original_pages"] = orig_page_count

            final_doc = fitz.open()

            # Cover Sheet
            if add_cover_sheet:
                cover_pdf_path = os.path.join(temp_dir, f"cover_{file_index:03d}.pdf")
                if cls.create_cover_sheet(
                    cover_pdf_path, file_index, total_files, os.path.basename(input_path),
                    customer_name=customer_name, job_id=job_id, page_size=target_page_size,
                    custom_page_w=custom_page_w, custom_page_h=custom_page_h
                ):
                    cover_doc = fitz.open(cover_pdf_path)
                    final_doc.insert_pdf(cover_doc)
                    cover_doc.close()
                    if duplex_mode:
                        p_w = custom_page_w if custom_page_w > 0 else PAGE_SIZES.get(target_page_size, PAGE_SIZES["A4"])[0]
                        p_h = custom_page_h if custom_page_h > 0 else PAGE_SIZES.get(target_page_size, PAGE_SIZES["A4"])[1]
                        final_doc.new_page(width=p_w, height=p_h)

            font_name = "hebo" if slug_bold else "helv"
            rgb_color = SLUG_COLOR_MAP.get(slug_color_name, (0.35, 0.38, 0.45))

            for idx in range(orig_page_count):
                page = doc[idx]
                p_rect = page.rect

                if add_page_slug:
                    slug_text = cls.format_slug_text(
                        job_id=job_id,
                        file_index=file_index,
                        total_files=total_files,
                        file_name=os.path.basename(input_path),
                        page_num=idx + 1,
                        total_pages=orig_page_count,
                        show_job_id=slug_show_job_id,
                        show_file_index=slug_show_file_index,
                        show_file_name=slug_show_file_name,
                        show_page_num=slug_show_page_num,
                        custom_prefix=slug_custom_prefix
                    )

                    if "Top-Left" in slug_position:
                        point = fitz.Point(36, 22)
                    elif "Top-Center" in slug_position:
                        point = fitz.Point(max(36, (p_rect.width - 140) / 2.0), 22)
                    elif "Top-Right" in slug_position:
                        point = fitz.Point(max(36, p_rect.width - 280), 22)
                    elif "Bottom-Left" in slug_position:
                        point = fitz.Point(36, p_rect.height - 18)
                    elif "Bottom-Center" in slug_position:
                        point = fitz.Point(max(36, (p_rect.width - 140) / 2.0), p_rect.height - 18)
                    else:  # Bottom-Right (Default)
                        point = fitz.Point(max(36, p_rect.width - 290), p_rect.height - 18)

                    if slug_text:
                        page.insert_text(
                            point,
                            slug_text,
                            fontsize=slug_font_size,
                            color=rgb_color,
                            fontname=font_name
                        )

            final_doc.insert_pdf(doc)

            total_current_pages = len(final_doc)
            padded = 0
            if duplex_mode and (total_current_pages % 2 != 0):
                last_page = final_doc[-1]
                final_doc.new_page(width=last_page.rect.width, height=last_page.rect.height)
                padded = 1

            final_pdf_path = os.path.join(temp_dir, f"processed_{file_index:03d}_{base_name}.pdf")
            final_doc.save(final_pdf_path)

            result["status"] = "success"
            result["output_pdf"] = final_pdf_path
            result["final_pages"] = len(final_doc)
            result["padded_blank_pages"] = padded

            doc.close()
            final_doc.close()
        except Exception as e:
            result["error_msg"] = f"PDF processing error: {e}"

        return result

    @classmethod
    def merge_master_job(cls, processed_pdf_paths: List[str], master_output_path: str) -> bool:
        """Merge multiple processed PDFs into a single master press output PDF."""
        try:
            master_doc = fitz.open()
            for pdf_path in processed_pdf_paths:
                if pdf_path and os.path.exists(pdf_path):
                    sub_doc = fitz.open(pdf_path)
                    master_doc.insert_pdf(sub_doc)
                    sub_doc.close()
            master_doc.save(master_output_path)
            master_doc.close()
            return True
        except Exception as e:
            print(f"[QuickPrintEngine] Master PDF merge failed: {e}")
            return False


class QuickPrintWorker(QThread):
    """Asynchronous background worker thread for PyQt6 UI batch processing."""
    file_processed = pyqtSignal(int, dict)
    progress_changed = pyqtSignal(int, int)
    batch_completed = pyqtSignal(str, list)

    def __init__(
        self,
        files_list: List[str],
        output_dir: str,
        job_settings: Dict[str, Any],
        parent=None
    ):
        super().__init__(parent)
        self.files_list = files_list
        self.output_dir = output_dir
        self.job_settings = job_settings
        self._is_cancelled = False

    def cancel(self):
        self._is_cancelled = True

    def run(self):
        temp_dir = tempfile.mkdtemp(prefix="quickprint_")
        total = len(self.files_list)
        results = []
        processed_pdfs = []

        export_mode = self.job_settings.get("export_mode", "Both Master PDF & Separate Files")

        for idx, file_path in enumerate(self.files_list, start=1):
            if self._is_cancelled:
                break

            res = QuickPrintEngine.process_single_file(
                input_path=file_path,
                temp_dir=temp_dir,
                file_index=idx,
                total_files=total,
                duplex_mode=self.job_settings.get("duplex_mode", True),
                add_cover_sheet=self.job_settings.get("add_cover_sheet", True),
                add_page_slug=self.job_settings.get("add_page_slug", True),
                customer_name=self.job_settings.get("customer_name", "Walk-in Customer"),
                job_id=self.job_settings.get("job_id", "QP-1001"),
                target_page_size=self.job_settings.get("target_page_size", "A4"),
                scale_mode=self.job_settings.get("scale_mode", "fit"),
                slug_position=self.job_settings.get("slug_position", "Bottom-Right"),
                slug_show_job_id=self.job_settings.get("slug_show_job_id", True),
                slug_show_file_index=self.job_settings.get("slug_show_file_index", True),
                slug_show_file_name=self.job_settings.get("slug_show_file_name", True),
                slug_show_page_num=self.job_settings.get("slug_show_page_num", True),
                slug_custom_prefix=self.job_settings.get("slug_custom_prefix", ""),
                slug_font_size=self.job_settings.get("slug_font_size", 8),
                slug_bold=self.job_settings.get("slug_bold", False),
                slug_color_name=self.job_settings.get("slug_color_name", "Muted Slate"),
                custom_page_w=self.job_settings.get("custom_page_w", 0.0),
                custom_page_h=self.job_settings.get("custom_page_h", 0.0)
            )

            results.append(res)
            if res["status"] == "success" and res["output_pdf"]:
                processed_pdfs.append(res["output_pdf"])

                if "Separate Files" in export_mode or "Both" in export_mode:
                    out_name = f"{idx:03d}_{os.path.basename(file_path)}.pdf"
                    shutil.copy(res["output_pdf"], os.path.join(self.output_dir, out_name))

            self.file_processed.emit(idx, res)
            self.progress_changed.emit(idx, total)

        master_pdf_path = ""
        if "Master PDF" in export_mode or "Both" in export_mode:
            master_pdf_path = os.path.join(self.output_dir, f"Master_Press_Job_{self.job_settings.get('job_id', 'QP')}.pdf")
            if processed_pdfs:
                QuickPrintEngine.merge_master_job(processed_pdfs, master_pdf_path)

        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

        self.batch_completed.emit(master_pdf_path, results)
