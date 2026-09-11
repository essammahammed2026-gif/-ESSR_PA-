import os
import traceback
import fitz

def run_preflight(pdf_paths):
    try:
        num_pages = 0
        sizes = set()
        total_images = 0
        low_dpi_count = 0

        for pdf_path in pdf_paths:
            with fitz.open(pdf_path) as doc:
                num_pages += len(doc)

                for page in doc:
                    w_pt, h_pt = page.rect.width, page.rect.height
                    w_mm = w_pt * 0.352777778
                    h_mm = h_pt * 0.352777778
                    sizes.add((round(w_mm, 1), round(h_mm, 1)))

                    images = page.get_image_info(xrefs=True)
                    for img in images:
                        total_images += 1
                        bbox = img.get("bbox")
                        src_w = img.get("width")
                        src_h = img.get("height")
                        if bbox and src_w and src_h:
                            x0, y0, x1, y1 = bbox
                            w_pt_img = x1 - x0
                            h_pt_img = y1 - y0
                            if w_pt_img > 0 and h_pt_img > 0:
                                dpi_x = (src_w * 72.0) / w_pt_img
                                dpi_y = (src_h * 72.0) / h_pt_img
                                avg_dpi = (dpi_x + dpi_y) / 2.0
                                if avg_dpi < 300:
                                    low_dpi_count += 1

        size_list = list(sizes)
        is_uniform = len(size_list) <= 1
        primary_size = size_list[0] if len(size_list) > 0 else (0.0, 0.0)

        return {
            "success": True,
            "data": {
                "num_pages": num_pages,
                "is_uniform": is_uniform,
                "sizes": size_list,
                "primary_size": primary_size,
                "total_images": total_images,
                "low_dpi_warnings": low_dpi_count
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": traceback.format_exc()
        }
