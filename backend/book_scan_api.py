import os
import uuid
import shutil
import fitz
import cv2
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from typing import List, Optional, Dict, Any
from engines.book_scan_engine import BookScanEngine, PageOpError
from engines.schemas import (
    SessionInitResponse, ReorderRequest, PageRotateRequest, ProcessPageRequest,
    CropBoxModel, SplitSpreadRequest, RevertSpreadRequest, CropPageRequest,
    ExportRequest,
)

import time

router = APIRouter(prefix="/api/book-scan", tags=["Book Scan Studio"])

TEMP_DIR = "temp_uploads/book_scans"
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory session store & TTL tracking
SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TIMESTAMPS: Dict[str, float] = {}
SESSION_TTL_SECONDS = 7200  # 2 hours

def evict_stale_sessions():
    now = time.time()
    stale_ids = [sid for sid, ts in SESSION_TIMESTAMPS.items() if now - ts > SESSION_TTL_SECONDS]
    for sid in stale_ids:
        SESSION_TIMESTAMPS.pop(sid, None)
        sess = SESSIONS.pop(sid, None)
        if sess and "session_dir" in sess:
            cleanup_session_dir(sess["session_dir"])

def cleanup_session_dir(session_dir: str):
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)

@router.post("/init-session")
async def init_book_scan_session(
    mode: str = Form("dual"),          # 'dual' (odds + evens) or 'single'
    is_spread: bool = Form(False),     # False by default (treat as-is)
    odds_order: str = Form("forward"), # 'forward' or 'reverse'
    evens_order: str = Form("reverse"),# 'reverse' or 'forward'
    spread_split_pos: float = Form(0.5),
    file_odds: Optional[UploadFile] = File(None),
    file_evens: Optional[UploadFile] = File(None),
    file_single: Optional[UploadFile] = File(None),
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
            raise HTTPException(status_code=400, detail="Both Odds and Evens PDF files are required in dual mode.")
        odds_path = os.path.join(session_dir, f"odds_{file_odds.filename}")
        evens_path = os.path.join(session_dir, f"evens_{file_evens.filename}")
        with open(odds_path, "wb") as f:
            shutil.copyfileobj(file_odds.file, f)
        with open(evens_path, "wb") as f:
            shutil.copyfileobj(file_evens.file, f)

        odds_doc = fitz.open(odds_path)
        evens_doc = fitz.open(evens_path)
        pages = BookScanEngine.collate_scans(
            odds_doc=odds_doc,
            evens_doc=evens_doc,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos
        )
    else:
        if not file_single and not existing_file_path:
            raise HTTPException(status_code=400, detail="Single PDF file is required in single mode.")
        if file_single:
            single_path = os.path.join(session_dir, f"single_{file_single.filename}")
            with open(single_path, "wb") as f:
                shutil.copyfileobj(file_single.file, f)
        else:
            if not os.path.exists(existing_file_path):
                raise HTTPException(status_code=404, detail="Referenced file does not exist on server.")
            single_path = existing_file_path

        single_doc = fitz.open(single_path)
        pages = BookScanEngine.collate_scans(
            odds_doc=None,
            evens_doc=None,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos,
            single_doc=single_doc
        )
    evict_stale_sessions()
    SESSION_TIMESTAMPS[session_id] = time.time()

    SESSIONS[session_id] = {
        "mode": mode,
        "is_spread": is_spread,
        "odds_order": odds_order,
        "evens_order": evens_order,
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
    clean_borders: bool = True,
    border_margin_px: int = 15,
    border_threshold: int = 210,
    enhance_colors: bool = True,
    saturation: float = 1.30,
    contrast: float = 1.10,
    deskew: bool = False,
    dpi: int = 100,
    deskew_module_enabled: bool = False,
    deskew_mode: str = "auto",
    deskew_angle: float = 0.0,
    deskew_max_angle: float = 10.0,
    deskew_ignore_borders: bool = True,
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    # Disk cache tag with complete state configuration
    rot = page_info.get("rotation", 0)
    half = page_info.get("half", "full")
    sp = int(page_info.get("spread_split_pos", page_info.get("split_pos", 0.5)) * 1000)
    cache_tag = f"thumb_{page_id}_{half}_{sp}_{rot}_{preview_clean}_{dpi}"
    cb = page_info.get("crop_box")
    if cb:
        cache_tag += f"_cb_{int(cb.get('x1', 0)*1000)}_{int(cb.get('y1', 0)*1000)}_{int(cb.get('x2', 1)*1000)}_{int(cb.get('y2', 1)*1000)}"
    scb = page_info.get("spread_crop_box")
    if scb:
        cache_tag += f"_scb_{int(scb.get('x1', 0)*1000)}_{int(scb.get('y1', 0)*1000)}_{int(scb.get('x2', 1)*1000)}_{int(scb.get('y2', 1)*1000)}"
    pcb = page_info.get("page_crop_box")
    if pcb:
        cache_tag += f"_pcb_{int(pcb.get('x1', 0)*1000)}_{int(pcb.get('y1', 0)*1000)}_{int(pcb.get('x2', 1)*1000)}_{int(pcb.get('y2', 1)*1000)}"
    if preview_clean:
        cache_tag += f"_{border_margin_px}_{int(saturation*100)}_{int(contrast*100)}_{int(deskew)}"
        if deskew_module_enabled:
            cache_tag += f"_dm_{deskew_mode}_{int(deskew_angle*10)}_{int(deskew_max_angle)}_{int(deskew_ignore_borders)}"
    thumb_path = os.path.join(session["session_dir"], f"{cache_tag}.jpg")

    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    doc_map = {}
    if session.get("odds_path"):
        doc_map["odds"] = fitz.open(session["odds_path"])
    if session.get("evens_path"):
        doc_map["evens"] = fitz.open(session["evens_path"])
    if session.get("single_path"):
        doc_map["single"] = fitz.open(session["single_path"])

    try:
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=dpi)
        if preview_clean:
            proc_img = BookScanEngine.process_single_page(
                raw_img,
                clean_borders=clean_borders,
                border_margin_px=border_margin_px,
                border_threshold=border_threshold,
                enhance_colors=enhance_colors,
                saturation=saturation,
                contrast=contrast,
                deskew=deskew,
                sharpen=True,
                deskew_module_enabled=deskew_module_enabled,
                deskew_mode=deskew_mode,
                deskew_angle=deskew_angle,
                deskew_max_angle=deskew_max_angle,
                deskew_ignore_borders=deskew_ignore_borders,
            )
        else:
            proc_img = raw_img

        success, enc = cv2.imencode(".jpg", proc_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not success:
            raise HTTPException(status_code=500, detail="Failed to encode thumbnail.")

        with open(thumb_path, "wb") as f:
            f.write(enc.tobytes())

        return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    finally:
        for d in doc_map.values():
            d.close()

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

    doc_map = {}
    if session.get("odds_path"):
        doc_map["odds"] = fitz.open(session["odds_path"])
    if session.get("evens_path"):
        doc_map["evens"] = fitz.open(session["evens_path"])
    if session.get("single_path"):
        doc_map["single"] = fitz.open(session["single_path"])

    try:
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=100)
        detected_angle = BookScanEngine.detect_skew_angle(
            raw_img,
            max_angle=max_angle,
            ignore_borders=ignore_borders
        )
        return {
            "status": "ok",
            "page_id": page_id,
            "detected_angle": detected_angle
        }
    finally:
        for d in doc_map.values():
            d.close()

@router.post("/detect-crop/{session_id}/{page_id}")
async def detect_page_crop(session_id: str, page_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    doc_map = {}
    if session.get("odds_path"):
        doc_map["odds"] = fitz.open(session["odds_path"])
    if session.get("evens_path"):
        doc_map["evens"] = fitz.open(session["evens_path"])
    if session.get("single_path"):
        doc_map["single"] = fitz.open(session["single_path"])

    try:
        temp_info = {**page_info}
        temp_info.pop("crop_box", None)
        temp_info["half"] = "full"
        raw_img = BookScanEngine.extract_page_image(doc_map, temp_info, dpi=100)
        res = BookScanEngine.detect_book_crop_and_seam(raw_img)
        return {
            "status": "ok",
            "page_id": page_id,
            "crop_box": res["crop_box"],
            "split_pos": res["split_pos"]
        }
    finally:
        for d in doc_map.values():
            d.close()

@router.post("/split-spread/{session_id}")
async def split_spread(session_id: str, req: SplitSpreadRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        new_pages, new_selected_id = BookScanEngine.split_pages(
            session["pages"],
            req.page_id,
            crop_box=req.crop_box.dict() if req.crop_box else None,
            split_pos=req.split_pos,
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

    BookScanEngine.apply_crop_to_pages(
        session["pages"],
        req.page_id,
        req.crop_box.dict(),
        apply_to_all=req.apply_to_all,
        target_page_ids=req.target_page_ids,
    )

    return {
        "status": "ok",
        "pages": session["pages"]
    }

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

    doc_map = {}
    if session.get("odds_path"):
        doc_map["odds"] = fitz.open(session["odds_path"])
    if session.get("evens_path"):
        doc_map["evens"] = fitz.open(session["evens_path"])
    if session.get("single_path"):
        doc_map["single"] = fitz.open(session["single_path"])

    try:
        processed_images, per_page_bleed_list = BookScanEngine.render_export_pages(
            doc_map, pages, req
        )

        export_filename = f"cleaned_book_{session_id[:8]}.pdf"
        output_pdf_path = os.path.join(session["session_dir"], export_filename)

        success = BookScanEngine.add_bleed_and_export_pdf(
            processed_images=processed_images,
            output_pdf_path=output_pdf_path,
            bleed_mm=req.bleed_mm,
            show_crop_marks=req.show_crop_marks,
            dpi=req.dpi,
            jpeg_quality=95,
            per_page_bleed=per_page_bleed_list
        )

        if not success:
            raise HTTPException(status_code=500, detail="PDF generation failed.")

        return FileResponse(
            output_pdf_path,
            media_type="application/pdf",
            filename=export_filename
        )
    finally:
        for d in doc_map.values():
            d.close()
