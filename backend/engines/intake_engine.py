import os
import fitz
from typing import Any, Dict, List, Optional, Set
from engines.units import PTS_TO_MM


class IntakeEngine:
    """
    Pure engine for universal file intake, geometry probing, and multi-file collation.
    Decoupled from HTTP routers; operates strictly on filesystem paths and PyMuPDF documents.
    """

    @staticmethod
    def probe_file_meta(file_path: str) -> Dict[str, Any]:
        """Probes basic geometry, page count, and dimensions in millimeters for a PDF or image."""
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = os.path.getsize(file_path)
        ext = os.path.splitext(file_path)[1].lower()
        meta: Dict[str, Any] = {
            "file_path": file_path,
            "filename": os.path.basename(file_path),
            "file_size": file_size,
            "extension": ext,
            "page_count": 1,
            "width_mm": 210.0,
            "height_mm": 297.0,
        }

        try:
            if ext == ".pdf":
                doc = fitz.open(file_path)
                meta["page_count"] = len(doc)
                if len(doc) > 0:
                    first_page = doc[0]
                    meta["width_mm"] = round(first_page.rect.width * PTS_TO_MM, 1)
                    meta["height_mm"] = round(first_page.rect.height * PTS_TO_MM, 1)
                doc.close()
            else:
                img_doc = fitz.open(file_path)
                meta["page_count"] = 1
                if len(img_doc) > 0:
                    first_page = img_doc[0]
                    meta["width_mm"] = round(first_page.rect.width * PTS_TO_MM, 1)
                    meta["height_mm"] = round(first_page.rect.height * PTS_TO_MM, 1)
                img_doc.close()
        except Exception:
            # Fallback defaults if document probing encounters malformed headers
            pass

        return meta

    @staticmethod
    def combine_sequential(
        file_paths: List[str],
        output_pdf_path: str,
        reverse_indices: Optional[Set[int]] = None,
    ) -> bool:
        """
        Combines multiple files (PDFs, images: PNG, JPG, TIFF, WEBP, etc.) sequentially
        into a single unified PDF, applying page-reversal to any file whose index is in reverse_indices.
        """
        doc = fitz.open()
        rev_set = reverse_indices or set()
        os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

        try:
            for idx, fpath in enumerate(file_paths):
                if not os.path.exists(fpath):
                    continue
                should_reverse = idx in rev_set
                ext = os.path.splitext(fpath)[1].lower()

                if ext == ".pdf":
                    sub_doc = fitz.open(fpath)
                    if should_reverse:
                        for p_idx in range(len(sub_doc) - 1, -1, -1):
                            doc.insert_pdf(sub_doc, from_page=p_idx, to_page=p_idx)
                    else:
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
            print(f"IntakeEngine: error combining sequential files: {e}")
            return False
        finally:
            doc.close()

    @staticmethod
    def combine_duplex_scans(
        odds_path: str,
        evens_path: str,
        output_pdf_path: str,
        odds_order: str = "forward",
        evens_order: str = "reverse",
        start_with: str = "odds",
    ) -> bool:
        """
        Interleaves two scan files (Odds and Evens) into a single ordered book PDF.
        Supports reversing the evens stack (crucial for ADF duplex scans scanned in reverse).
        """
        if not os.path.isfile(odds_path) or not os.path.isfile(evens_path):
            return False

        os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)
        out_doc = fitz.open()
        odds_doc = fitz.open(odds_path)
        evens_doc = fitz.open(evens_path)

        try:
            odds_indices = list(range(len(odds_doc)))
            evens_indices = list(range(len(evens_doc)))

            if odds_order == "reverse":
                odds_indices.reverse()
            if evens_order == "reverse":
                evens_indices.reverse()

            max_len = max(len(odds_indices), len(evens_indices))
            for i in range(max_len):
                if start_with == "odds":
                    if i < len(odds_indices):
                        p = odds_indices[i]
                        out_doc.insert_pdf(odds_doc, from_page=p, to_page=p)
                    if i < len(evens_indices):
                        p = evens_indices[i]
                        out_doc.insert_pdf(evens_doc, from_page=p, to_page=p)
                else:
                    if i < len(evens_indices):
                        p = evens_indices[i]
                        out_doc.insert_pdf(evens_doc, from_page=p, to_page=p)
                    if i < len(odds_indices):
                        p = odds_indices[i]
                        out_doc.insert_pdf(odds_doc, from_page=p, to_page=p)

            out_doc.save(output_pdf_path)
            return True
        except Exception as e:
            print(f"IntakeEngine: error combining duplex scans: {e}")
            return False
        finally:
            odds_doc.close()
            evens_doc.close()
            out_doc.close()
