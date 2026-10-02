import os
import uuid
import threading
import fitz
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from engines.sheet_packer import MaxRectsSheetPacker, SheetArtworkSpec, SingleSheetResult, PlacedSheetItem
from engines.roll_packer import MeterSegmentPacker, ArtworkSpec as RollArtworkSpec, MeterSegmentPackingResult
from engines.sheet_gang_exporter import SheetGangExporter


router = APIRouter()


def _pregen_all_thumbnails(file_path: str, file_id_ext: str, page_count: int) -> None:
    """
    Background daemon thread: opens the PDF once and sequentially renders every
    page thumbnail at 0.35× scale (~25 DPI, ≈15 KB per page).

    At upload time only page 0 is pre-generated synchronously. Without this,
    the first preview of a large book fires N simultaneous fitz.open() calls
    (one per thumbnail request), each parsing the full PDF — the main source of
    lag on multi-page files. By pre-generating all thumbnails in a single open/
    render/close pass, every subsequent thumbnail request becomes an instant
    disk cache hit.

    Thumbnails that already exist on disk are skipped (page 0 is always written
    by the upload handler before this thread starts).
    """
    try:
        doc = fitz.open(file_path)
        # 0.72 scale (~150 DPI) provides crystal-clear preview resolution
        mat = fitz.Matrix(0.72, 0.72)
        stem = os.path.splitext(file_id_ext)[0]
        for p in range(page_count):
            thumb_path = os.path.join("temp_uploads", f"{stem}_thumb_p{p}.jpg")
            if not os.path.exists(thumb_path):
                pix = doc[p].get_pixmap(matrix=mat)
                pix.save(thumb_path)
        doc.close()
    except Exception as exc:
        print(f"[imposing] thumbnail pre-gen failed for {file_id_ext}: {exc}")

class ImposingItem(BaseModel):
    file_id: str
    copies: int = 1
    name: str
    w: Optional[float] = None
    h: Optional[float] = None
    keep_aspect: bool = False
    fill_color: str = "#FFFFFF"
    page_count: Optional[int] = 1
    page_range: Optional[str] = "all"
    page_num: Optional[int] = 0
    # Fit mode (authoritative): "stretch" | "fit" | "crop"
    # "stretch" → force-fill exact W×H (may distort).
    # "fit"     → scale proportionally + letterbox-pad with fill_color.
    # "crop"    → scale to fill, centre-crop any overflow.
    fit_mode: str = "stretch"
    # Page rotation applied to content (independent of packer auto-rotation)
    # "none" | "cw" (90° CW) | "ccw" (90° CCW)
    page_rotation: str = "none"
    # Bleed mode: "none" | "solid" | "mirror"
    bleed_mode: str = "none"
    bleed_mm: float = 0.0
    bleed_color: str = "#FFFFFF"
    # Bleed placement: "inside" (trim size locked, artwork inset) | "outside" (artwork locked, outer box expands)
    bleed_type: str = "inside"



class ImposingRequest(BaseModel):
    items: List[ImposingItem]
    job_mode: str = "gang"
    mode: str = "Sheet"
    sheet_w: float = 320.0
    sheet_h: float = 450.0
    margin: float = 10.0
    gap: float = 5.0
    draw_border: bool = False
    border_color: str = "#000000"
    crop_marks: bool = False
    align: str = "Center"
    nesting_mode: str = "Grid"
    auto_rotate_sheet: bool = True
    uniform_orientation: bool = True
    page_index: Optional[int] = 0

def get_dimensions_mm(file_path: str):
    # Try pdf first
    if file_path.lower().endswith(".pdf"):
        doc = fitz.open(file_path)
        rect = doc[0].rect
        return (rect.width / 72.0) * 25.4, (rect.height / 72.0) * 25.4
    else:
        import cv2
        img = cv2.imread(file_path)
        if img is not None:
            # Assume 300 DPI if unknown
            h, w = img.shape[:2]
            return (w / 300.0) * 25.4, (h / 300.0) * 25.4
    return 100.0, 100.0

def parse_page_range(range_str: str, max_pages: int) -> List[int]:
    if not range_str or range_str.strip().lower() in ["all", ""]:
        return list(range(max_pages))
    pages = []
    for part in range_str.split(","):
        part = part.strip()
        if not part: continue
        if "-" in part:
            try:
                start_s, end_s = part.split("-")
                start = max(1, int(start_s))
                end = min(max_pages, int(end_s))
                pages.extend(range(start - 1, end))
            except:
                pass
        else:
            try:
                p = int(part)
                if 1 <= p <= max_pages:
                    pages.append(p - 1)
            except:
                pass
    return sorted(list(set(pages))) if pages else list(range(max_pages))

@router.post("/api/imposing/upload")
async def upload_imposing_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    if not ext: ext = ".pdf"
    file_path = f"temp_uploads/{file_id}{ext}"
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    page_count = 1
    w, h = 100.0, 100.0
    thumb_path = f"temp_uploads/{file_id}_thumb_p0.jpg"
    
    if ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            page_count = len(doc)
            if page_count > 0:
                rect = doc[0].rect
                w = (rect.width / 72.0) * 25.4
                h = (rect.height / 72.0) * 25.4
                # Render page 0 thumbnail synchronously at 0.72 scale (~150 DPI) for crisp preview
                pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.72, 0.72))
                pix.save(thumb_path)
            doc.close()

            # For multi-page PDFs (books), pre-generate ALL remaining page thumbnails
            # in a background daemon thread. One fitz.open() → all pages rendered
            # sequentially → disk cache populated before the first preview fires.
            # This turns N parallel cache-miss renders into N instant cache hits.
            if page_count > 1:
                file_id_ext = f"{file_id}{ext}"
                t = threading.Thread(
                    target=_pregen_all_thumbnails,
                    args=(file_path, file_id_ext, page_count),
                    daemon=True,
                    name=f"thumb-pregen-{file_id[:8]}"
                )
                t.start()
        except Exception as e:
            print(f"PDF upload parsing error: {e}")
            w, h = get_dimensions_mm(file_path)
    else:
        w, h = get_dimensions_mm(file_path)
        try:
            import cv2
            img = cv2.imread(file_path)
            if img is not None:
                h_img, w_img = img.shape[:2]
                scale = min(720.0 / max(1, w_img), 720.0 / max(1, h_img))
                if scale < 1.0:
                    img = cv2.resize(img, (int(w_img * scale), int(h_img * scale)))
                cv2.imwrite(thumb_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        except:
            thumb_path = ""

    return {
        "success": True,
        "file_id": f"{file_id}{ext}",
        "name": file.filename,
        "w": round(w, 2),
        "h": round(h, 2),
        "page_count": page_count,
        "is_book": page_count > 1,
        "thumb": f"/api/imposing/thumbnail/{file_id}{ext}/0"
    }

@router.get("/api/imposing/thumbnail/{file_id}/{page_num}")
def get_imposing_thumbnail(file_id: str, page_num: int):
    safe_file_id = os.path.basename(file_id)
    thumb_filename = f"{os.path.splitext(safe_file_id)[0]}_thumb_p{page_num}.jpg"
    thumb_path = os.path.join("temp_uploads", thumb_filename)
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    src_path = os.path.join("temp_uploads", safe_file_id)
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="File not found")

    ext = os.path.splitext(safe_file_id)[1].lower()
    if ext == ".pdf":
        try:
            doc = fitz.open(src_path)
            p = min(max(0, page_num), len(doc) - 1)
            # High-fidelity preview resolution (approx 150 DPI, 0.72 scale)
            pix = doc[p].get_pixmap(matrix=fitz.Matrix(0.72, 0.72))
            pix.save(thumb_path)
            doc.close()
            return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate page thumbnail: {e}")
    else:
        try:
            import cv2
            img = cv2.imread(src_path)
            if img is not None:
                h_img, w_img = img.shape[:2]
                scale = min(720.0 / max(1, w_img), 720.0 / max(1, h_img))
                if scale < 1.0:
                    img = cv2.resize(img, (int(w_img * scale), int(h_img * scale)))
                cv2.imwrite(thumb_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
                return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image thumbnail error: {e}")
        return FileResponse(src_path)

def build_sheet_specs(items: List[ImposingItem]) -> List[SheetArtworkSpec]:
    specs = []
    for item in items:
        path = f"temp_uploads/{item.file_id}"
        w = item.w if item.w is not None else get_dimensions_mm(path)[0]
        h = item.h if item.h is not None else get_dimensions_mm(path)[1]
        # fit_mode is authoritative; keep_aspect is derived for backward compat
        fit_mode = item.fit_mode or "stretch"
        keep_aspect_derived = (fit_mode == "fit")

        bleed_mode = item.bleed_mode or "none"
        bleed_mm = item.bleed_mm or 0.0
        bleed_color = item.bleed_color or "#FFFFFF"
        bleed_type = item.bleed_type or "inside"

        # If outside bleed, the total piece bounding box on the sheet expands by 2*bleed_mm
        pack_w = (w + 2 * bleed_mm) if (bleed_type == "outside" and bleed_mode != "none" and bleed_mm > 0) else w
        pack_h = (h + 2 * bleed_mm) if (bleed_type == "outside" and bleed_mode != "none" and bleed_mm > 0) else h

        if item.page_count and item.page_count > 1:
            target_pages = parse_page_range(item.page_range or "all", item.page_count)
            for p_idx in target_pages:
                specs.append(SheetArtworkSpec(
                    name=f"{item.name}#p{p_idx + 1}",
                    piece_w_mm=pack_w, piece_h_mm=pack_h,
                    quantity=item.copies, pdf_path=path,
                    keep_aspect=keep_aspect_derived,
                    fill_color=item.fill_color,
                    page_num=p_idx,
                    file_id=item.file_id,
                    fit_mode=fit_mode,
                    page_rotation=item.page_rotation or "none",
                    bleed_mode=bleed_mode,
                    bleed_mm=bleed_mm,
                    bleed_color=bleed_color,
                    bleed_type=bleed_type,
                    target_w_mm=w,
                    target_h_mm=h,
                ))
        else:
            specs.append(SheetArtworkSpec(
                name=item.name, piece_w_mm=pack_w, piece_h_mm=pack_h,
                quantity=item.copies, pdf_path=path,
                keep_aspect=keep_aspect_derived,
                fill_color=item.fill_color,
                page_num=item.page_num or 0,
                file_id=item.file_id,
                fit_mode=fit_mode,
                page_rotation=item.page_rotation or "none",
                bleed_mode=bleed_mode,
                bleed_mm=bleed_mm,
                bleed_color=bleed_color,
                bleed_type=bleed_type,
                target_w_mm=w,
                target_h_mm=h,
            ))
    return specs

def build_roll_specs(items: List[ImposingItem]) -> List[RollArtworkSpec]:
    specs = []
    for item in items:
        path = f"temp_uploads/{item.file_id}"
        w = item.w if item.w is not None else get_dimensions_mm(path)[0]
        h = item.h if item.h is not None else get_dimensions_mm(path)[1]
        fit_mode = item.fit_mode or "stretch"
        keep_aspect_derived = (fit_mode == "fit")

        if item.page_count and item.page_count > 1:
            target_pages = parse_page_range(item.page_range or "all", item.page_count)
            for p_idx in target_pages:
                specs.append(RollArtworkSpec(
                    name=f"{item.name}#p{p_idx + 1}",
                    piece_w_mm=w, piece_h_mm=h,
                    quantity=item.copies,
                    keep_aspect=keep_aspect_derived,
                    fill_color=item.fill_color,
                    page_num=p_idx,
                    file_id=item.file_id,
                ))
        else:
            specs.append(RollArtworkSpec(
                name=item.name, piece_w_mm=w, piece_h_mm=h,
                quantity=item.copies,
                keep_aspect=keep_aspect_derived,
                fill_color=item.fill_color,
                page_num=item.page_num or 0,
                file_id=item.file_id,
            ))
    return specs


def apply_alignment(items, sheet_w, sheet_h, margin, align):
    if not items or align == "Top Left":
        return
    min_x = min(i.x_mm for i in items)
    max_x = max(i.x_mm + i.w_mm for i in items)
    min_y = min(i.y_mm for i in items)
    max_y = max(i.y_mm + i.h_mm for i in items)
    
    content_w = max_x - min_x
    content_h = max_y - min_y
    usable_w = sheet_w - (margin * 2)
    usable_h = sheet_h - (margin * 2)
    
    shift_x = 0
    shift_y = 0
    
    if "Center" in align:
        shift_x = (usable_w - content_w) / 2.0
    elif "Right" in align:
        shift_x = usable_w - content_w
        
    if "Center" == align or "Left" == align or "Right" == align:
        # Middle vertical alignment
        shift_y = (usable_h - content_h) / 2.0
    elif "Bottom" in align:
        shift_y = usable_h - content_h
        
    # Prevent negative shifts if content overflows usable bounds slightly
    shift_x = max(0, shift_x)
    shift_y = max(0, shift_y)

    for i in items:
        i.x_mm += shift_x
        i.y_mm += shift_y
@router.post("/api/imposing/preview")
def preview_imposing(req: ImposingRequest):
    try:
        if req.mode == "Sheet":
            specs = build_sheet_specs(req.items)
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap,
                artworks=specs,
                allow_rotation=req.auto_rotate_sheet,
                uniform_orientation=req.uniform_orientation,
                job_mode=req.job_mode
            )
            
            pages = len(results)
            efficiency = (sum(r.efficiency_pct for r in results) / pages) if pages > 0 else 0
            
            preview_pages = []
            open_docs = {}
            try:
                for res in results:
                    apply_alignment(res.placed_items, req.sheet_w, req.sheet_h, req.margin, req.align)
                    boxes = []
                    for placed in res.placed_items:
                        file_id = getattr(placed, 'file_id', '') or (placed.pdf_path.split('/')[-1] if placed.pdf_path else '')
                        page_num = getattr(placed, 'page_num', 0)

                        # Compute whether this page's aspect opposes the user-configured target trim size
                        raw_user_rot = getattr(placed, "page_rotation", "none")
                        eff_user_rot = "none"
                        target_w = getattr(placed, "target_w_mm", 0.0) or (placed.h_mm if placed.rotated else placed.w_mm)
                        target_h = getattr(placed, "target_h_mm", 0.0) or (placed.w_mm if placed.rotated else placed.h_mm)
                        target_is_landscape = target_w > target_h

                        if raw_user_rot in ("cw", "ccw"):
                            pdf_path_val = placed.pdf_path or f"temp_uploads/{file_id}"
                            src_pw, src_ph = target_w, target_h
                            if pdf_path_val and os.path.exists(pdf_path_val):
                                ext = pdf_path_val.lower().split(".")[-1]
                                if ext == "pdf":
                                    if pdf_path_val not in open_docs:
                                        try:
                                            open_docs[pdf_path_val] = fitz.open(pdf_path_val)
                                        except Exception:
                                            open_docs[pdf_path_val] = None
                                    chk_doc = open_docs.get(pdf_path_val)
                                    if chk_doc:
                                        p_chk = min(max(0, page_num), len(chk_doc) - 1)
                                        src_pw, src_ph = chk_doc[p_chk].rect.width, chk_doc[p_chk].rect.height
                                elif ext in ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "avif", "webp"]:
                                    try:
                                        import cv2
                                        tmp_im = cv2.imread(pdf_path_val)
                                        if tmp_im is not None:
                                            src_ph, src_pw = tmp_im.shape[:2]
                                    except Exception:
                                        pass
                            # Only apply user rotation if page orientation opposes the user's target orientation!
                            src_is_landscape = src_pw > src_ph
                            if src_is_landscape != target_is_landscape:
                                eff_user_rot = raw_user_rot

                        boxes.append({
                            "x": placed.x_mm, "y": placed.y_mm, "w": placed.w_mm, "h": placed.h_mm,
                            "target_w": target_w, "target_h": target_h,
                            "rotated": getattr(placed, "rotated", False),
                            "file_id": file_id,
                            "page_num": page_num,
                            "page_label": f"P. {page_num + 1}",
                            "thumb": f"/api/imposing/thumbnail/{file_id}/{page_num}",
                            "keep_aspect": placed.keep_aspect,
                            "fill_color": placed.fill_color,
                            "fit_mode": getattr(placed, "fit_mode", "stretch"),
                            "page_rotation": eff_user_rot,
                            "bleed_mode": getattr(placed, "bleed_mode", "none"),
                            "bleed_mm": getattr(placed, "bleed_mm", 0.0),
                            "bleed_color": getattr(placed, "bleed_color", "#FFFFFF"),
                            "bleed_type": getattr(placed, "bleed_type", "inside"),
                        })
                    preview_pages.append({
                        "w": req.sheet_w, "h": req.sheet_h, "boxes": boxes
                    })
            finally:
                for d in open_docs.values():
                    if d:
                        try:
                            d.close()
                        except Exception:
                            pass
                    
            return {
                "success": True,
                "stats": {
                    "pages": pages,
                    "avg_efficiency": round(efficiency, 1)
                },
                "preview_pages": preview_pages
            }
        else:
            # Roll Mode
            specs = build_roll_specs(req.items)
            res = MeterSegmentPacker.pack_multi_artworks(
                roll_width_mm=req.sheet_w,
                segment_limit_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap,
                artworks=specs
            )
            
            preview_pages = []
            for seg in res.segments:
                placed_list = getattr(seg, 'placed_items', getattr(seg, 'items', []))
                seg_length = getattr(seg, 'length_mm', getattr(seg, 'segment_length_mm', req.sheet_h))
                
                apply_alignment(placed_list, req.sheet_w, seg_length, req.margin, req.align)
                
                boxes = []
                for placed in placed_list:
                    file_id = getattr(placed, 'file_id', '')
                    page_num = getattr(placed, 'page_num', 0)
                    boxes.append({
                        "x": placed.x_mm, "y": placed.y_mm, "w": placed.w_mm, "h": placed.h_mm,
                        "rotated": getattr(placed, 'rotated', False),
                        "file_id": file_id,
                        "page_num": page_num,
                        "page_label": f"P. {page_num + 1}",
                        "thumb": f"/api/imposing/thumbnail/{file_id}/{page_num}",
                        "keep_aspect": placed.keep_aspect,
                        "fill_color": placed.fill_color
                    })
                preview_pages.append({
                    "w": req.sheet_w, "h": seg_length, "boxes": boxes
                })
                    
            return {
                "success": True,
                "stats": {
                    "total_length_m": round(res.total_roll_length_mm / 1000.0, 2),
                    "segments": len(res.segments),
                    "avg_efficiency": round(res.total_used_item_m2 / res.total_invoiced_m2 * 100, 1) if res.total_invoiced_m2 > 0 else 0
                },
                "preview_pages": preview_pages
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/imposing/export")
def export_imposing(req: ImposingRequest):
    try:
        out_path = f"temp_uploads/imposing_export_{uuid.uuid4().hex[:8]}.pdf"
        
        if req.mode == "Sheet":
            specs = build_sheet_specs(req.items)
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs, allow_rotation=req.auto_rotate_sheet,
                uniform_orientation=req.uniform_orientation,
                job_mode=req.job_mode
            )
            
            for res in results:
                apply_alignment(res.placed_items, req.sheet_w, req.sheet_h, req.margin, req.align)
            
            SheetGangExporter.export_pdf(
                sheet_results=results,
                output_pdf_path=out_path,
                show_crop_marks=req.crop_marks,
                show_reg_marks=False,
                draw_cut_contour=False,
                draw_border=req.draw_border,
                border_color=req.border_color
            )
        else:
            specs = build_roll_specs(req.items)
            res = MeterSegmentPacker.pack_multi_artworks(
                roll_width_mm=req.sheet_w, segment_limit_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs
            )
            
            doc = fitz.open()
            for seg in res.segments:
                placed_list = getattr(seg, 'placed_items', getattr(seg, 'items', []))
                seg_length = getattr(seg, 'length_mm', getattr(seg, 'segment_length_mm', req.sheet_h))
                
                apply_alignment(placed_list, req.sheet_w, seg_length, req.margin, req.align)
                
                page = doc.new_page(width=(req.sheet_w / 25.4 * 72.0), height=(seg_length / 25.4 * 72.0))
                shape = page.new_shape()

                def hex_to_rgb(h):
                    h = h.lstrip('#')
                    return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4)) if len(h)==6 else (0,0,0)

                for placed in placed_list:
                    try:
                        file_id = getattr(placed, 'file_id', '')
                        file_path = f"temp_uploads/{file_id}" if file_id else f"temp_uploads/{req.items[0].file_id}"
                        rect = fitz.Rect(
                            placed.x_mm / 25.4 * 72.0,
                            placed.y_mm / 25.4 * 72.0,
                            (placed.x_mm + placed.w_mm) / 25.4 * 72.0,
                            (placed.y_mm + placed.h_mm) / 25.4 * 72.0
                        )
                        
                        if placed.keep_aspect:
                            shape.draw_rect(rect)
                            shape.finish(color=None, fill=hex_to_rgb(placed.fill_color))
                            shape.commit()
                            shape = page.new_shape()

                        ext = file_path.lower().split('.')[-1]
                        if ext in ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'avif', 'webp']:
                            if ext in ['avif', 'webp']:
                                import cv2
                                img = cv2.imread(file_path)
                                if img is not None:
                                    success, encoded = cv2.imencode('.png', img)
                                    if success:
                                        page.insert_image(rect, stream=encoded.tobytes(), keep_proportion=placed.keep_aspect)
                            else:
                                page.insert_image(rect, filename=file_path, keep_proportion=placed.keep_aspect)
                        else:
                            src_doc = fitz.open(file_path)
                            page_idx = min(max(0, getattr(placed, 'page_num', 0)), len(src_doc) - 1)
                            src_page = src_doc[page_idx]
                            page.show_pdf_page(rect, src_doc, page_idx, clip=src_page.rect, keep_proportion=placed.keep_aspect)
                            src_doc.close()
                    except Exception as e:
                        print(f"Roll export render error: {e}")
                        pass
                    
                    if req.draw_border:
                        shape.draw_rect(rect)
                        shape.finish(color=hex_to_rgb(req.border_color), width=1.0, stroke_opacity=1.0)
                        
                    if req.crop_marks:
                        off = 1.5 * (72.0 / 25.4)
                        mlen = 3.0 * (72.0 / 25.4)
                        ix_pt, iy_pt = rect.x0, rect.y0
                        iw_pt, ih_pt = rect.width, rect.height
                        shape.draw_line(fitz.Point(ix_pt - off, iy_pt), fitz.Point(ix_pt - off - mlen, iy_pt))
                        shape.draw_line(fitz.Point(ix_pt, iy_pt - off), fitz.Point(ix_pt, iy_pt - off - mlen))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt - off), fitz.Point(ix_pt + iw_pt, iy_pt - off - mlen))
                        shape.draw_line(fitz.Point(ix_pt - off, iy_pt + ih_pt), fitz.Point(ix_pt - off - mlen, iy_pt + ih_pt))
                        shape.draw_line(fitz.Point(ix_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt, iy_pt + ih_pt + off + mlen))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt + off, iy_pt + ih_pt), fitz.Point(ix_pt + iw_pt + off + mlen, iy_pt + ih_pt))
                        shape.draw_line(fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off), fitz.Point(ix_pt + iw_pt, iy_pt + ih_pt + off + mlen))
                        shape.finish(color=(0, 0, 0), width=0.2, stroke_opacity=1.0)
                    shape.commit()
            doc.save(out_path)
            
        return FileResponse(out_path, filename="Imposed_Print_File.pdf", media_type="application/pdf")
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/imposing/export-svg")
def export_imposing_svg(req: ImposingRequest):
    try:
        page_idx = req.page_index if req.page_index is not None else 0
        out_path = f"temp_uploads/imposing_export_{uuid.uuid4().hex[:8]}.svg"

        if req.mode == "Sheet":
            specs = build_sheet_specs(req.items)
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs, allow_rotation=req.auto_rotate_sheet,
                uniform_orientation=req.uniform_orientation,
                job_mode=req.job_mode
            )

            if not results:
                return {"success": False, "error": "No sheets generated."}

            for res in results:
                apply_alignment(res.placed_items, req.sheet_w, req.sheet_h, req.margin, req.align)

            target_idx = min(max(0, page_idx), len(results) - 1)
            target_sheet = results[target_idx]

            SheetGangExporter.export_svg(
                sheet=target_sheet,
                output_svg_path=out_path,
                show_crop_marks=req.crop_marks,
                show_reg_marks=False,
                draw_border=req.draw_border,
                border_color=req.border_color
            )
            download_name = f"Imposed_Cut_Sheet_{target_idx + 1}.svg" if len(results) > 1 else "Imposed_Cut_Sheet.svg"
        else:
            specs = build_roll_specs(req.items)
            res = MeterSegmentPacker.pack_multi_artworks(
                roll_width_mm=req.sheet_w, segment_limit_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs
            )

            if not res.segments:
                return {"success": False, "error": "No roll segments generated."}

            target_idx = min(max(0, page_idx), len(res.segments) - 1)
            seg = res.segments[target_idx]
            placed_list = getattr(seg, 'placed_items', getattr(seg, 'items', []))
            seg_length = getattr(seg, 'length_mm', getattr(seg, 'segment_length_mm', req.sheet_h))

            apply_alignment(placed_list, req.sheet_w, seg_length, req.margin, req.align)

            placed_sheet_items = []
            for idx, placed in enumerate(placed_list):
                file_id = getattr(placed, 'file_id', '') or req.items[0].file_id
                placed_sheet_items.append(PlacedSheetItem(
                    item_id=idx,
                    name=placed.name,
                    sheet_index=target_idx,
                    x_mm=placed.x_mm,
                    y_mm=placed.y_mm,
                    w_mm=placed.w_mm,
                    h_mm=placed.h_mm,
                    rotated=getattr(placed, 'rotated', False),
                    pdf_path=f"temp_uploads/{file_id}",
                    keep_aspect=getattr(placed, 'keep_aspect', False),
                    fill_color=getattr(placed, 'fill_color', '#FFFFFF'),
                    page_num=getattr(placed, 'page_num', 0),
                    file_id=file_id
                ))

            target_sheet = SingleSheetResult(
                sheet_index=target_idx,
                sheet_w_mm=req.sheet_w,
                sheet_h_mm=seg_length,
                placed_items=placed_sheet_items
            )

            SheetGangExporter.export_svg(
                sheet=target_sheet,
                output_svg_path=out_path,
                show_crop_marks=req.crop_marks,
                show_reg_marks=False,
                draw_border=req.draw_border,
                border_color=req.border_color
            )
            download_name = f"Imposed_Cut_Segment_{target_idx + 1}.svg" if len(res.segments) > 1 else "Imposed_Cut_Segment.svg"

        return FileResponse(out_path, filename=download_name, media_type="image/svg+xml")
    except Exception as e:
        return {"success": False, "error": str(e)}


