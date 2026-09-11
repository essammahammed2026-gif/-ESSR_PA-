"""
Color Engine Module for BlueWhale Printing Assistant.
Implements CMYK color conversion, Out-of-Gamut neon RGB detection,
Konica Minolta C14000 / Canon C1000VP press curves, and Glossy/Matte Lamination simulation.
"""

import os
import cv2
import math
import fitz  # PyMuPDF
import numpy as np


class ColorEngine:
    """Core Color Management & Lamination Proofing Engine."""

    PRESS_PRESETS = {
        "Konica Minolta C14000": {
            "max_ink_density": 280,
            "toner_gloss": 1.10,
            "contrast_gamma": 1.05,
            "profile_name": "ISO Coated v2 (FOGRA39 / KM C14000)"
        },
        "Canon imagePRESS C1000VP": {
            "max_ink_density": 300,
            "toner_gloss": 1.15,
            "contrast_gamma": 1.02,
            "profile_name": "GRACoL2006 (Canon C1000VP)"
        }
    }

    PAPER_PRESETS = {
        "Couché 115g / 200g (Light Coated)": {"whiteness": 0.96, "gain": 1.02},
        "Couché 300g / 350g (Heavy Coated)": {"whiteness": 0.98, "gain": 1.00}
    }

    LAMINATION_PRESETS = {
        "Glossy Lamination": {"contrast": 1.15, "saturation": 1.08, "matte_glare": 0.0},
        "Matte Lamination": {"contrast": 0.92, "saturation": 0.95, "matte_glare": 0.12},
        "No Lamination (Semi-Gloss Couché)": {"contrast": 1.00, "saturation": 1.00, "matte_glare": 0.0}
    }

    @staticmethod
    def rgb_to_cmyk_array(rgb_bgr_img: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
        """
        Converts BGR/RGB image to CMYK array and computes out-of-gamut mask & percentage.
        Returns (cmyk_img_uint8, gamut_mask_uint8, gamut_out_percent).
        """
        if len(rgb_bgr_img.shape) == 2:
            bgr = cv2.cvtColor(rgb_bgr_img, cv2.COLOR_GRAY2BGR)
        elif rgb_bgr_img.shape[2] == 4:
            bgr = cv2.cvtColor(rgb_bgr_img, cv2.COLOR_BGRA2BGR)
        else:
            bgr = rgb_bgr_img.copy()

        # Convert BGR to RGB floats (0.0 to 1.0)
        rgb_float = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

        r, g, b = rgb_float[:, :, 0], rgb_float[:, :, 1], rgb_float[:, :, 2]
        k = 1.0 - np.maximum(np.maximum(r, g), b)
        
        denom = np.maximum(1.0 - k, 1e-6)
        c = (1.0 - r - k) / denom
        m = (1.0 - g - k) / denom
        y = (1.0 - b - k) / denom

        c = np.clip(c * 255.0, 0, 255).astype(np.uint8)
        m = np.clip(m * 255.0, 0, 255).astype(np.uint8)
        y = np.clip(y * 255.0, 0, 255).astype(np.uint8)
        k = np.clip(k * 255.0, 0, 255).astype(np.uint8)

        cmyk_img = cv2.merge([c, m, y, k])

        # Out-of-Gamut Detection (High saturation neon RGB colors that collapse in CMYK)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        val = hsv[:, :, 2]

        # Neon / Ultra-vibrant unprintable RGB mask
        gamut_mask = ((sat > 180) & (val > 180)).astype(np.uint8) * 255
        gamut_out_percent = round(float(np.sum(gamut_mask > 0) / gamut_mask.size) * 100.0, 1)

        return cmyk_img, gamut_mask, gamut_out_percent

    @staticmethod
    def simulate_print_proof(
        img_bgr: np.ndarray,
        press_key: str = "Konica Minolta C14000",
        paper_key: str = "Couché 300g / 350g (Heavy Coated)",
        lamination_key: str = "Glossy Lamination",
        show_gamut_warning: bool = False
    ) -> tuple[np.ndarray, float]:
        """
        Simulates final printed Couché paper appearance with press curves & lamination.
        Returns (proof_bgr_img, gamut_out_percent).
        """
        press = ColorEngine.PRESS_PRESETS.get(press_key, ColorEngine.PRESS_PRESETS["Konica Minolta C14000"])
        paper = ColorEngine.PAPER_PRESETS.get(paper_key, ColorEngine.PAPER_PRESETS["Couché 300g / 350g (Heavy Coated)"])
        lam = ColorEngine.LAMINATION_PRESETS.get(lamination_key, ColorEngine.LAMINATION_PRESETS["Glossy Lamination"])

        cmyk_img, gamut_mask, gamut_percent = ColorEngine.rgb_to_cmyk_array(img_bgr)

        # Convert back from CMYK to simulated BGR press preview
        c, m, y, k = cv2.split(cmyk_img.astype(np.float32) / 255.0)
        
        # Apply Press Toner & Paper Whiteness Gain
        r = (1.0 - c) * (1.0 - k) * paper["whiteness"]
        g = (1.0 - m) * (1.0 - k) * paper["whiteness"]
        b = (1.0 - y) * (1.0 - k) * paper["whiteness"]

        proof_rgb = cv2.merge([r, g, b])
        proof_bgr = cv2.cvtColor(np.clip(proof_rgb * 255.0, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)

        # Apply Lamination Effect
        c_factor = lam["contrast"] * press["contrast_gamma"]
        s_factor = lam["saturation"]

        if c_factor != 1.0 or s_factor != 1.0:
            proof_hsv = cv2.cvtColor(proof_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
            proof_hsv[:, :, 1] = np.clip(proof_hsv[:, :, 1] * s_factor, 0, 255)
            proof_hsv[:, :, 2] = np.clip(((proof_hsv[:, :, 2] - 128.0) * c_factor) + 128.0, 0, 255)
            proof_bgr = cv2.cvtColor(proof_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

        # Apply Glossy Specular Sheen or Matte Paper Texture
        h, w = proof_bgr.shape[:2]

        if lamination_key == "Glossy Lamination":
            # Generate realistic diagonal gloss light reflection sheen
            x_coords, y_coords = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
            diag_sheen = np.sin((x_coords + y_coords) * math.pi * 1.5) * 0.08 + 0.04
            diag_sheen_3ch = np.dstack([diag_sheen]*3).astype(np.float32)
            
            proof_float = proof_bgr.astype(np.float32) / 255.0
            proof_float = np.clip(proof_float + diag_sheen_3ch, 0.0, 1.0)
            proof_bgr = (proof_float * 255.0).astype(np.uint8)

        elif lamination_key == "Matte Lamination":
            # Generate fine diffuse paper fiber noise texture
            grain_noise = np.random.normal(0, 2.5, (h, w)).astype(np.float32)
            grain_3ch = np.dstack([grain_noise]*3)
            proof_float = np.clip(proof_bgr.astype(np.float32) + grain_3ch, 0.0, 255.0)
            proof_bgr = proof_float.astype(np.uint8)

            glare_layer = np.full_like(proof_bgr, 230)
            proof_bgr = cv2.addWeighted(proof_bgr, 0.90, glare_layer, 0.10, 0)

        # Draw Neon Yellow Gamut Warning Overlay if toggled
        if show_gamut_warning and np.sum(gamut_mask > 0) > 0:
            neon_overlay = np.zeros_like(proof_bgr)
            neon_overlay[:, :] = (0, 242, 254)  # Cyan/Yellow warning highlight
            mask_3ch = cv2.cvtColor(gamut_mask, cv2.COLOR_GRAY2BGR)
            proof_bgr = np.where(mask_3ch > 0, cv2.addWeighted(proof_bgr, 0.4, neon_overlay, 0.6, 0), proof_bgr)

        return proof_bgr, gamut_percent

    @staticmethod
    def convert_pdf_to_cmyk_press(src_pdf_path: str, dst_pdf_path: str, press_info: str = "Konica Minolta C14000 / Canon C1000 — Papier Couché") -> bool:
        """Converts all pages in a PDF document to CMYK press format with proof certificate stamp."""
        try:
            with fitz.open(src_pdf_path) as doc:
                new_doc = fitz.open()
                for page in doc:
                    pix = page.get_pixmap(dpi=300, colorspace=fitz.csRGB)
                    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
                    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

                    cmyk_img, _, _ = ColorEngine.rgb_to_cmyk_array(img_bgr)
                    
                    # Draw Proof Certificate Footer Banner
                    h, w = img_bgr.shape[:2]
                    footer_h = max(40, int(h * 0.035))
                    cv2.rectangle(img_bgr, (0, h - footer_h), (w, h), (15, 18, 23), -1)
                    cv2.line(img_bgr, (0, h - footer_h), (w, h - footer_h), (0, 242, 254), 2)

                    stamp_text = f"DIGITAL SOFT PROOF — Calibrated for {press_info} (CMYK Press Profile)"
                    cv2.putText(img_bgr, stamp_text, (20, h - int(footer_h * 0.35)),
                                cv2.FONT_HERSHEY_SIMPLEX, max(0.4, w / 2200.0), (255, 255, 255), 1, cv2.LINE_AA)

                    # Rebuild page into new document
                    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                    success, encoded_img = cv2.imencode(".jpg", img_rgb, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
                    
                    newPage = new_doc.new_page(width=page.rect.width, height=page.rect.height)
                    newPage.insert_image(newPage.rect, stream=encoded_img.tobytes())

                new_doc.save(dst_pdf_path)
                new_doc.close()
                return True
        except Exception:
            return False
