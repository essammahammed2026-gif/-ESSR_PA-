import cv2
import numpy as np
import base64
import os
import fitz


def chaikin_smooth(points, iterations=1):
    if len(points) < 3 or iterations == 0:
        return points
    for _ in range(iterations):
        new_points = []
        for i in range(len(points)):
            p0 = points[i]
            p1 = points[(i + 1) % len(points)]
            
            # Corner cutting at 25% and 75%
            q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]
            r = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]
            new_points.append(q)
            new_points.append(r)
        import numpy as np
        points = np.array(new_points)
    return points

def generate_contour_cut_svg(img_path, offset_val=0.0, offset_unit="mm", threshold=20, 
                             dpi=300, stroke_color="#FF00FE", stroke_width=1.0, 
                             keep_holes=False, add_white_matte=False, pdf_page=0, smoothing_factor=0, **kwargs):
    """
    Generates a production-ready SVG cut contour path using FULLY AUTOMATIC classical computer vision.
    NO AI MODELS ARE USED. 
    Includes strict memory safeguards to process massive 300DPI print files instantly on CPU.
    """
    ext = os.path.splitext(img_path)[1].lower()
    
    physical_w_pt = None
    physical_h_pt = None

    # 1. Load Artwork & Determine Exact Physical Size
    if ext == ".pdf":
        doc = fitz.open(img_path)
        if pdf_page >= len(doc):
            pdf_page = 0
        page = doc[pdf_page]
        rect = page.rect
        physical_w_pt = rect.width
        physical_h_pt = rect.height
        
        scale = dpi / 72.0
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=True)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        h, w = pix.h, pix.w
        doc.close()
        
        success, png_data = cv2.imencode('.png', img)
        img_b64 = base64.b64encode(png_data.tobytes()).decode("utf-8")
        mime = "image/png"
    else:
        img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
        h, w = img.shape[:2]
        
        physical_w_pt = (w / dpi) * 72.0
        physical_h_pt = (h / dpi) * 72.0

        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
        mime = "image/png" if ext == ".png" else "image/jpeg"

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    # 2. AUTOMATIC PIPELINE (No AI, Memory Safe)
    # Step A: Downscale for CV analysis to strictly guard against RAM/CPU spikes
    max_dim = 1500.0
    scale_factor = 1.0
    if max(w, h) > max_dim:
        scale_factor = max_dim / float(max(w, h))
        cv_w, cv_h = int(w * scale_factor), int(h * scale_factor)
        cv_img = cv2.resize(img, (cv_w, cv_h), interpolation=cv2.INTER_AREA)
    else:
        cv_img = img.copy()
        cv_w, cv_h = w, h

    # Step B: Determine Subject Isolation Strategy
    has_real_alpha = (cv_img.shape[2] == 4 and np.std(cv_img[:, :, 3]) > 0.5)

    if has_real_alpha:
        # STRATEGY 1: Transparent PNG (Alpha Channel)
        _, mask_small = cv2.threshold(cv_img[:, :, 3], max(1, threshold), 255, cv2.THRESH_BINARY)
    else:
        bgr = cv_img[:, :, :3]
        border_pixels = np.concatenate([bgr[0, :, :], bgr[cv_h-1, :, :], bgr[:, 0, :], bgr[:, cv_w-1, :]], axis=0)
        std_dev = np.std(border_pixels, axis=0).mean()

        # STRATEGY 2: Solid Background (Color Distance Threshold)
        # Apply this fallback to all non-alpha images
        bg_color = np.median(border_pixels, axis=0)
        diff = cv2.absdiff(bgr, bg_color.astype(np.uint8))
        diff_dist = np.max(diff, axis=2)
        eff_thresh = max(6, threshold) if threshold > 0 else 10
        _, mask_small = cv2.threshold(diff_dist, eff_thresh, 255, cv2.THRESH_BINARY)

    # Step C: Upscale Mask back to original Print Resolution
    if scale_factor < 1.0:
        mask = cv2.resize(mask_small, (w, h), interpolation=cv2.INTER_LINEAR)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    else:
        mask = mask_small



    # 3. Apply Offset (Bleed/Choke)
    if offset_unit == "mm":
        offset_px = int(round((offset_val / 25.4) * dpi))
    elif offset_unit == "cm":
        offset_px = int(round((offset_val / 2.54) * dpi))
    elif offset_unit == "inch":
        offset_px = int(round(offset_val * dpi))
    else: # pt
        offset_px = int(round((offset_val / 72.0) * dpi))

    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    if not keep_holes:
        mask_copy = mask.copy()
        fill_mask = np.zeros((h + 2, w + 2), np.uint8)
        for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            if mask_copy[corner[1], corner[0]] == 0:
                cv2.floodFill(mask_copy, fill_mask, corner, 255)
        mask_inv = cv2.bitwise_not(mask_copy)
        mask = cv2.bitwise_or(mask, mask_inv)

    if offset_px != 0:
        if offset_px > 0:
            # Safeguard: Distance Transform prevents O(N*K^2) CPU locking
            inv_mask = cv2.bitwise_not(mask)
            dist = cv2.distanceTransform(inv_mask, cv2.DIST_L2, 5)
            _, mask = cv2.threshold(dist, offset_px, 255, cv2.THRESH_BINARY_INV)
            mask = mask.astype(np.uint8)
        else:
            dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
            _, mask = cv2.threshold(dist, abs(offset_px), 255, cv2.THRESH_BINARY)
            mask = mask.astype(np.uint8)

    # Post-Smooth Edge
    if smoothing_factor > 0:
        kernel_size = int(smoothing_factor) * 2 + 1
        mask = cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0)
    else:
        mask = cv2.GaussianBlur(mask, (3, 3), 0)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    # 4. Extract Contours & Generate SVG Polygons
    mode = cv2.RETR_CCOMP if keep_holes else cv2.RETR_EXTERNAL
    raw_contours, _ = cv2.findContours(mask, mode, cv2.CHAIN_APPROX_SIMPLE)

    path_d_list = []
    mm_in_pixels = dpi / 25.4
    min_area = max((w * h) * 0.00001, mm_in_pixels * mm_in_pixels)

    if raw_contours:
        for cnt in raw_contours:
            if cv2.contourArea(cnt) < min_area: continue
            
            x_c, y_c, w_c, h_c = cv2.boundingRect(cnt)
            if w_c >= (w * 0.98) and h_c >= (h * 0.98): continue

            # 1. Simplify stair-stepped pixels
            approx = cv2.approxPolyDP(cnt, 1.0, True)
            points = approx.reshape(-1, 2)
            if len(points) < 3: continue

            # 2. Mathematically smooth the polygon directly (Chaikin's algorithm)
            ch_iters = int(smoothing_factor) // 3
            if ch_iters > 0:
                points = chaikin_smooth(points, iterations=ch_iters)

            cmd = [f"M {points[0][0]:.2f},{points[0][1]:.2f}"]
            for pt in points[1:]:
                cmd.append(f"L {pt[0]:.2f},{pt[1]:.2f}")
            cmd.append("Z")
            path_d_list.append(" ".join(cmd))

    full_path_d = " ".join(path_d_list)
    white_matte_path = f'<path id="StickerWhiteMatte" fill="#FFFFFF" d="{full_path_d}"/>\n    ' if add_white_matte else ""

    svg_content = f'''<svg width="{physical_w_pt}pt" height="{physical_h_pt}pt" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g id="Artwork">
    {white_matte_path}<image width="{w}" height="{h}" xlink:href="data:{mime};base64,{img_b64}"/>
  </g>
  <g id="CutContourLines">
    <path id="CutContour" stroke="{stroke_color}" stroke-width="{stroke_width}" fill="none" stroke-linejoin="round" stroke-linecap="round" d="{full_path_d}"/>
  </g>
</svg>'''

    return svg_content
