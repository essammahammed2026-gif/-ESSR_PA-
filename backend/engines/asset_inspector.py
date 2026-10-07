import os
import fitz  # PyMuPDF
import cv2
import numpy as np
from typing import Dict, Any, List

def format_page_ranges(pages: List[int]) -> str:
    """Formats a sorted list of 1-based page numbers into compact ranges: e.g. [1,2,3,5,7,8] -> '1–3, 5, 7–8'"""
    if not pages:
        return ""
    sorted_pages = sorted(list(set(pages)))
    ranges = []
    start = sorted_pages[0]
    prev = start
    for p in sorted_pages[1:]:
        if p == prev + 1:
            prev = p
        else:
            if start == prev:
                ranges.append(str(start))
            else:
                ranges.append(f"{start}–{prev}")
            start = p
            prev = p
    if start == prev:
        ranges.append(str(start))
    else:
        ranges.append(f"{start}–{prev}")
    return ", ".join(ranges)

def match_standard_paper_name(w_mm: float, h_mm: float) -> str:
    """Matches width and height against international standard sheet sizes."""
    short_edge, long_edge = sorted([round(w_mm, 1), round(h_mm, 1)])
    standards = [
        (210.0, 297.0, "A4"),
        (297.0, 420.0, "A3"),
        (320.0, 450.0, "SRA3"),
        (330.0, 480.0, "33×48 cm"),
        (148.0, 210.0, "A5"),
        (105.0, 148.0, "A6"),
        (420.0, 594.0, "A2"),
        (500.0, 700.0, "B2"),
        (215.9, 279.4, "US Letter"),
        (215.9, 355.6, "US Legal"),
        (279.4, 431.8, "US Tabloid"),
    ]
    for sw, lw, name in standards:
        if abs(short_edge - sw) <= 2.5 and abs(long_edge - lw) <= 2.5:
            return name
    return f"{round(w_mm, 1)} × {round(h_mm, 1)} mm"

def analyze_universal_asset(file_path: str, filename: str) -> Dict[str, Any]:
    """
    Deep-inspects any supported prepress artwork (PDF, PNG, JPG, WEBP, TIFF, etc.).
    Extracts page counts, physical trim dimensions (mm), DPI, color space, 
    bleed/margin heuristics, generates a granular quality audit report,
    and determines high-confidence studio recommendations.
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
        "metadata": {},
        "pages": [],
        "report": {
            "overall_status": "pass",
            "summary": {},
            "checks": {
                "geometry": {
                    "status": "pass",
                    "is_uniform": True,
                    "page_groups": [],
                    "details": ""
                },
                "dpi": {
                    "status": "pass",
                    "total_images": 0,
                    "low_dpi_count": 0,
                    "low_dpi_pages": [],
                    "low_dpi_images": [],
                    "details": ""
                },
                "bleed": {
                    "status": "pass",
                    "has_bleed": False,
                    "bleed_mm": 0.0,
                    "pages_missing_bleed": [],
                    "details": ""
                },
                "colorspace": {
                    "status": "pass",
                    "primary": "CMYK",
                    "has_rgb": False,
                    "rgb_pages": [],
                    "spot_colors": [],
                    "details": ""
                }
            }
        }
    }

    if ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            num_pages = len(doc)
            analysis["page_count"] = num_pages
            analysis["is_multi_page"] = num_pages > 1

            if num_pages > 0:
                page0 = doc[0]
                rect0 = page0.rect
                analysis["width_mm"] = round(rect0.width * 0.352777778, 2)
                analysis["height_mm"] = round(rect0.height * 0.352777778, 2)
                if analysis["height_mm"] > 0:
                    analysis["aspect_ratio"] = round(analysis["width_mm"] / analysis["height_mm"], 3)

                pages_list = []
                size_map: Dict[tuple, List[int]] = {}  # (w_mm, h_mm) -> list of 1-based page numbers
                low_dpi_images = []
                total_images_count = 0
                rgb_pages_set = set()
                spot_colors_set = set()
                pages_lacking_bleed = []
                bleed_margins = []

                for p_idx in range(num_pages):
                    page = doc[p_idx]
                    page_num = p_idx + 1
                    p_rect = page.rect
                    pw = round(p_rect.width * 0.352777778, 1)
                    ph = round(p_rect.height * 0.352777778, 1)

                    pages_list.append({
                        "page_num": p_idx,
                        "width_mm": pw,
                        "height_mm": ph,
                        "aspect_ratio": round(pw / ph, 3) if ph > 0 else 1.0
                    })

                    # Group sizes (tolerating minor 0.5mm precision variance)
                    matched_size = None
                    for key in size_map.keys():
                        if abs(key[0] - pw) <= 0.6 and abs(key[1] - ph) <= 0.6:
                            matched_size = key
                            break
                    if matched_size:
                        size_map[matched_size].append(page_num)
                    else:
                        size_map[(pw, ph)] = [page_num]

                    # 1. Bleed detection (TrimBox vs BleedBox / MediaBox)
                    trim = page.trimbox
                    bleed = page.bleedbox
                    page_has_bleed = False
                    if trim.is_valid and bleed.is_valid and (bleed.width > trim.width + 1 or bleed.height > trim.height + 1):
                        dw = (bleed.width - trim.width) * 0.352777778
                        dh = (bleed.height - trim.height) * 0.352777778
                        margin_val = round(min(dw, dh) / 2.0, 1)
                        if margin_val >= 1.0:
                            page_has_bleed = True
                            bleed_margins.append(margin_val)
                    if not page_has_bleed:
                        pages_lacking_bleed.append(page_num)

                    # 2. Image DPI and color detection
                    images = page.get_image_info(xrefs=True)
                    total_images_count += len(images)
                    for img in images:
                        cs = img.get("colorspace")
                        if cs in ["DeviceRGB", "RGB", 3]:
                            rgb_pages_set.add(page_num)
                        elif cs in ["Separation", "DeviceN"]:
                            spot_colors_set.add(str(cs))

                        bbox = img.get("bbox")
                        src_w = img.get("width")
                        src_h = img.get("height")
                        if bbox and src_w and src_h:
                            x0, y0, x1, y1 = bbox
                            w_pt = max(1.0, x1 - x0)
                            h_pt = max(1.0, y1 - y0)
                            dpi_x = (src_w * 72.0) / w_pt
                            dpi_y = (src_h * 72.0) / h_pt
                            avg_dpi = int(min(dpi_x, dpi_y))
                            if avg_dpi < 280:
                                low_dpi_images.append({
                                    "page": page_num,
                                    "dpi": avg_dpi,
                                    "dimensions": f"{src_w} × {src_h} px",
                                    "status": f"Low resolution ({avg_dpi} DPI)"
                                })

                analysis["pages"] = pages_list
                analysis["metadata"]["image_count"] = total_images_count
                text_len = len(page0.get_text("text").strip())
                analysis["metadata"]["has_selectable_text"] = text_len > 0

                # Determine Geometry Report
                is_uniform = len(size_map) <= 1
                page_groups = []
                for (gw, gh), p_list in size_map.items():
                    std_name = match_standard_paper_name(gw, gh)
                    page_groups.append({
                        "pages": format_page_ranges(p_list),
                        "dimensions": f"{gw} × {gh} mm",
                        "standard_name": std_name,
                        "count": len(p_list)
                    })

                geom_status = "pass" if is_uniform else "warning"
                geom_details = (
                    f"All {num_pages} pages share uniform dimensions ({page_groups[0]['dimensions']} — {page_groups[0]['standard_name']})."
                    if is_uniform and page_groups
                    else f"Varying page dimensions detected across {len(page_groups)} size groups."
                )

                # Determine DPI Report
                dpi_pages = sorted(list(set(item["page"] for item in low_dpi_images)))
                dpi_status = "warning" if low_dpi_images else "pass"
                dpi_details = (
                    f"{len(low_dpi_images)} low-resolution image(s) (<300 DPI) found on page(s) {format_page_ranges(dpi_pages)}."
                    if low_dpi_images
                    else (f"All {total_images_count} embedded image(s) meet commercial print resolution (300+ DPI)." if total_images_count > 0 else "Vector document with 0 raster images.")
                )

                # Determine Bleed Report
                has_bleed = len(pages_lacking_bleed) == 0 and len(bleed_margins) > 0
                avg_bleed = round(sum(bleed_margins) / len(bleed_margins), 1) if bleed_margins else 0.0
                bleed_status = "pass" if has_bleed else "warning"
                bleed_details = (
                    f"TrimBox & BleedBox defined with {avg_bleed} mm bleed margin."
                    if has_bleed
                    else (
                        f"Zero bleed margins defined on page(s) {format_page_ranges(pages_lacking_bleed)}. 3 mm bleed allowance recommended for trimming."
                        if len(pages_lacking_bleed) < num_pages
                        else "No bleed margins detected (TrimBox equals BleedBox). 3 mm bleed allowance recommended for safe finishing."
                    )
                )

                # Determine Color Space Report
                rgb_pages = sorted(list(rgb_pages_set))
                has_rgb = len(rgb_pages) > 0
                color_status = "warning" if has_rgb else "pass"
                primary_color = "RGB" if has_rgb else "CMYK"
                analysis["color_space"] = primary_color
                color_details = (
                    f"RGB color elements detected on page(s) {format_page_ranges(rgb_pages)}. Commercial presses require CMYK color separation."
                    if has_rgb
                    else "CMYK / Grayscale compatible color profile across all pages."
                )

                # Assemble Full Report
                has_warnings = (geom_status == "warning" or dpi_status == "warning" or bleed_status == "warning" or color_status == "warning")
                analysis["report"] = {
                    "overall_status": "warning" if has_warnings else "pass",
                    "summary": {
                        "page_count": num_pages,
                        "primary_size": f"{analysis['width_mm']} × {analysis['height_mm']} mm ({match_standard_paper_name(analysis['width_mm'], analysis['height_mm'])})",
                        "color_profile": primary_color,
                        "total_images": total_images_count,
                        "low_dpi_count": len(low_dpi_images),
                        "has_bleed": has_bleed,
                        "bleed_mm": avg_bleed
                    },
                    "checks": {
                        "geometry": {
                            "status": geom_status,
                            "is_uniform": is_uniform,
                            "page_groups": page_groups,
                            "details": geom_details
                        },
                        "dpi": {
                            "status": dpi_status,
                            "total_images": total_images_count,
                            "low_dpi_count": len(low_dpi_images),
                            "low_dpi_pages": dpi_pages,
                            "low_dpi_images": low_dpi_images[:25],  # top 25 for report
                            "details": dpi_details
                        },
                        "bleed": {
                            "status": bleed_status,
                            "has_bleed": has_bleed,
                            "bleed_mm": avg_bleed,
                            "pages_missing_bleed": pages_lacking_bleed,
                            "details": bleed_details
                        },
                        "colorspace": {
                            "status": color_status,
                            "primary": primary_color,
                            "has_rgb": has_rgb,
                            "rgb_pages": rgb_pages,
                            "spot_colors": sorted(list(spot_colors_set)),
                            "details": color_details
                        }
                    }
                }

                # Studio recommendations
                if num_pages > 1:
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Publication",
                        "reason": f"Impose {num_pages} pages onto press sheets.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "book-studio",
                        "name": "Book Studio",
                        "badge": "Synthesis",
                        "reason": "Split spreads, deskew & synthesize 3mm bleed.",
                        "primary": False
                    })
                    analysis["suggested_studios"].append({
                        "studio": "flipbook",
                        "name": "Flipbook Studio",
                        "badge": "Proofing",
                        "reason": "3D interactive page-turn proofing.",
                        "primary": False
                    })
                else:
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Step & Repeat",
                        "reason": "Step & repeat gang layout on press sheets.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Studio",
                        "badge": "Die-Cut",
                        "reason": "Vector cutlines & white ink underbase.",
                        "primary": False
                    })

                analysis["suggested_studios"].append({
                    "studio": "preflight",
                    "name": "Preflight Studio",
                    "badge": "Detailed QA",
                    "reason": "Deep PDF box & DPI inspection.",
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
                w_mm = round((w / 300.0) * 25.4, 2)
                h_mm = round((h / 300.0) * 25.4, 2)
                analysis["width_mm"] = w_mm
                analysis["height_mm"] = h_mm
                if h_mm > 0:
                    analysis["aspect_ratio"] = round(w_mm / h_mm, 3)

                has_alpha = False
                if channels == 4:
                    alpha = img[:, :, 3]
                    if float(np.min(alpha)) < 250:
                        has_alpha = True

                analysis["has_transparency"] = has_alpha
                color_profile = "CMYK" if channels == 4 and not has_alpha else ("RGBA" if has_alpha else "RGB")
                analysis["color_space"] = color_profile

                std_name = match_standard_paper_name(w_mm, h_mm)
                is_low_res = (w < 1200 or h < 1200)

                analysis["report"] = {
                    "overall_status": "warning" if (is_low_res or color_profile in ["RGB", "RGBA"]) else "pass",
                    "summary": {
                        "page_count": 1,
                        "primary_size": f"{w_mm} × {h_mm} mm ({std_name})",
                        "color_profile": color_profile,
                        "total_images": 1,
                        "low_dpi_count": 1 if is_low_res else 0,
                        "has_bleed": False,
                        "bleed_mm": 0.0
                    },
                    "checks": {
                        "geometry": {
                            "status": "pass",
                            "is_uniform": True,
                            "page_groups": [{
                                "pages": "1",
                                "dimensions": f"{w_mm} × {h_mm} mm",
                                "standard_name": std_name,
                                "count": 1
                            }],
                            "details": f"Single raster image ({w} × {h} px) corresponding to {w_mm} × {h_mm} mm at 300 DPI."
                        },
                        "dpi": {
                            "status": "warning" if is_low_res else "pass",
                            "total_images": 1,
                            "low_dpi_count": 1 if is_low_res else 0,
                            "low_dpi_pages": [1] if is_low_res else [],
                            "low_dpi_images": [{
                                "page": 1,
                                "dpi": int(min(w, h) / (max(w_mm, h_mm) / 25.4)),
                                "dimensions": f"{w} × {h} px",
                                "status": "Low resolution"
                            }] if is_low_res else [],
                            "details": f"Raster asset resolution: {w} × {h} px. " + ("Low resolution for large prints (<1200 px)." if is_low_res else "High resolution (300 DPI equivalent).")
                        },
                        "bleed": {
                            "status": "warning",
                            "has_bleed": False,
                            "bleed_mm": 0.0,
                            "pages_missing_bleed": [1],
                            "details": "Single raster image has zero outer bleed margin. Pad edges in Imposing or Contour Studio."
                        },
                        "colorspace": {
                            "status": "warning" if color_profile in ["RGB", "RGBA"] else "pass",
                            "primary": color_profile,
                            "has_rgb": color_profile in ["RGB", "RGBA"],
                            "rgb_pages": [1] if color_profile in ["RGB", "RGBA"] else [],
                            "spot_colors": [],
                            "details": f"{color_profile} color profile. " + ("Convert to CMYK for offset/digital press production." if color_profile in ["RGB", "RGBA"] else "CMYK print compatible.")
                        }
                    }
                }

                # Recommendations for raster images
                if has_alpha or ext in [".png", ".webp"]:
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Studio",
                        "badge": "Die-Cut",
                        "reason": "Alpha mask detected. Trace vector cutlines & white matte.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Sticker Gang",
                        "reason": "Step & repeat sticker/label gang layout.",
                        "primary": False
                    })
                else:
                    analysis["suggested_studios"].append({
                        "studio": "imposing",
                        "name": "Imposing Studio",
                        "badge": "Gang-Run",
                        "reason": "Step & repeat gang run on press sheets.",
                        "primary": True
                    })
                    analysis["suggested_studios"].append({
                        "studio": "contour",
                        "name": "Contour Studio",
                        "badge": "Die-Cut",
                        "reason": "Auto-trace contour cutlines & white ink base.",
                        "primary": False
                    })

        except Exception as e:
            analysis["warnings"].append(f"Image inspection notice: {str(e)}")

    return analysis
