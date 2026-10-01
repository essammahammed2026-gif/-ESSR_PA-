import os
import uuid
import shutil
import fitz
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from engines.book_scan_engine import BookScanEngine

router = APIRouter(prefix="/api/book-scan", tags=["Book Scan Studio"])

TEMP_DIR = "temp_uploads/book_scans"
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory session store
SESSIONS: Dict[str, Dict[str, Any]] = {}

class SessionInitResponse(BaseModel):
    session_id: str
    mode: str
    total_pages: int
    pages: List[Dict[str, Any]]

class ReorderRequest(BaseModel):
    page_ids: List[str]

class PageRotateRequest(BaseModel):
    page_id: str
    rotation_delta: int  # e.g. 90, 180, 270

class ProcessPageRequest(BaseModel):
    page_id: str
    clean_borders: bool = True
    border_margin_px: int = 15
    border_threshold: int = 210
    enhance_colors: bool = True
    saturation: float = 1.30
    contrast: float = 1.10
    deskew: bool = False
    sharpen: bool = True

class ExportRequest(BaseModel):
    bleed_mm: float = 3.0
    show_crop_marks: bool = True
    dpi: int = 200
    clean_borders: bool = True
    border_margin_px: int = 15
    border_threshold: int = 210
    enhance_colors: bool = True
    saturation: float = 1.30
    contrast: float = 1.10
    deskew: bool = False
    sharpen: bool = True

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
        if not file_single:
            raise HTTPException(status_code=400, detail="Single PDF file is required in single mode.")
        single_path = os.path.join(session_dir, f"single_{file_single.filename}")
        with open(single_path, "wb") as f:
            shutil.copyfileobj(file_single.file, f)

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
    deskew: bool = False
):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    # Disk cache: return cached thumbnail if it exists
    thumb_path = os.path.join(session["session_dir"], f"thumb_{page_id}_{preview_clean}.jpg")
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
        raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=90)
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
                sharpen=True
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

@router.post("/export/{session_id}")
async def export_book_pdf(
    session_id: str,
    req: ExportRequest,
    background_tasks: BackgroundTasks
):
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
        processed_images = []
        for p_info in pages:
            raw_img = BookScanEngine.extract_page_image(doc_map, p_info, dpi=req.dpi)
            cleaned = BookScanEngine.process_single_page(
                raw_img,
                clean_borders=req.clean_borders,
                border_margin_px=req.border_margin_px,
                border_threshold=req.border_threshold,
                enhance_colors=req.enhance_colors,
                saturation=req.saturation,
                contrast=req.contrast,
                deskew=req.deskew,
                sharpen=req.sharpen
            )
            processed_images.append(cleaned)

        export_filename = f"cleaned_book_{session_id[:8]}.pdf"
        output_pdf_path = os.path.join(session["session_dir"], export_filename)

        success = BookScanEngine.add_bleed_and_export_pdf(
            processed_images=processed_images,
            output_pdf_path=output_pdf_path,
            bleed_mm=req.bleed_mm,
            show_crop_marks=req.show_crop_marks,
            dpi=req.dpi,
            jpeg_quality=95
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
