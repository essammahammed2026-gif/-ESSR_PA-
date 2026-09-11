"""
Prepress File Diagnostic Analyzer Module for BlueWhale Printing Assistant.
Analyzes PDF, PNG, JPG/JPEG files for prepress readiness:
- Resolution / DPI
- Bleed Detection (0.0mm warning)
- Color Space (CMYK vs RGB)
- Transparency / Alpha Channels (Contour cut readiness)
- Dimensions & Aspect Ratio
- Blur / Image Sharpness assessment
"""

import os
import cv2
import numpy as np
import fitz  # PyMuPDF
from engines.color_engine import ColorEngine


class PrepressFileAnalyzer:
    """Core diagnostic engine for analyzing print files."""

    @staticmethod
    def analyze_file(filepath: str) -> dict:
        """Analyzes a single PDF, PNG, JPG, or JPEG file."""
        if not os.path.exists(filepath):
            return {
                "filepath": filepath,
                "filename": os.path.basename(filepath),
                "ext": "",
                "status": "ERROR",
                "issues": ["File does not exist on disk."],
                "warnings": [],
                "info": {}
            }

        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".pdf":
            return PrepressFileAnalyzer._analyze_pdf(filepath)
        elif ext in [".png", ".jpg", ".jpeg"]:
            return PrepressFileAnalyzer._analyze_image(filepath)
        else:
            return {
                "filepath": filepath,
                "filename": os.path.basename(filepath),
                "ext": ext,
                "status": "ERROR",
                "issues": [f"Unsupported file format '{ext}'. Only PDF, PNG, JPG, JPEG are supported."],
                "warnings": [],
                "info": {}
            }

    @staticmethod
    def analyze_batch(filepaths: list) -> dict:
        """Analyzes a batch of files and produces a consolidated report."""
        results = [PrepressFileAnalyzer.analyze_file(fp) for fp in filepaths]
        
        total_files = len(results)
        errors = sum(1 for r in results if r["status"] == "ERROR")
        warnings = sum(1 for r in results if r["status"] == "WARNING")
        passes = sum(1 for r in results if r["status"] == "PASS")

        if errors > 0:
            overall_status = "CRITICAL"
        elif warnings > 0:
            overall_status = "WARNING"
        else:
            overall_status = "PASS"

        # Calculate average metrics for dashboard gauges
        dpi_values = [r["info"].get("dpi", 150) for r in results if "dpi" in r["info"]]
        avg_dpi = int(sum(dpi_values) / len(dpi_values)) if dpi_values else 300
        
        def _extract_txt(item):
            return item["text"].lower() if isinstance(item, dict) else str(item).lower()

        has_bleed_issue = any("bleed" in _extract_txt(w) for r in results for w in r.get("warnings", []) + r.get("issues", []))
        has_rgb_issue = any("rgb" in _extract_txt(w) for r in results for w in r.get("warnings", []) + r.get("issues", []))
        has_text_edge_issue = any("text edge" in _extract_txt(w) or "text elements" in _extract_txt(w) for r in results for w in r.get("warnings", []) + r.get("issues", []))
        has_artwork_edge_issue = any("artwork edge" in _extract_txt(w) or "graphic elements" in _extract_txt(w) for r in results for w in r.get("warnings", []) + r.get("issues", []))
        has_font_issue = any("unembedded font" in _extract_txt(w) or "font" in _extract_txt(w) for r in results for w in r.get("warnings", []) + r.get("issues", []))

        return {
            "overall_status": overall_status,
            "total_files": total_files,
            "passes": passes,
            "warnings": warnings,
            "errors": errors,
            "avg_dpi": avg_dpi,
            "has_bleed_issue": has_bleed_issue,
            "has_rgb_issue": has_rgb_issue,
            "has_text_edge_issue": has_text_edge_issue,
            "has_artwork_edge_issue": has_artwork_edge_issue,
            "has_font_issue": has_font_issue,
            "file_reports": results
        }

    @staticmethod
    def _analyze_pdf(filepath: str) -> dict:
        filename = os.path.basename(filepath)
        file_size_mb = os.path.getsize(filepath) / (1024 * 1024)
        issues = []
        warnings = []
        info = {
            "type": "PDF Document",
            "file_size_mb": round(file_size_mb, 2)
        }

        try:
            with fitz.open(filepath) as doc:
                page_count = len(doc)
                info["page_count"] = page_count

                if page_count == 0:
                    issues.append("PDF document contains 0 pages.")
                    return {
                        "filepath": filepath, "filename": filename, "ext": ".pdf",
                        "status": "ERROR", "issues": issues, "warnings": warnings, "info": info
                    }

                first_page = doc[0]
                rect = first_page.rect
                width_mm = rect.width * 25.4 / 72.0
                height_mm = rect.height * 25.4 / 72.0
                info["width_mm"] = round(width_mm, 1)
                info["height_mm"] = round(height_mm, 1)

                # Bleed Box Analysis across pages
                pages_without_bleed = []
                for p_idx in range(page_count):
                    p = doc[p_idx]
                    cbox = p.cropbox
                    mbox = p.mediabox
                    if not ((mbox.width > cbox.width + 2) and (mbox.height > cbox.height + 2)):
                        pages_without_bleed.append(p_idx + 1)

                has_explicit_bleed = (len(pages_without_bleed) == 0)

                if not has_explicit_bleed:
                    page_str = f" (Pages: {', '.join(map(str, pages_without_bleed[:10]))}{'...' if len(pages_without_bleed) > 10 else ''})" if page_count > 1 else ""
                    warnings.append({
                        "text": f"0.0mm Bleed Warning — PDF has no outer bleed margin. Risk of white paper edge on guillotine cut.{page_str}",
                        "action": "Bleed",
                        "action_label": "Fix Bleed 🪄",
                        "pages": pages_without_bleed,
                        "details": [f"Page {p}: CropBox matches MediaBox (0.0mm outer margin)." for p in pages_without_bleed]
                    })
                    info["bleed_status"] = "0.0mm (Needs Bleed Fix)"
                    info["bleed_mm"] = 0.0
                else:
                    cropbox = first_page.cropbox
                    mediabox = first_page.mediabox
                    bleed_w = (mediabox.width - cropbox.width) * 25.4 / 72.0 / 2.0
                    info["bleed_status"] = f"{round(bleed_w, 1)}mm Bleed OK"
                    info["bleed_mm"] = round(bleed_w, 1)

                # Image Resolution & Colorspace Check
                dpi_list = []
                low_res_pages = set()
                low_res_details = []
                med_res_pages = set()
                med_res_details = []
                
                rgb_images_found = 0
                cmyk_images_found = 0
                rgb_pages = set()

                for page_num in range(min(10, page_count)):
                    page = doc[page_num]
                    img_list = page.get_images()
                    page_dpi_list = []
                    
                    for img_info in img_list:
                        xref = img_info[0]
                        base_img = doc.extract_image(xref)
                        if base_img:
                            w = base_img.get("width", 0)
                            h = base_img.get("height", 0)
                            cs_val = base_img.get("colorspace", 0)
                            if isinstance(cs_val, int):
                                cs = "DeviceRGB" if cs_val == 3 else ("DeviceCMYK" if cs_val == 4 else ("DeviceGray" if cs_val == 1 else str(cs_val)))
                            else:
                                cs = str(cs_val).upper()

                            if "RGB" in cs:
                                rgb_images_found += 1
                                rgb_pages.add(page_num + 1)
                            elif "CMYK" in cs:
                                cmyk_images_found += 1

                            # Estimate DPI relative to page size
                            if rect.width > 0 and w > 0:
                                dpi_x = (w / rect.width) * 72.0
                                dpi_list.append(dpi_x)
                                page_dpi_list.append(dpi_x)
                                
                    if page_dpi_list:
                        page_avg = sum(page_dpi_list) / len(page_dpi_list)
                        if page_avg < 150:
                            low_res_pages.add(page_num + 1)
                            low_res_details.append(f"Page {page_num + 1}: Low resolution detected ({int(page_avg)} DPI).")
                        elif page_avg < 280:
                            med_res_pages.add(page_num + 1)
                            med_res_details.append(f"Page {page_num + 1}: Medium resolution detected ({int(page_avg)} DPI).")

                avg_dpi = int(sum(dpi_list) / len(dpi_list)) if dpi_list else 300
                info["dpi"] = avg_dpi

                if low_res_pages:
                    issues.append({
                        "text": f"Low Resolution ({avg_dpi} DPI Avg) — Risk of pixelated blur on press printing.",
                        "action": None,
                        "action_label": None,
                        "pages": sorted(list(low_res_pages)),
                        "details": low_res_details
                    })
                elif med_res_pages:
                    warnings.append({
                        "text": f"Medium Resolution ({avg_dpi} DPI Avg) — Acceptable for digital, below 300 DPI offset standard.",
                        "action": None,
                        "action_label": None,
                        "pages": sorted(list(med_res_pages)),
                        "details": med_res_details
                    })
                else:
                    info["dpi_status"] = f"High Quality ({avg_dpi} DPI)"

                if rgb_images_found > 0:
                    sorted_rgb_pages = sorted(list(rgb_pages))
                    try:
                        pix = first_page.get_pixmap(dpi=150, colorspace=fitz.csRGB)
                        img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
                        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
                        _, _, gamut_out_pct = ColorEngine.rgb_to_cmyk_array(img_bgr)
                        if gamut_out_pct > 2.0:
                            warnings.append({
                                "text": f"Unprintable Neon Colors Detected ({gamut_out_pct}% Out of Gamut) — Colors will shift on Konica/Canon press.",
                                "action": "ColorProfile",
                                "action_label": "Color Proof 🎨",
                                "pages": sorted_rgb_pages,
                                "details": [f"Page {p}: Contains RGB images with out-of-gamut vibrant colors ({gamut_out_pct}% area)." for p in sorted_rgb_pages]
                            })
                            info["colorspace"] = f"DeviceRGB (Gamut Shift Warning: {gamut_out_pct}% unprintable)"
                        else:
                            warnings.append({
                                "text": f"RGB Colorspace Detected ({rgb_images_found} images) — Minor CMYK shift possible.",
                                "action": "ColorProfile",
                                "action_label": "Color Proof 🎨",
                                "pages": sorted_rgb_pages,
                                "details": [f"Page {p}: Contains RGB embedded raster images." for p in sorted_rgb_pages]
                            })
                            info["colorspace"] = "DeviceRGB (Gamut Safe)"
                    except Exception:
                        warnings.append({
                            "text": f"RGB Colorspace Detected ({rgb_images_found} images) — May shift color palette on CMYK press.",
                            "action": "ColorProfile",
                            "action_label": "Color Proof 🎨",
                            "pages": sorted_rgb_pages,
                            "details": [f"Page {p}: Contains RGB raster images." for p in sorted_rgb_pages]
                        })
                        info["colorspace"] = "DeviceRGB (Warning)"
                else:
                    info["colorspace"] = "DeviceCMYK / Vector (Press Ready 🟢)"

                # Font Embedding Inspection across pages
                unembedded_font_details = []
                unembedded_font_pages = set()
                unembedded_font_names = set()

                for p_idx in range(min(15, page_count)):
                    page = doc[p_idx]
                    font_list = page.get_fonts(full=True)
                    for font_info in font_list:
                        # font_info: (xref, gen, type, basefont, name, encoding, is_embedded)
                        font_name = font_info[3] if len(font_info) > 3 else "UnknownFont"
                        is_embedded = font_info[6] if len(font_info) > 6 else True
                        if not is_embedded:
                            unembedded_font_pages.add(p_idx + 1)
                            unembedded_font_names.add(font_name)
                            unembedded_font_details.append(f"Page {p_idx + 1}: Font '{font_name}' is NOT embedded (System font substitution risk).")

                if unembedded_font_details:
                    sorted_f_pages = sorted(list(unembedded_font_pages))
                    font_count = len(unembedded_font_names)
                    font_sample = ", ".join(list(unembedded_font_names)[:3])
                    warnings.append({
                        "text": f"Unembedded Fonts Detected — {font_count} font(s) ({font_sample}) are not embedded in PDF.",
                        "action": "FontResolver",
                        "action_label": "Fix Fonts 🔠",
                        "pages": sorted_f_pages,
                        "details": unembedded_font_details,
                        "font_names": list(unembedded_font_names)
                    })
                    info["font_status"] = f"Unembedded Fonts Found ({font_count} fonts) ⚠️"
                    info["unembedded_fonts"] = list(unembedded_font_names)
                else:
                    info["font_status"] = "All Fonts Embedded 🟢"
                    info["unembedded_fonts"] = []

                # Text Edge Safety Test (< 3mm / 8.5pt from trim margin) across pages
                margin_threshold = 8.5  # ~3.0mm
                text_danger_details = []
                text_danger_pages = set()

                for p_idx in range(min(15, page_count)):
                    page = doc[p_idx]
                    p_rect = page.rect
                    text_blocks = page.get_text("blocks")
                    for b in text_blocks:
                        if len(b) >= 5:
                            x0, y0, x1, y1, text_content = b[:5]
                            clean_text = text_content.strip().replace('\n', ' ')
                            if not clean_text:
                                continue
                            dist_left = x0
                            dist_top = y0
                            dist_right = p_rect.width - x1
                            dist_bottom = p_rect.height - y1
                            min_dist = min(dist_left, dist_top, dist_right, dist_bottom)
                            if min_dist < margin_threshold:
                                text_danger_pages.add(p_idx + 1)
                                dist_mm = round(min_dist * 25.4 / 72.0, 1)
                                text_snippet = clean_text[:35] + ("..." if len(clean_text) > 35 else "")
                                text_danger_details.append(f"Page {p_idx + 1}: Text \"{text_snippet}\" is {dist_mm}mm from trim border.")

                if text_danger_details:
                    sorted_t_pages = sorted(list(text_danger_pages))
                    warnings.append({
                        "text": f"Text Edge Safety Warning — Live text elements detected within 3mm trim margin.",
                        "action": None,
                        "action_label": None,
                        "pages": sorted_t_pages,
                        "details": text_danger_details
                    })
                    info["text_edge_safety"] = "Text Danger (< 3mm from Cut Line) ⚠️"
                    info["text_edge_issue"] = True
                else:
                    info["text_edge_safety"] = "Text Safe (> 3mm Trim Margin) 🟢"
                    info["text_edge_issue"] = False

                # Artwork Edge Safety Test (< 3mm / 8.5pt from trim without outer bleed)
                artwork_danger_details = []
                artwork_danger_pages = set()

                if not has_explicit_bleed:
                    for p_idx in range(min(15, page_count)):
                        page = doc[p_idx]
                        p_rect = page.rect
                        drawings = page.get_drawings()
                        for d in drawings:
                            r_draw = d.get("rect")
                            if r_draw:
                                dx0, dy0, dx1, dy1 = r_draw
                                dist_left = dx0
                                dist_top = dy0
                                dist_right = p_rect.width - dx1
                                dist_bottom = p_rect.height - dy1
                                min_dist = min(dist_left, dist_top, dist_right, dist_bottom)
                                if min_dist < margin_threshold:
                                    artwork_danger_pages.add(p_idx + 1)
                                    dist_mm = round(min_dist * 25.4 / 72.0, 1)
                                    artwork_danger_details.append(f"Page {p_idx + 1}: Vector path object placed {dist_mm}mm from trim edge.")
                                    if len(artwork_danger_details) >= 10:
                                        break

                if artwork_danger_details:
                    sorted_a_pages = sorted(list(artwork_danger_pages))
                    warnings.append({
                        "text": "Artwork Edge Safety Warning — Non-bleed graphic elements placed near trim border without bleed extension.",
                        "action": "Bleed",
                        "action_label": "Fix Bleed 🪄",
                        "pages": sorted_a_pages,
                        "details": artwork_danger_details
                    })
                    info["artwork_edge_safety"] = "Artwork Near Trim Edge ⚠️"
                    info["artwork_edge_issue"] = True
                else:
                    info["artwork_edge_safety"] = "Artwork Edge Clear 🟢"
                    info["artwork_edge_issue"] = False

        except Exception as e:
            issues.append(f"Failed to parse PDF document: {e}")
            return {
                "filepath": filepath, "filename": filename, "ext": ".pdf",
                "status": "ERROR", "issues": issues, "warnings": warnings, "info": info
            }

        status = "ERROR" if len(issues) > 0 else ("WARNING" if len(warnings) > 0 else "PASS")
        return {
            "filepath": filepath, "filename": filename, "ext": ".pdf",
            "status": status, "issues": issues, "warnings": warnings, "info": info
        }

    @staticmethod
    def _analyze_image(filepath: str) -> dict:
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filepath)[1].lower()
        file_size_mb = os.path.getsize(filepath) / (1024 * 1024)
        issues = []
        warnings = []
        info = {
            "type": f"{ext[1:].upper()} Raster Image",
            "file_size_mb": round(file_size_mb, 2)
        }

        try:
            # Read image with OpenCV (UNCHANGED to get alpha channel if present)
            img = cv2.imread(filepath, cv2.IMREAD_UNCHANGED)
            if img is None:
                issues.append(f"Unable to decode raster image '{filename}'. File may be corrupt.")
                return {
                    "filepath": filepath, "filename": filename, "ext": ext,
                    "status": "ERROR", "issues": issues, "warnings": warnings, "info": info
                }

            h, w = img.shape[:0], img.shape[1] if len(img.shape) >= 2 else (0, 0)
            channels = img.shape[2] if len(img.shape) == 3 else (4 if len(img.shape) > 3 else 1)
            
            # Re-read actual dimensions correctly
            h, w = img.shape[0], img.shape[1]
            info["pixel_width"] = w
            info["pixel_height"] = h

            # Print Dimensions at 300 DPI
            width_mm = (w / 300.0) * 25.4
            height_mm = (h / 300.0) * 25.4
            info["print_size_300dpi"] = f"{round(width_mm, 1)} × {round(height_mm, 1)} mm"

            # Check Transparency / Alpha channel (4 channels in PNG)
            has_alpha = (channels == 4)
            info["has_transparency"] = has_alpha
            if has_alpha:
                alpha_channel = img[:, :, 3]
                trans_pixels = np.sum(alpha_channel < 255)
                if trans_pixels > 0:
                    info["contour_ready"] = True
                    info["transparency_status"] = "Alpha Channel Present — Ready for Contour Cut Studio! ✂️"
                else:
                    info["contour_ready"] = False
            else:
                info["contour_ready"] = False

            # Check Resolution
            if w < 600 or h < 600:
                issues.append(f"Low Resolution Image ({w}×{h} px) — Too small for high quality print work.")
                info["dpi"] = 96
            elif w < 1800 or h < 1800:
                warnings.append(f"Medium Resolution Image ({w}×{h} px) — Recommended for small prints only.")
                info["dpi"] = 180
            else:
                info["dpi"] = 300

            # Check Color Space (OpenCV loads BGR/BGRA by default)
            if ext == ".png" and has_alpha:
                warnings.append("RGB/RGBA Image — Transparent PNGs require CMYK conversion or contour cut export.")
                info["colorspace"] = "RGBA (RGB with Alpha)"
            else:
                warnings.append("RGB Image — Standard raster image in RGB color space.")
                info["colorspace"] = "RGB"

            # Blur Assessment via Laplacian Variance
            gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY) if has_alpha else (cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if channels == 3 else img)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            info["sharpness_score"] = round(laplacian_var, 1)
            
            # Edge Safety Tests for Raster Images (Unavailable for Vector Analysis)
            info["text_edge_safety"] = "Unavailable (Raster Image)"
            info["text_edge_status"] = "UNAVAILABLE"
            info["artwork_edge_safety"] = "Unavailable (Raster Image)"
            info["artwork_edge_status"] = "UNAVAILABLE"

        except Exception as e:
            issues.append(f"Failed to analyze image file: {e}")
            return {
                "filepath": filepath, "filename": filename, "ext": ext,
                "status": "ERROR", "issues": issues, "warnings": warnings, "info": info
            }

        status = "ERROR" if len(issues) > 0 else ("WARNING" if len(warnings) > 0 else "PASS")
        return {
            "filepath": filepath, "filename": filename, "ext": ext,
            "status": status, "issues": issues, "warnings": warnings, "info": info
        }
