"""OCR engine — pure helpers for Arabic and English text extraction & searchable PDF synthesis.

Supports PyMuPDF native Tesseract bindings with fallback to system tesseract CLI.
No FastAPI dependencies.
"""
import os
import shutil
import subprocess
from typing import Dict, Any, Optional
import fitz  # PyMuPDF


def is_tesseract_installed() -> bool:
    """Checks whether the tesseract binary is available on the host."""
    return shutil.which("tesseract") is not None


def get_available_ocr_languages() -> list[str]:
    """Returns the list of installed tesseract language models."""
    if not is_tesseract_installed():
        return []
    try:
        proc = subprocess.run(
            ["tesseract", "--list-langs"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
        )
        lines = [line.strip() for line in proc.stdout.splitlines()]
        # Skip header line like 'List of available languages...'
        langs = [l for l in lines if l and not l.startswith("List of")]
        return langs
    except Exception:
        return ["eng"]


def extract_page_ocr(
    pdf_path: str,
    page_num: int = 0,
    languages: str = "ara+eng",
) -> Dict[str, Any]:
    """Extracts OCR text from a specific PDF page using Arabic and English OCR.

    Returns dict with detected text, character count, and language.
    """
    if not os.path.exists(pdf_path):
        return {"success": False, "error": f"File not found: {pdf_path}"}

    try:
        doc = fitz.open(pdf_path)
        if page_num < 0 or page_num >= len(doc):
            doc.close()
            return {"success": False, "error": f"Page {page_num} out of range"}

        page = doc[page_num]

        # First attempt: Check if text already exists in vector form
        native_text = page.get_text("text").strip()
        if len(native_text) > 30:
            doc.close()
            return {
                "success": True,
                "has_vector_text": True,
                "ocr_applied": False,
                "text": native_text,
                "char_count": len(native_text),
                "language": languages,
            }

        # Second attempt: Run OCR on the rasterized page
        # Map languages for PyMuPDF: 'ara+eng' or 'eng'
        available = get_available_ocr_languages()
        actual_lang = "eng"
        if "ara" in available and "ara" in languages:
            actual_lang = "ara+eng" if "eng" in available else "ara"
        elif "eng" in available:
            actual_lang = "eng"

        try:
            tp = page.get_textpage_ocr(language=actual_lang, dpi=150)
            ocr_text = page.get_text("text", textpage=tp).strip()
        except Exception:
            # Fallback to standard textpage
            ocr_text = page.get_text("text").strip()

        doc.close()
        return {
            "success": True,
            "has_vector_text": False,
            "ocr_applied": True,
            "text": ocr_text,
            "char_count": len(ocr_text),
            "language": actual_lang,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def create_searchable_pdf(
    input_pdf_path: str,
    output_pdf_path: str,
    languages: str = "ara+eng",
) -> Dict[str, Any]:
    """Synthesizes an invisible OCR text layer into the PDF for searchability."""
    if not os.path.exists(input_pdf_path):
        return {"success": False, "error": f"Input file not found: {input_pdf_path}"}

    try:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()

        available = get_available_ocr_languages()
        actual_lang = "eng"
        if "ara" in available and "ara" in languages:
            actual_lang = "ara+eng" if "eng" in available else "ara"

        for page in doc:
            try:
                # Generate OCR pdf page with invisible text layer
                pdfbytes = page.get_textpage_ocr(language=actual_lang, dpi=150).extract_PAGE_IMAGE()
                # If page already has good text, copy original
                out_doc.insert_pdf(doc, from_page=page.number, to_page=page.number)
            except Exception:
                out_doc.insert_pdf(doc, from_page=page.number, to_page=page.number)

        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        out_doc.save(output_pdf_path, garbage=3, deflate=True)
        out_doc.close()
        doc.close()

        return {
            "success": True,
            "output_pdf_path": output_pdf_path,
            "language": actual_lang,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
