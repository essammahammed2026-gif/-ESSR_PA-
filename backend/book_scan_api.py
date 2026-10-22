import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional, Dict, Any
from engines.book_scan_engine import BookScanEngine, PageOpError
from engines.schemas import (
    SessionInitResponse, ReorderRequest, PageRotateRequest, ProcessPageRequest,
    CropBoxModel, SplitSpreadRequest, RevertSpreadRequest, CropPageRequest,
    BatchDetectCropRequest, BatchDetectAngleRequest, PageDeskewRequest,
    MaskPageRequest, PageColorModeRequest,
    ExportRequest, DuplicatePageRequest, InsertBlankPageRequest, RestorePagesRequest,
)

import time

router = APIRouter(prefix="/api/book-scan", tags=["Book Scan Studio"])

TEMP_DIR = "temp_uploads/book_scans"
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory session store & TTL tracking
SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TIMESTAMPS: Dict[str, float] = {}
SESSION_TTL_SECONDS = 7200  # 2 hours

# Export jobs tracking
EXPORT_JOBS: Dict[str, Dict[str, Any]] = {}

def evict_stale_sessions():
    now = time.time()
    stale_ids = [sid for sid, ts in SESSION_TIMESTAMPS.items() if now - ts > SESSION_TTL_SECONDS]
    for sid in stale_ids:
        SESSION_TIMESTAMPS.pop(sid, None)
        sess = SESSIONS.pop(sid, None)
        if sess and "session_dir" in sess:
            cleanup_session_dir(sess["session_dir"])
    stale_jobs = [jid for jid, j in EXPORT_JOBS.items() if now - j.get("created_at", now) > SESSION_TTL_SECONDS]
    for jid in stale_jobs:
        EXPORT_JOBS.pop(jid, None)

def cleanup_session_dir(session_dir: str):
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)

@router.post("/init-session")
async def init_book_scan_session(
    mode: str = Form("single"),         # 'single', 'dual', or 'multi_merge'
    is_spread: bool = Form(False),     # False by default (treat as-is)
    odds_order: str = Form("forward"), # 'forward' or 'reverse'
    evens_order: str = Form("reverse"),# 'reverse' or 'forward'
    spread_split_pos: float = Form(0.5),
    start_with: str = Form("odds"),    # 'odds' or 'evens'
    file_odds: Optional[UploadFile] = File(None),
    file_evens: Optional[UploadFile] = File(None),
    file_single: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    reverse_file_indices: Optional[str] = Form(None),
    existing_file_path: Optional[str] = Form(None),
):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    odds_path = None
    evens_path = None
    single_path = None

    if mode == "dual":
        if not file_odds or not file_evens:
            if files and len(files) >= 2:
                file_odds = files[0]
                file_evens = files[1]
            else:
                raise HTTPException(status_code=400, detail="Both Odds and Evens PDF files are required in dual mode.")
        odds_path = os.path.join(session_dir, f"odds_{file_odds.filename}")
        evens_path = os.path.join(session_dir, f"evens_{file_evens.filename}")
        with open(odds_path, "wb") as f:
            shutil.copyfileobj(file_odds.file, f)
        with open(evens_path, "wb") as f:
            shutil.copyfileobj(file_evens.file, f)

        pages = BookScanEngine.collate_from_paths(
            odds_path=odds_path,
            evens_path=evens_path,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos,
            start_with=start_with,
        )
    elif mode == "multi_merge" or (files and len(files) > 1):
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="Please upload at least one file to merge.")
        saved_paths = []
        for idx, upload in enumerate(files):
            clean_name = f"{idx}_{upload.filename}"
            save_path = os.path.join(session_dir, clean_name)
            with open(save_path, "wb") as f:
                shutil.copyfileobj(upload.file, f)
            saved_paths.append(save_path)

        rev_indices_set = set()
        if reverse_file_indices:
            for token in reverse_file_indices.split(","):
                token = token.strip()
                if token.isdigit():
                    rev_indices_set.add(int(token))

        combined_pdf_path = os.path.join(session_dir, "combined_book.pdf")
        if BookScanEngine.combine_files_to_pdf(saved_paths, combined_pdf_path, reverse_indices=rev_indices_set):
            single_path = combined_pdf_path
        elif len(saved_paths) == 1 and saved_paths[0].lower().endswith(".pdf"):
            single_path = saved_paths[0]
        else:
            raise HTTPException(status_code=500, detail="Failed to combine uploaded files into document.")

        pages = BookScanEngine.collate_from_paths(
            single_path=single_path,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos,
        )
    else:
        if not file_single and not existing_file_path:
            if files and len(files) == 1:
                file_single = files[0]
            else:
                raise HTTPException(status_code=400, detail="Please upload at least one file.")
        if file_single:
            single_path = os.path.join(session_dir, f"single_{file_single.filename}")
            with open(single_path, "wb") as f:
                shutil.copyfileobj(file_single.file, f)
            if not single_path.lower().endswith(".pdf"):
                combined_pdf_path = os.path.join(session_dir, "single_converted.pdf")
                if BookScanEngine.combine_files_to_pdf([single_path], combined_pdf_path):
                    single_path = combined_pdf_path
        else:
            if not os.path.exists(existing_file_path):
                raise HTTPException(status_code=404, detail="Referenced file does not exist on server.")
            single_path = existing_file_path

        pages = BookScanEngine.collate_from_paths(
            single_path=single_path,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos,
        )
    evict_stale_sessions()
    SESSION_TIMESTAMPS[session_id] = time.time()

    SESSIONS[session_id] = {
        "mode": mode,
        "is_spread": is_spread,
        "odds_order": odds_order,
        "evens_order": evens_order,
        "start_with": start_with,
        "spread_split_pos": spread_split_pos,
        "odds_path": odds_path,
        "evens_path": evens_path,
        "single_path": single_path,
        "pages": pages,
        "session_dir": session_dir
    }

    return {
        "session_id": session_id,
        "mode": mode,
        "is_spread": is_spread,
        "total_pages": len(pages),
        "pages": pages
    }

@router.get("/page-thumbnail/{session_id}/{page_id}")
async def get_page_thumbnail(
    session_id: str,
    page_id: str,
    preview_clean: bool = False,
    clean_borders: bool = False,
    border_margin_px: int = 15,
    border_threshold: int = 210,
    enhance_colors: bool = True,
    saturation: float = 1.30,
    contrast: float = 1.10,
    color_mode: str = "color",
    bw_threshold: int = 180,
    whiten_bg: bool = False,
    deskew: bool = False,
    dpi: int = 100,
    deskew_module_enabled: bool = False,
    deskew_mode: str = "auto",
    deskew_angle: float = 0.0,
    deskew_max_angle: float = 10.0,
    deskew_ignore_borders: bool = True,
    bleed_mm: float = 0.0,
    bleed_mode: str = "mirror",
    bleed_color: str = "#ffffff",
    bleed_placement: str = "outside",
    show_crop_marks: bool = False,
    flatten_illumination: bool = False,
    despeckle_level: int = 0,
    rev: int = 0,
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    # Disk cache tag with complete state configuration.
    # `rev` busts browser + disk caches after in-place mutations (crop/rotate)
    # that keep the same page id with otherwise identical geometry tags.
    rot = page_info.get("rotation", 0)
    half = page_info.get("half", "full")
    sp = int(page_info.get("spread_split_pos", page_info.get("split_pos", 0.5)) * 1000)
    masks_list = (page_info.get("masks") or []) if preview_clean else []
    eff_color_mode = (page_info.get("color_mode") if preview_clean else None) or color_mode
    mask_sig = "_".join(
        f"{m.get('id','')}:{int(float(m.get('x1',0))*100)}-{int(float(m.get('y1',0))*100)}-{str(m.get('color') or m.get('fill') or 'ffffff').lstrip('#')}"
        for m in masks_list
    )
    cache_tag = f"thumb_{page_id}_{half}_{sp}_{rot}_{preview_clean}_{dpi}_r{rev}_m{len(masks_list)}_{mask_sig}"
    cb = page_info.get("crop_box")
    if cb:
        cache_tag += f"_cb_{int(cb.get('x1', 0)*1000)}_{int(cb.get('y1', 0)*1000)}_{int(cb.get('x2', 1)*1000)}_{int(cb.get('y2', 1)*1000)}"
    scb = page_info.get("spread_crop_box")
    if scb:
        cache_tag += f"_scb_{int(scb.get('x1', 0)*1000)}_{int(scb.get('y1', 0)*1000)}_{int(scb.get('x2', 1)*1000)}_{int(scb.get('y2', 1)*1000)}"
    pcb = page_info.get("page_crop_box")
    if pcb:
        cache_tag += f"_pcb_{int(pcb.get('x1', 0)*1000)}_{int(pcb.get('y1', 0)*1000)}_{int(pcb.get('get_x2', pcb.get('x2', 1))*1000)}_{int(pcb.get('y2', 1)*1000)}"
    sb = page_info.get("slice_box")
    if sb:
        cache_tag += f"_sb_{int(sb.get('x1', 0)*1000)}_{int(sb.get('y1', 0)*1000)}_{int(sb.get('x2', 1)*1000)}_{int(sb.get('y2', 1)*1000)}"

    has_active_processing = (
        clean_borders
        or enhance_colors
        or whiten_bg
        or deskew
        or deskew_module_enabled
        or (page_info.get("deskew_angle") is not None)
        or len(masks_list) > 0
        or flatten_illumination
        or despeckle_level > 0
    )
    if preview_clean and has_active_processing:
        cache_tag += f"_{int(clean_borders)}_{border_margin_px}_{int(enhance_colors)}_{int(saturation*100)}_{int(contrast*100)}_{eff_color_mode}_{bw_threshold}_{int(whiten_bg)}_{int(deskew)}_fi{int(flatten_illumination)}_ds{despeckle_level}"
        if deskew_module_enabled or (page_info.get("deskew_angle") is not None):
            eff_ang = float(page_info["deskew_angle"]) if page_info.get("deskew_angle") is not None else deskew_angle
            cache_tag += f"_dm_{deskew_mode}_{int(eff_ang*100)}_{int(deskew_max_angle)}_{int(deskew_ignore_borders)}"
    if bleed_mm > 0:
        clean_hex = (bleed_color or "#ffffff").lstrip("#")
        cache_tag += f"_bl_{int(bleed_mm*100)}_{bleed_mode}_{clean_hex}_{int(show_crop_marks)}_{bleed_placement}"
    thumb_path = os.path.join(session["session_dir"], f"{cache_tag}.jpg")

    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    doc_map = BookScanEngine.open_session_docs(session)

    try:
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=dpi)
        if preview_clean and has_active_processing:
            eff_deskew_mode = deskew_mode
            eff_deskew_angle = deskew_angle
            if page_info.get("deskew_angle") is not None:
                eff_deskew_mode = "manual"
                eff_deskew_angle = float(page_info["deskew_angle"])
            proc_img = BookScanEngine.process_single_page(
                raw_img,
                clean_borders=clean_borders,
                border_margin_px=border_margin_px,
                border_threshold=border_threshold,
                enhance_colors=enhance_colors,
                saturation=saturation,
                contrast=contrast,
                color_mode=eff_color_mode if enhance_colors else "original",
                bw_threshold=bw_threshold,
                whiten_bg=whiten_bg,
                deskew=deskew,
                sharpen=enhance_colors,
                deskew_module_enabled=deskew_module_enabled or (page_info.get("deskew_angle") is not None),
                deskew_mode=eff_deskew_mode,
                deskew_angle=eff_deskew_angle,
                deskew_max_angle=deskew_max_angle,
                deskew_ignore_borders=deskew_ignore_borders,
                masks=masks_list,
                flatten_illumination=flatten_illumination,
                despeckle_level=despeckle_level,
            )
        else:
            proc_img = raw_img

        if bleed_mm > 0:
            h_px, w_px = proc_img.shape[:2]
            w_mm_val = float(page_info.get("width_mm") or 0.0)
            px_per_mm = (w_px / w_mm_val) if w_mm_val > 0 else (dpi / 25.4)
            bleed_px = int(round(max(0.0, float(bleed_mm)) * px_per_mm))
            proc_img = BookScanEngine.apply_bleed_to_image(
                proc_img,
                bleed_px=bleed_px,
                bleed_mode=bleed_mode,
                bleed_color=bleed_color,
                draw_crop_marks=show_crop_marks,
                placement=bleed_placement,
            )


        os.makedirs(session["session_dir"], exist_ok=True)
        if not BookScanEngine.write_thumbnail_jpg(proc_img, thumb_path, quality=80):
            raise HTTPException(status_code=500, detail="Failed to encode thumbnail.")

        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/reorder/{session_id}")
async def reorder_pages(session_id: str, req: ReorderRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_map = {p["id"]: p for p in session["pages"]}
    new_pages = []
    for pid in req.page_ids:
        if pid in page_map:
            new_pages.append(page_map[pid])

    # Append any unmentioned pages just in case
    for p in session["pages"]:
        if p["id"] not in req.page_ids:
            new_pages.append(p)

    session["pages"] = new_pages
    return {"status": "ok", "pages": session["pages"]}

@router.post("/rotate/{session_id}")
async def rotate_page(session_id: str, req: PageRotateRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_info = next((p for p in session["pages"] if p["id"] == req.page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    page_info["rotation"] = (page_info.get("rotation", 0) + req.rotation_delta) % 360
    if abs(req.rotation_delta) % 180 == 90:
        if "width_mm" in page_info and "height_mm" in page_info:
            page_info["width_mm"], page_info["height_mm"] = page_info["height_mm"], page_info["width_mm"]
        if "orig_width_mm" in page_info and "orig_height_mm" in page_info:
            page_info["orig_width_mm"], page_info["orig_height_mm"] = page_info["orig_height_mm"], page_info["orig_width_mm"]
    try:
        page_info["rev"] = int(page_info.get("rev", 0)) + 1
    except (TypeError, ValueError):
        page_info["rev"] = 1
    return {"status": "ok", "page": page_info}

@router.delete("/page/{session_id}/{page_id}")
async def delete_page(session_id: str, page_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session["pages"] = [p for p in session["pages"] if p["id"] != page_id]
    return {"status": "ok", "remaining": len(session["pages"]), "pages": session["pages"]}

@router.post("/detect-angle/{session_id}/{page_id}")
async def detect_page_angle(
    session_id: str,
    page_id: str,
    max_angle: float = 10.0,
    ignore_borders: bool = True
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    doc_map = BookScanEngine.open_session_docs(session)

    try:
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=100)
        detected_angle = BookScanEngine.detect_skew_angle(
            raw_img,
            max_angle=max_angle,
            ignore_borders=ignore_borders
        )
        page_info["deskew_angle"] = detected_angle
        page_info["rev"] = int(page_info.get("rev", 0)) + 1
        return {
            "status": "ok",
            "page_id": page_id,
            "detected_angle": detected_angle,
            "pages": session["pages"],
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/detect-angle-batch/{session_id}")
async def detect_angle_batch(session_id: str, req: BatchDetectAngleRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    target_set = set(req.target_page_ids) if req.target_page_ids else None
    doc_map = BookScanEngine.open_session_docs(session)
    angles_map: Dict[str, float] = {}

    try:
        for p in session["pages"]:
            pid = p["id"]
            if target_set is not None and pid not in target_set:
                continue
            raw_img = BookScanEngine.extract_page_image(doc_map, p, dpi=100)
            ang = BookScanEngine.detect_skew_angle(
                raw_img,
                max_angle=req.max_angle,
                ignore_borders=req.ignore_borders,
            )
            p["deskew_angle"] = ang
            p["rev"] = int(p.get("rev", 0)) + 1
            angles_map[pid] = ang

        return {
            "status": "ok",
            "angles": angles_map,
            "pages": session["pages"],
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/deskew-page/{session_id}")
async def set_page_deskew(session_id: str, req: PageDeskewRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    BookScanEngine.apply_deskew_to_pages(
        session["pages"],
        page_id=req.page_id,
        angle=req.angle,
        per_page_angles=req.per_page_angles,
        clear_all=req.clear_all,
    )
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/mask-page/{session_id}")
async def mask_page(session_id: str, req: MaskPageRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    BookScanEngine.apply_masks_to_pages(session["pages"], req)
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/color-mode-page/{session_id}")
async def set_page_color_mode(session_id: str, req: PageColorModeRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    BookScanEngine.apply_color_mode_to_pages(
        session["pages"],
        page_id=req.page_id,
        color_mode=req.color_mode,
        target_page_ids=req.target_page_ids,
        clear_all=req.clear_all,
    )
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/detect-crop/{session_id}/{page_id}")
async def detect_page_crop(
    session_id: str,
    page_id: str,
    mode: str = "paper"
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    doc_map = BookScanEngine.open_session_docs(session)

    try:
        # Detect within the CURRENT rendered view (stored crops kept): the
        # returned box is view-relative, matching canvas overlay coordinates.
        # Apply composes it onto the stored box (compose-on-commit).
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=100)
        res = BookScanEngine.detect_book_crop_and_seam(raw_img, mode=mode)
        return {
            "status": "ok",
            "page_id": page_id,
            "crop_box": res["crop_box"],
            "split_pos": res["split_pos"]
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/detect-crop-batch/{session_id}")
async def detect_crop_batch(session_id: str, req: BatchDetectCropRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    target_set = set(req.target_page_ids) if req.target_page_ids else None
    doc_map = BookScanEngine.open_session_docs(session)
    crops_map: Dict[str, Any] = {}

    try:
        for p in session["pages"]:
            pid = p["id"]
            if target_set is not None and pid not in target_set:
                continue
            raw_img = BookScanEngine.extract_page_image(doc_map, p, dpi=100)
            res = BookScanEngine.detect_book_crop_and_seam(raw_img, mode=req.mode)
            crops_map[pid] = {
                "crop_box": res["crop_box"],
                "split_pos": res["split_pos"],
            }
        return {
            "status": "ok",
            "crops": crops_map,
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/split-spread/{session_id}")
async def split_spread(session_id: str, req: SplitSpreadRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.get("pages"):
        raise HTTPException(status_code=400, detail="No pages available in session.")

    target_id = req.page_id or (req.target_page_ids[0] if req.target_page_ids else session["pages"][0]["id"])

    try:
        new_pages, new_selected_id = BookScanEngine.split_pages(
            session["pages"],
            target_id,
            crop_box=req.crop_box.dict() if req.crop_box else None,
            split_pos=req.split_pos,
            split_lines=req.split_lines,
            split_direction=req.split_direction or "vertical",
            apply_to_all=req.apply_to_all,
            target_page_ids=req.target_page_ids,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_selected_id": new_selected_id
    }

@router.post("/revert-spread/{session_id}")
async def revert_spread(session_id: str, req: RevertSpreadRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        new_pages, new_selected_id = BookScanEngine.revert_pages(
            session["pages"],
            page_id=req.page_id,
            revert_all=req.revert_all,
            target_page_ids=req.target_page_ids,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_selected_id": new_selected_id
    }

@router.post("/crop-page/{session_id}")
async def crop_page(session_id: str, req: CropPageRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.get("pages"):
        raise HTTPException(status_code=400, detail="No pages available in session.")

    target_id = req.page_id or (req.target_page_ids[0] if req.target_page_ids else session["pages"][0]["id"])

    BookScanEngine.apply_crop_to_pages(
        session["pages"],
        target_id,
        req.crop_box.dict(),
        apply_to_all=req.apply_to_all,
        target_page_ids=req.target_page_ids,
        per_page_crops=req.per_page_crops,
    )

    return {
        "status": "ok",
        "pages": session["pages"]
    }

@router.post("/restore-pages/{session_id}")
async def restore_pages(session_id: str, req: RestorePagesRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        session["pages"] = BookScanEngine.restore_pages(session["pages"], req.pages)
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"]
    }

def _run_export_job(job_id: str, session_id: str, req: ExportRequest):
    session = SESSIONS.get(session_id)
    if not session:
        EXPORT_JOBS[job_id]["status"] = "failed"
        EXPORT_JOBS[job_id]["error"] = "Session not found or expired."
        EXPORT_JOBS[job_id]["message"] = "Session not found or expired."
        return

    pages = session.get("pages", [])
    total_pages = len(pages)
    EXPORT_JOBS[job_id]["total_pages"] = total_pages
    EXPORT_JOBS[job_id]["status"] = "processing"
    EXPORT_JOBS[job_id]["progress"] = 2
    EXPORT_JOBS[job_id]["stage"] = "processing_pages"
    EXPORT_JOBS[job_id]["message"] = f"Initializing export for {total_pages} page(s)..."

    doc_map = BookScanEngine.open_session_docs(session)
    try:
        def render_progress(cur, total, msg):
            pct = int((cur / max(1, total)) * 60)
            EXPORT_JOBS[job_id]["progress"] = max(2, min(60, pct))
            EXPORT_JOBS[job_id]["current_page"] = cur
            EXPORT_JOBS[job_id]["stage"] = "processing_pages"
            EXPORT_JOBS[job_id]["message"] = msg

        processed_images, per_page_bleed_list = BookScanEngine.render_export_pages(
            doc_map, pages, req, progress_callback=render_progress
        )

        export_fmt = (getattr(req, "export_format", "pdf") or "pdf").lower()
        effective_quality = getattr(req, "quality", 88) or 88

        def bleed_progress(cur, total, msg):
            pct = 60 + int((cur / max(1, total)) * 38)
            EXPORT_JOBS[job_id]["progress"] = max(60, min(98, pct))
            EXPORT_JOBS[job_id]["current_page"] = cur
            EXPORT_JOBS[job_id]["stage"] = "compiling_pdf"
            EXPORT_JOBS[job_id]["message"] = msg

        if export_fmt in ["pdf_split", "jpeg", "jpg", "png", "tiff", "tif"]:
            export_filename = f"cleaned_book_{session_id[:8]}_{export_fmt}.zip"
            output_file_path = os.path.join(session["session_dir"], export_filename)
            media_type = "application/zip"
            success = BookScanEngine.export_pages_archive(
                processed_images=processed_images,
                output_zip_path=output_file_path,
                export_format=export_fmt,
                bleed_mm=req.bleed_mm,
                bleed_mode=req.bleed_mode,
                bleed_color=req.bleed_color,
                show_crop_marks=req.show_crop_marks,
                dpi=req.dpi,
                quality=effective_quality,
                tiff_compression=getattr(req, "tiff_compression", "lzw") or "lzw",
                per_page_bleed=per_page_bleed_list,
                bleed_placement=req.bleed_placement,
                progress_callback=bleed_progress,
            )
        else:
            export_filename = f"cleaned_book_{session_id[:8]}.pdf"
            output_file_path = os.path.join(session["session_dir"], export_filename)
            media_type = "application/pdf"
            success = BookScanEngine.add_bleed_and_export_pdf(
                processed_images=processed_images,
                output_pdf_path=output_file_path,
                bleed_mm=req.bleed_mm,
                bleed_mode=req.bleed_mode,
                bleed_color=req.bleed_color,
                show_crop_marks=req.show_crop_marks,
                dpi=req.dpi,
                jpeg_quality=effective_quality,
                per_page_bleed=per_page_bleed_list,
                bleed_placement=req.bleed_placement,
                progress_callback=bleed_progress,
            )

        if not success or not os.path.exists(output_file_path):
            EXPORT_JOBS[job_id]["status"] = "failed"
            EXPORT_JOBS[job_id]["error"] = "Export compilation failed."
            EXPORT_JOBS[job_id]["message"] = "Export compilation failed."
            return

        file_size = os.path.getsize(output_file_path)
        EXPORT_JOBS[job_id]["status"] = "success"
        EXPORT_JOBS[job_id]["progress"] = 100
        EXPORT_JOBS[job_id]["stage"] = "completed"
        EXPORT_JOBS[job_id]["message"] = f"Export complete ({total_pages} pages)"
        EXPORT_JOBS[job_id]["output_path"] = output_file_path
        EXPORT_JOBS[job_id]["filename"] = export_filename
        EXPORT_JOBS[job_id]["media_type"] = media_type
        EXPORT_JOBS[job_id]["file_size_bytes"] = file_size
        EXPORT_JOBS[job_id]["download_url"] = f"/api/book-scan/export-download/{job_id}"
    except Exception as e:
        EXPORT_JOBS[job_id]["status"] = "failed"
        EXPORT_JOBS[job_id]["error"] = str(e)
        EXPORT_JOBS[job_id]["message"] = f"Export failed: {str(e)}"
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/export-job/{session_id}")
async def start_export_job(
    session_id: str,
    req: ExportRequest,
    background_tasks: BackgroundTasks,
):
    evict_stale_sessions()
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    pages = session.get("pages", [])
    if not pages:
        raise HTTPException(status_code=400, detail="No pages available to export.")

    job_id = str(uuid.uuid4())[:12]
    EXPORT_JOBS[job_id] = {
        "job_id": job_id,
        "session_id": session_id,
        "status": "pending",
        "progress": 0,
        "stage": "queued",
        "message": "Export queued...",
        "total_pages": len(pages),
        "current_page": 0,
        "output_path": None,
        "filename": None,
        "file_size_bytes": None,
        "download_url": None,
        "error": None,
        "created_at": time.time(),
    }

    background_tasks.add_task(_run_export_job, job_id, session_id, req)
    return {"job_id": job_id, "status": "started", "total_pages": len(pages)}

@router.get("/export-job/{job_id}")
async def get_export_job_status(job_id: str):
    job = EXPORT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found or expired.")
    return job

@router.get("/export-download/{job_id}")
async def download_export_file(job_id: str):
    job = EXPORT_JOBS.get(job_id)
    if not job or job.get("status") != "success":
        raise HTTPException(status_code=404, detail="Export not found or still processing.")

    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Exported PDF file missing on server.")

    return FileResponse(
        output_path,
        media_type=job.get("media_type", "application/pdf"),
        filename=job.get("filename", "exported_book.pdf")
    )

@router.post("/export/{session_id}")
async def export_book_pdf(
    session_id: str,
    req: ExportRequest,
):
    evict_stale_sessions()
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    pages = session["pages"]
    if not pages:
        raise HTTPException(status_code=400, detail="No pages available to export.")

    doc_map = BookScanEngine.open_session_docs(session)

    try:
        processed_images, per_page_bleed_list = BookScanEngine.render_export_pages(
            doc_map, pages, req
        )

        export_filename = f"cleaned_book_{session_id[:8]}.pdf"
        output_pdf_path = os.path.join(session["session_dir"], export_filename)

        effective_quality = getattr(req, "quality", 88) or 88
        success = BookScanEngine.add_bleed_and_export_pdf(
            processed_images=processed_images,
            output_pdf_path=output_pdf_path,
            bleed_mm=req.bleed_mm,
            bleed_mode=req.bleed_mode,
            bleed_color=req.bleed_color,
            show_crop_marks=req.show_crop_marks,
            dpi=req.dpi,
            jpeg_quality=effective_quality,
            per_page_bleed=per_page_bleed_list,
            bleed_placement=req.bleed_placement,
        )

        if not success:
            raise HTTPException(status_code=500, detail="PDF generation failed.")

        return FileResponse(
            output_pdf_path,
            media_type="application/pdf",
            filename=export_filename
        )
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/duplicate-page/{session_id}")
async def duplicate_page(session_id: str, req: DuplicatePageRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        new_pages, new_id = BookScanEngine.duplicate_page(
            session["pages"],
            target_page_id=req.page_id,
            position=req.position,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_page_id": new_id,
    }

@router.post("/insert-blank/{session_id}")
async def insert_blank_page(session_id: str, req: InsertBlankPageRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        new_pages, new_id = BookScanEngine.insert_blank_page(
            session["pages"],
            target_page_id=req.page_id,
            position=req.position,
            width_mm=req.width_mm,
            height_mm=req.height_mm,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_page_id": new_id,
    }

@router.get("/extract-page/{session_id}/{page_id}")
async def extract_single_page(
    session_id: str,
    page_id: str,
    format: str = "pdf",
    dpi: int = 300,
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    fmt = format.lower()
    if fmt not in ["pdf", "png", "jpeg", "jpg", "webp"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Choose pdf, png, jpeg, or webp.")

    ext = "pdf" if fmt == "pdf" else ("jpg" if fmt in ["jpeg", "jpg"] else fmt)
    media_type = "application/pdf" if fmt == "pdf" else f"image/{fmt}"
    export_filename = f"page_{page_id[:8]}.{ext}"
    output_path = os.path.join(session["session_dir"], export_filename)

    doc_map = BookScanEngine.open_session_docs(session)
    try:
        success = BookScanEngine.extract_single_page(
            doc_map=doc_map,
            page_info=page_info,
            output_path=output_path,
            format=fmt,
            dpi=dpi,
        )
        if not success or not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Failed to extract page.")

        return FileResponse(
            output_path,
            media_type=media_type,
            filename=export_filename,
        )
    finally:
        BookScanEngine.close_session_docs(doc_map)

