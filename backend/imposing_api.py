import os
import re
import time
import uuid
import threading
from fastapi import APIRouter, UploadFile, File, Form, Body, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session as DBSession
from db.session import get_db, SessionLocal
from db.repository import SessionRepository
from engines.sheet_packer import MaxRectsSheetPacker, SingleSheetResult, PlacedSheetItem
from engines.roll_packer import MeterSegmentPacker
from engines.sheet_gang_exporter import SheetGangExporter
from engines.schemas import ImposingRequest
from engines.imposing_prep import (
    apply_alignment,
    build_imposing_pages_meta,
    build_roll_specs,
    build_sheet_specs,
    effective_page_rotation,
)
from engines.thumbnails import get_dimensions_mm, resolve_temp_file
from storage.asset_store import asset_store


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
    from engines.thumbnails import pregen_pdf_thumbnails
    stem = os.path.splitext(file_id_ext)[0]
    pregen_pdf_thumbnails(file_path, stem, page_count)

@router.post("/api/imposing/upload")
async def upload_imposing_file(file: UploadFile = File(...)):
    try:
        from main import evict_stale_caches
        evict_stale_caches()
    except ImportError:
        pass
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    if not ext: ext = ".pdf"
    file_id_ext = f"{file_id}{ext}"
    _, file_path = asset_store.save_original(file_id_ext, await file.read())
    
    page_count = 1
    w, h = 100.0, 100.0
    thumb_path = asset_store.get_thumbnail_cache_path("imposing", f"{file_id}_thumb_p0")
    pages_meta = []
    
    if ext == ".pdf":
        try:
            w, h, page_count, pages_meta = build_imposing_pages_meta(file_path, file_id_ext)
            if page_count > 0:
                from engines.thumbnails import render_pdf_thumb
                render_pdf_thumb(file_path, thumb_path, page_num=0)

            if page_count > 1:
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
            pages_meta = [{
                "page_num": 0,
                "width_mm": round(w, 2),
                "height_mm": round(h, 2),
                "aspect_ratio": round(w / h, 3) if h > 0 else 1.0,
                "thumb_url": f"/api/imposing/thumbnail/{file_id_ext}/0"
            }]
    else:
        w, h, page_count, pages_meta = build_imposing_pages_meta(file_path, file_id_ext)
        try:
            from engines.thumbnails import render_image_thumb
            render_image_thumb(file_path, thumb_path)
        except Exception:
            thumb_path = ""

    return {
        "success": True,
        "file_id": file_id_ext,
        "name": file.filename,
        "w": round(w, 2),
        "h": round(h, 2),
        "page_count": page_count,
        "is_book": page_count > 1,
        "thumb": f"/api/imposing/thumbnail/{file_id_ext}/0",
        "pages": pages_meta
    }


@router.post("/api/imposing/init-session")
async def init_imposing_session(
    file: Optional[UploadFile] = File(None),
    existing_file_path: Optional[str] = Form(None),
    file_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    original_filename: Optional[str] = Form(None),
    job_mode: str = Form("book"),
    sheet_w: float = Form(320.0),
    sheet_h: float = Form(450.0),
    sheet_preset: str = Form("320,450"),
    db: DBSession = Depends(get_db),
):
    """
    Initializes a persistent, database-backed Imposing Studio session in SQLite WAL.
    Supports new file upload or intake from existing staged asset / path.
    """
    try:
        from main import evict_stale_caches
        evict_stale_caches()
    except ImportError:
        pass

    file_size = 0
    if file:
        file_id_raw = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1].lower() or ".pdf"
        file_id_ext = f"{file_id_raw}{ext}"
        content = await file.read()
        file_size = len(content)
        _, file_path = asset_store.save_original(file_id_ext, content)
        file_name = file.filename
    elif existing_file_path and os.path.exists(existing_file_path):
        file_path = existing_file_path
        file_id_ext = os.path.basename(file_path)
        file_name = original_filename or re.sub(r"^\d+_", "", file_id_ext)
        file_size = os.path.getsize(file_path)
    elif file_id:
        resolved = resolve_temp_file(file_id)
        if not resolved or not os.path.exists(resolved):
            raise HTTPException(status_code=404, detail="Referenced file not found on disk")
        file_path = resolved
        file_id_ext = os.path.basename(file_path)
        file_name = original_filename or file_id_ext
        file_size = os.path.getsize(file_path)
    else:
        raise HTTPException(status_code=400, detail="No file or existing file reference provided")

    session_id = str(uuid.uuid4())
    session_dir = asset_store.get_session_dir(session_id)
    os.makedirs(session_dir, exist_ok=True)

    w, h, page_count, pages_meta = build_imposing_pages_meta(file_path, file_id_ext)
    thumb_path = asset_store.get_thumbnail_cache_path("imposing", f"{os.path.splitext(file_id_ext)[0]}_thumb_p0")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        if page_count > 0:
            from engines.thumbnails import render_pdf_thumb
            render_pdf_thumb(file_path, thumb_path, page_num=0)
        if page_count > 1:
            t = threading.Thread(
                target=_pregen_all_thumbnails,
                args=(file_path, file_id_ext, page_count),
                daemon=True,
                name=f"thumb-pregen-{file_id_ext[:8]}"
            )
            t.start()
    else:
        try:
            from engines.thumbnails import render_image_thumb
            render_image_thumb(file_path, thumb_path)
        except Exception:
            pass

    pages_data = []
    for p in pages_meta:
        pages_data.append({
            "id": f"{file_id_ext}_p{p['page_num']}_{uuid.uuid4().hex[:6]}",
            "page_number": p["page_num"],
            "original_w_mm": p.get("width_mm", w),
            "original_h_mm": p.get("height_mm", h),
            "rotation_deg": 0,
            "is_deleted": False,
            "applied_layers": {},
        })

    is_book = page_count > 1
    actual_job_mode = job_mode if job_mode in ("book", "gang") else ("book" if is_book else "gang")
    clean_title = title or original_filename or file_name

    initial_settings = {
        "job_mode": actual_job_mode,
        "sheet_w": sheet_w,
        "sheet_h": sheet_h,
        "sheet_preset": sheet_preset,
        "margin": 10.0,
        "gap": 5.0,
        "crop_marks": True,
        "reg_marks": False,
        "draw_border": False,
        "border_color": "#000000",
        "align": "Center",
        "rows": None,
        "cols": None,
        "items": [{
            "file_id": file_id_ext,
            "name": file_name,
            "w": round(w, 2),
            "h": round(h, 2),
            "copies": 1,
            "ratio": round(w / h, 3) if h > 0 else 1.0,
            "locked": True,
            "keep_aspect": False,
            "fill_color": "#FFFFFF",
            "original_w": round(w, 2),
            "original_h": round(h, 2),
            "page_count": page_count,
            "is_book": is_book,
            "page_range": "all",
            "fit_mode": "stretch",
            "page_rotation": "cw" if is_book else "none",
            "bleed_mode": "none",
            "bleed_mm": 0.0,
            "bleed_color": "#FFFFFF",
            "bleed_type": "outside",
        }],
    }

    session = SessionRepository.create_session(
        db=db,
        session_id=session_id,
        studio_type="imposing",
        intake_mode="single",
        is_spread=False,
        session_dir=session_dir,
        title=clean_title,
        original_filename=file_name,
        file_size_bytes=file_size,
        tag="in-progress",
        notes="",
        pages_data=pages_data,
        settings=initial_settings,
    )

    formatted_pages = []
    for p in session.pages:
        formatted_pages.append({
            "id": p.id,
            "file_id": file_id_ext,
            "name": file_name,
            "original_page_num": p.page_number,
            "display_page_num": p.page_number + 1,
            "w": p.original_w_mm,
            "h": p.original_h_mm,
            "rotation": p.rotation_deg,
            "is_deleted": p.is_deleted,
            "thumb_url": f"/api/imposing/thumbnail/{file_id_ext}/{p.page_number}",
        })

    return {
        "success": True,
        "session_id": session.id,
        "file_id": file_id_ext,
        "name": file_name,
        "title": clean_title,
        "w": round(w, 2),
        "h": round(h, 2),
        "page_count": page_count,
        "is_book": is_book,
        "thumb": f"/api/imposing/thumbnail/{file_id_ext}/0",
        "settings": initial_settings,
        "items": initial_settings["items"],
        "pages": formatted_pages,
    }


@router.get("/api/imposing/session/{session_id}")
def get_imposing_session(session_id: str, db: DBSession = Depends(get_db)):
    """Loads a persistent Imposing Studio session from SQLite WAL."""
    session = SessionRepository.get_session(db, session_id)
    if not session or session.status == "trash":
        raise HTTPException(status_code=404, detail="Imposing session not found or moved to trash")

    items = session.settings.get("items", [])
    file_id = items[0]["file_id"] if items else (session.original_filename or "")
    clean_name = session.original_filename or session.title or "Untitled Asset"

    pages_list = []
    for p in session.pages:
        pages_list.append({
            "id": p.id,
            "file_id": file_id,
            "name": clean_name,
            "original_page_num": p.page_number,
            "display_page_num": p.page_number + 1,
            "w": p.original_w_mm,
            "h": p.original_h_mm,
            "rotation": p.rotation_deg,
            "is_deleted": p.is_deleted,
            "thumb_url": f"/api/imposing/thumbnail/{file_id}/{p.page_number}",
        })

    return {
        "success": True,
        "session_id": session.id,
        "studio_type": session.studio_type,
        "title": session.title,
        "original_filename": session.original_filename,
        "tag": session.tag,
        "status": session.status,
        "settings": session.settings or {},
        "items": items,
        "pages": pages_list,
    }


@router.patch("/api/imposing/session/{session_id}")
def update_imposing_session(
    session_id: str,
    payload: Dict[str, Any] = Body(...),
    db: DBSession = Depends(get_db),
):
    """Saves imposing settings and deck updates into SQLite WAL."""
    session = SessionRepository.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Imposing session not found")

    settings = dict(session.settings or {})
    if "settings" in payload and isinstance(payload["settings"], dict):
        settings.update(payload["settings"])
    if "items" in payload:
        settings["items"] = payload["items"]
    session.settings = settings

    if "pages" in payload and isinstance(payload["pages"], list):
        page_map = {p.id: p for p in session.pages}
        for idx, page_update in enumerate(payload["pages"]):
            pid = page_update.get("id")
            if pid in page_map:
                pm = page_map[pid]
                pm.sort_order = idx
                if "rotation" in page_update:
                    pm.rotation_deg = int(page_update["rotation"])
                if "is_deleted" in page_update:
                    pm.is_deleted = bool(page_update["is_deleted"])

    session.updated_at = time.time()
    db.commit()
    db.refresh(session)
    return {"success": True, "session_id": session.id, "updated_at": session.updated_at}

@router.get("/api/imposing/pages/{file_id}")
def get_imposing_file_pages(file_id: str):
    file_path = resolve_temp_file(file_id)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    file_id_ext = os.path.basename(file_path)
    try:
        _w, _h, page_count, pages_meta = build_imposing_pages_meta(file_path, file_id_ext)
        return {
            "success": True,
            "file_id": file_id_ext,
            "page_count": page_count,
            "pages": pages_meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect PDF: {str(e)}")

def resolve_temp_file(file_id: str) -> Optional[str]:
    from engines.thumbnails import resolve_temp_file as _resolve
    return _resolve(file_id)

def _cleanup_export_file(path: str) -> None:
    """BackgroundTasks callback: removes single-use export files after download."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        pass

@router.get("/api/imposing/thumbnail/{file_id}/{page_num}")
def get_imposing_thumbnail(file_id: str, page_num: int):
    safe_file_id = os.path.basename(file_id)
    stem = os.path.splitext(safe_file_id)[0]
    thumb_path = asset_store.get_thumbnail_cache_path("imposing", f"{stem}_thumb_p{page_num}")
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    legacy_thumb = os.path.join("temp_uploads", f"{stem}_thumb_p{page_num}.jpg")
    if os.path.exists(legacy_thumb):
        return FileResponse(legacy_thumb, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    src_path = resolve_temp_file(file_id)
    if not src_path or not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="File not found")

    actual_stem = os.path.splitext(os.path.basename(src_path))[0]
    actual_thumb_path = asset_store.get_thumbnail_cache_path("imposing", f"{actual_stem}_thumb_p{page_num}")
    if os.path.exists(actual_thumb_path):
        return FileResponse(actual_thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    ext = os.path.splitext(src_path)[1].lower()
    if ext == ".pdf":
        try:
            from engines.thumbnails import render_pdf_thumb
            # High-fidelity preview resolution (approx 150 DPI, 0.72 scale; clamped internally)
            render_pdf_thumb(src_path, thumb_path, page_num=page_num)
            if actual_thumb_path != thumb_path:
                render_pdf_thumb(src_path, actual_thumb_path, page_num=page_num)
            return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate page thumbnail: {e}")
    else:
        try:
            from engines.thumbnails import render_image_thumb
            render_image_thumb(src_path, thumb_path)
            if actual_thumb_path != thumb_path:
                render_image_thumb(src_path, actual_thumb_path)
            return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image thumbnail error: {e}")

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
                job_mode=req.job_mode,
                rows=req.rows or 0,
                cols=req.cols or 0
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

                        # Opposing-orientation gate lives in engines (no fitz/cv2 in router)
                        raw_user_rot = getattr(placed, "page_rotation", "none")
                        target_w = getattr(placed, "target_w_mm", 0.0) or (placed.h_mm if placed.rotated else placed.w_mm)
                        target_h = getattr(placed, "target_h_mm", 0.0) or (placed.w_mm if placed.rotated else placed.h_mm)
                        pdf_path_val = placed.pdf_path or f"temp_uploads/{file_id}"
                        eff_user_rot = effective_page_rotation(
                            pdf_path_val, page_num, raw_user_rot,
                            target_w, target_h, open_docs,
                        )

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
def export_imposing(req: ImposingRequest, background_tasks: BackgroundTasks):
    try:
        out_path = asset_store.get_export_path(f"imposing_export_{uuid.uuid4().hex[:8]}", "pdf")
        
        if req.mode == "Sheet":
            specs = build_sheet_specs(req.items)
            results = MaxRectsSheetPacker.pack_sheets(
                sheet_w_mm=req.sheet_w, sheet_h_mm=req.sheet_h,
                margin_l_mm=req.margin, margin_r_mm=req.margin,
                margin_t_mm=req.margin, margin_b_mm=req.margin,
                gap_mm=req.gap, artworks=specs, allow_rotation=req.auto_rotate_sheet,
                uniform_orientation=req.uniform_orientation,
                job_mode=req.job_mode,
                rows=req.rows or 0,
                cols=req.cols or 0
            )
            
            for res in results:
                apply_alignment(res.placed_items, req.sheet_w, req.sheet_h, req.margin, req.align)
            
            SheetGangExporter.export_pdf(
                sheet_results=results,
                output_pdf_path=out_path,
                show_crop_marks=req.crop_marks,
                show_reg_marks=req.reg_marks,
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
            
            SheetGangExporter.export_roll_pdf(
                roll_result=res,
                output_pdf_path=out_path,
                sheet_w_mm=req.sheet_w,
                fallback_sheet_h_mm=req.sheet_h,
                default_file_id=req.items[0].file_id if req.items else None,
                margin_mm=req.margin,
                align=req.align,
                draw_border=req.draw_border,
                border_color=req.border_color,
                show_crop_marks=req.crop_marks,
            )

        background_tasks.add_task(_cleanup_export_file, out_path)
        timestamp_str = time.strftime("%Y%m%d_%H%M%S")

        # Database integration: update session to done/archived and log export job
        clean_name = "Imposed_Sheet"
        if req.items and req.items[0].name:
            clean_name = os.path.splitext(req.items[0].name)[0].replace(" ", "_")
        
        session_short = (req.session_id[:8]) if req.session_id else uuid.uuid4().hex[:8]
        export_filename = f"{timestamp_str}_{clean_name}_{session_short}.pdf"

        if req.session_id:
            try:
                with SessionLocal() as db:
                    SessionRepository.update_session_meta(
                        db, session_id=req.session_id, tag="done", status="archived"
                    )
                    file_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
                    job_id = f"job_exp_{uuid.uuid4().hex[:12]}"
                    SessionRepository.create_or_update_export_job(
                        db=db,
                        job_id=job_id,
                        session_id=req.session_id,
                        status="completed",
                        stage="done",
                        progress=100.0,
                        message="Imposed PDF export generated successfully",
                        output_file_path=out_path,
                        file_size_bytes=file_size,
                    )
            except Exception as db_err:
                print(f"Warning: Failed to update session/export_job in DB: {db_err}")

        return FileResponse(out_path, filename=export_filename, media_type="application/pdf")
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/imposing/export-svg")
def export_imposing_svg(req: ImposingRequest, background_tasks: BackgroundTasks):
    try:
        page_idx = req.page_index if req.page_index is not None else 0
        out_path = asset_store.get_export_path(f"imposing_export_{uuid.uuid4().hex[:8]}", "svg")

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
                show_reg_marks=req.reg_marks,
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
                    pdf_path=resolve_temp_file(file_id) or f"temp_uploads/{file_id}",
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
                show_reg_marks=req.reg_marks,
                draw_border=req.draw_border,
                border_color=req.border_color
            )
            download_name = f"Imposed_Cut_Segment_{target_idx + 1}.svg" if len(res.segments) > 1 else "Imposed_Cut_Segment.svg"

        background_tasks.add_task(_cleanup_export_file, out_path)
        return FileResponse(out_path, filename=download_name, media_type="image/svg+xml")
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/imposing/ocr-inspect")
def ocr_inspect_page(payload: Dict[str, Any] = Body(...)):
    """Inspects a page for vector text or runs Arabic & English OCR."""
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    file_path = resolve_temp_file(file_id)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    page_num = int(payload.get("page_num", 0))
    languages = str(payload.get("languages", "ara+eng"))

    from engines.ocr_engine import extract_page_ocr
    result = extract_page_ocr(file_path, page_num=page_num, languages=languages)
    return result



