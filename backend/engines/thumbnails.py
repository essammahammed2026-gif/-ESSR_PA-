"""Single-copy thumbnail rendering (fix.md Phase 1.1).

All routers (inspect, imposing, contour) previously duplicated the same
fitz 0.72-scale + cv2 720px/quality-90 logic. Import from here instead.
"""
import os
from typing import Optional
from engines.units import px_to_mm

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
        pix = doc[p].get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
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
                pix = doc[p].get_pixmap(matrix=mat, alpha=False)
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
        from engines.units import PTS_TO_MM
        doc = fitz.open(file_path)
        try:
            rect = doc[0].rect
            return (rect.width * PTS_TO_MM, rect.height * PTS_TO_MM)
        finally:
            doc.close()
    import cv2
    img = cv2.imread(file_path)
    if img is not None:
        # Assume 300 DPI if unknown
        h, w = img.shape[:2]
        return (px_to_mm(w, 300.0), px_to_mm(h, 300.0))
    return (100.0, 100.0)


def get_pdf_page_count(file_path: str) -> int:
    """Single-copy page count probe — routers must not fitz.open directly."""
    import fitz
    try:
        doc = fitz.open(file_path)
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception:
        return 1


def list_pdf_pages_mm(file_path: str) -> list:
    """Single-copy per-page (w_mm, h_mm) probe — closes doc before return."""
    import fitz
    from engines.units import PTS_TO_MM
    doc = fitz.open(file_path)
    try:
        out = []
        for p in range(len(doc)):
            rect = doc[p].rect
            out.append((rect.width * PTS_TO_MM, rect.height * PTS_TO_MM))
        return out
    finally:
        doc.close()


def get_raster_pixel_size(file_path: str) -> tuple:
    """Single-copy cv2.imread dimension probe — returns (w_px, h_px)."""
    import cv2
    try:
        img = cv2.imread(file_path)
        if img is None:
            return (0, 0)
        h, w = img.shape[:2]
        return (w, h)
    except Exception:
        return (0, 0)


def probe_source_dims(pdf_path_val: str, page_num: int, open_docs: dict) -> tuple:
    """Single-copy opposing-orientation probe for imposing preview.

    Caches open fitz handles in caller-provided `open_docs` dict (closed by
    caller). Handles PDF pages and raster images without leaking cv2/fitz
    imports into routers.
    """
    ext = pdf_path_val.lower().rsplit(".", 1)[-1] if "." in pdf_path_val else ""
    if ext == "pdf":
        if pdf_path_val not in open_docs:
            try:
                import fitz
                open_docs[pdf_path_val] = fitz.open(pdf_path_val)
            except Exception:
                open_docs[pdf_path_val] = None
        chk_doc = open_docs.get(pdf_path_val)
        if chk_doc:
            p_chk = min(max(0, page_num), len(chk_doc) - 1)
            rect = chk_doc[p_chk].rect
            return (rect.width, rect.height)
        return (0, 0)
    if ext in ("png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"):
        w, h = get_raster_pixel_size(pdf_path_val)
        return (w, h)
    return (0, 0)


def write_ndarray_jpg(img, dest_path: str, quality: int = 80) -> bool:
    """Single-copy ndarray → JPEG writer (keeps cv2.imencode out of routers)."""
    import cv2
    try:
        success, enc = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            return False
        with open(dest_path, "wb") as f:
            f.write(enc.tobytes())
        return True
    except Exception:
        return False
