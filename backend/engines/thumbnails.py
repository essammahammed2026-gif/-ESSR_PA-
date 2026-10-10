"""Single-copy thumbnail rendering (fix.md Phase 1.1).

All routers (inspect, imposing, contour) previously duplicated the same
fitz 0.72-scale + cv2 720px/quality-90 logic. Import from here instead.
"""
import os
from typing import Optional

PDF_THUMB_SCALE = 0.72
IMAGE_MAX_DIM = 720.0
JPEG_QUALITY = 90


def render_pdf_thumb(src_path: str, dest_path: str, page_num: int = 0,
                     scale: float = PDF_THUMB_SCALE) -> bool:
    import fitz
    try:
        doc = fitz.open(src_path)
        if len(doc) == 0:
            doc.close()
            return False
        p = min(max(0, page_num), len(doc) - 1)
        pix = doc[p].get_pixmap(matrix=fitz.Matrix(scale, scale))
        pix.save(dest_path)
        doc.close()
        return True
    except Exception as exc:
        print(f"[thumbnails] pdf render failed for {src_path}: {exc}")
        return False


def render_image_thumb(src_path: str, dest_path: str,
                       max_dim: float = IMAGE_MAX_DIM,
                       quality: int = JPEG_QUALITY) -> bool:
    import cv2
    try:
        img = cv2.imread(src_path)
        if img is None:
            return False
        h_img, w_img = img.shape[:2]
        scale = min(max_dim / max(1, w_img), max_dim / max(1, h_img))
        if scale < 1.0:
            img = cv2.resize(img, (int(w_img * scale), int(h_img * scale)))
        cv2.imwrite(dest_path, img, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return True
    except Exception as exc:
        print(f"[thumbnails] image render failed for {src_path}: {exc}")
        return False


def render_thumb_for_file(src_path: str, dest_path: str, page_num: int = 0) -> bool:
    ext = os.path.splitext(src_path)[1].lower()
    if ext == ".pdf":
        return render_pdf_thumb(src_path, dest_path, page_num=page_num)
    return render_image_thumb(src_path, dest_path)


def pregen_pdf_thumbnails(file_path: str, stem: str, page_count: int,
                          scale: float = PDF_THUMB_SCALE) -> None:
    """Sequentially render every page thumb; skips pages already on disk.

    Runs in a background daemon thread (one fitz.open for all pages) so the
    first preview of a large book becomes N instant disk cache hits instead
    of N simultaneous fitz.open() calls.
    """
    import fitz
    try:
        doc = fitz.open(file_path)
        mat = fitz.Matrix(scale, scale)
        for p in range(page_count):
            thumb_path = os.path.join("temp_uploads", f"{stem}_thumb_p{p}.jpg")
            if not os.path.exists(thumb_path):
                pix = doc[p].get_pixmap(matrix=mat)
                pix.save(thumb_path)
        doc.close()
    except Exception as exc:
        print(f"[thumbnails] pre-gen failed for {stem}: {exc}")


def render_downsampled_preview(src_path: str, dest_path: str,
                               pdf_scale: float = 0.5,
                               max_dim: float = 1200.0) -> bool:
    """Lightweight raster for contour proofing (replaces inline downsample)."""
    ext = os.path.splitext(src_path)[1].lower()
    if ext == ".pdf":
        return render_pdf_thumb(src_path, dest_path, scale=pdf_scale)
    import cv2
    try:
        img = cv2.imread(src_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            return False
        h_cv, w_cv = img.shape[:2]
        if max(w_cv, h_cv) > max_dim:
            scale = max_dim / float(max(w_cv, h_cv))
            img = cv2.resize(img, (int(w_cv * scale), int(h_cv * scale)),
                             interpolation=cv2.INTER_AREA)
        cv2.imwrite(dest_path, img)
        return True
    except Exception as exc:
        print(f"[thumbnails] preview render failed for {src_path}: {exc}")
        return False


def resolve_temp_file(file_id: str, extra_exts: Optional[list] = None) -> Optional[str]:
    """Shared temp-file fallback lookup (single copy for all routers)."""
    if not file_id:
        return None
    safe_name = os.path.basename(file_id)
    p = os.path.join("temp_uploads", safe_name)
    if os.path.exists(p) and os.path.isfile(p):
        return p
    for ext in (extra_exts or [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tiff"]):
        p_ext = os.path.join("temp_uploads", f"{safe_name}{ext}")
        if os.path.exists(p_ext) and os.path.isfile(p_ext):
            return p_ext
    stem = os.path.splitext(safe_name)[0]
    if os.path.exists("temp_uploads"):
        for fname in os.listdir("temp_uploads"):
            if fname.startswith(f"{stem}.") or fname.startswith(f"{stem}_") or fname.startswith(f"{safe_name}_"):
                full = os.path.join("temp_uploads", fname)
                if os.path.isfile(full) and "_thumb_" not in fname and not fname.endswith("_thumb.jpg"):
                    return full
    return None


def get_dimensions_mm(file_path: str) -> tuple:
    """Single-copy media dimensions lookup: PDF rect or 300-DPI raster fallback."""
    if file_path.lower().endswith(".pdf"):
        import fitz
        doc = fitz.open(file_path)
        rect = doc[0].rect
        dims = ((rect.width / 72.0) * 25.4, (rect.height / 72.0) * 25.4)
        doc.close()
        return dims
    import cv2
    img = cv2.imread(file_path)
    if img is not None:
        # Assume 300 DPI if unknown
        h, w = img.shape[:2]
        return ((w / 300.0) * 25.4, (h / 300.0) * 25.4)
    return (100.0, 100.0)
