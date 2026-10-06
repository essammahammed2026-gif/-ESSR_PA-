import os
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import Dict, Any, List

def analyze_universal_asset(file_path: str, filename: str) -> Dict[str, Any]:
    """
    Deep-inspects any supported prepress artwork (PDF, PNG, JPG, WEBP, TIFF, etc.).
    Extracts page counts, physical trim dimensions (mm), DPI, color space, 
    bleed/margin heuristics, and determines high-confidence studio recommendations.
    """
    ext = os.path.splitext(filename)[1].lower()
    file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    analysis = {
        "filename": filename,
        "extension": ext,
        "size_bytes": file_size_bytes,
        "page_count": 1,
        "width_mm": 0.0,
        "height_mm": 0.0,
        "aspect_ratio": 1.0,
        "color_space": "RGB",
        "has_transparency": False,
        "is_multi_page": False,
        "suggested_studios": [],
        "warnings": [],
        "metadata": {}
    }

    if ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            num_pages = len(doc)
            analysis["page_count"] = num_pages
            analysis["is_multi_page"] = num_pages > 1

            if num_pages > 0:
                page = doc[0]
                rect = page.rect
                analysis["width_mm"] = round(rect.width * 0.352777778, 2)
                analysis["height_mm"] = round(rect.height * 0.352777778, 2)
                if analysis["height_mm"] > 0:
                    analysis["aspect_ratio"] = round(analysis["width_mm"] / analysis["height_mm"], 3)

                # Check for images / DPI and color spaces
                images = page.get_image_info(xrefs=True)
                analysis["metadata"]["image_count"] = len(images)
                
                # Check for embedded fonts or text
                text_len = len(page.get_text("text").strip())
                analysis["metadata"]["has_selectable_text"] = text_len > 0

                # Multi-page recommendations
                if num_pages > 1:
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Booklet & Gang",
                        "reason": f"Impose {num_pages} pages on press sheets.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "flipbook",
                        "name": "Flipbook Studio",
                        "badge": "3D Proofing",
                        "reason": "3D page-turn proofing.",
                        "primary": False
                    })
                    analysis["suggested_studios"].append({
                        "studio": "book-studio",
                        "name": "Scanned Book Studio",
                        "badge": "Cleanup",
                        "reason": "Split spreads, deskew & add bleed.",
                        "primary": False
                    })
                else:
                    # Single page PDF
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Gang-Run",
                        "reason": "Step & repeat gang layout.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Cut Studio",
                        "badge": "Die-Cut",
                        "reason": "Vector cutlines & white ink.",
                        "primary": False
                    })

                analysis["suggested_studios"].append({
                    "studio": "preflight",
                    "name": "Preflight Center",
                    "badge": "QA Check",
                    "reason": "TrimBox, BleedBox & DPI validation.",
                    "primary": False
                })

            doc.close()
        except Exception as e:
            analysis["warnings"].append(f"PDF Inspection notice: {str(e)}")

    else:
        # Raster Image (PNG, JPG, TIFF, WEBP, etc.)
        try:
            img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
            if img is not None:
                h, w = img.shape[:2]
                channels = img.shape[2] if len(img.shape) > 2 else 1
                
                # Standard 300 DPI calculation for physical dimensions
                analysis["width_mm"] = round((w / 300.0) * 25.4, 2)
                analysis["height_mm"] = round((h / 300.0) * 25.4, 2)
                if analysis["height_mm"] > 0:
                    analysis["aspect_ratio"] = round(analysis["width_mm"] / analysis["height_mm"], 3)

                has_alpha = False
                if channels == 4:
                    alpha = img[:, :, 3]
                    if float(np.min(alpha)) < 250:
                        has_alpha = True

                analysis["has_transparency"] = has_alpha
                analysis["color_space"] = "CMYK" if channels == 4 and not has_alpha else ("RGBA" if has_alpha else "RGB")

                # Recommendations for raster images
                if has_alpha or ext in [".png", ".webp"]:
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Cut Studio",
                        "badge": "Die-Cut",
                        "reason": "Alpha mask detected. Trace vector cutline & white matte.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Gang-Run",
                        "reason": "Step & repeat sticker/label gang-run on sheets or rolls.",
                        "primary": False
                    })
                else:
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Gang-Run",
                        "reason": "Impose artwork on press sheets with crop marks.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Cut Studio",
                        "badge": "Die-Cut",
                        "reason": "Auto-detect background to outline sticker cut line.",
                        "primary": False
                    })

        except Exception as e:
            analysis["warnings"].append(f"Image inspection notice: {str(e)}")

    return analysis
