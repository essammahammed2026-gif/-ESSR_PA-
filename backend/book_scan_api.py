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

class CropBoxModel(BaseModel):
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 1.0
    y2: float = 1.0

class SplitSpreadRequest(BaseModel):
    page_id: str
    crop_box: Optional[CropBoxModel] = None
    split_pos: float = 0.5
    apply_to_all: bool = False
    target_page_ids: Optional[List[str]] = None

class RevertSpreadRequest(BaseModel):
    page_id: Optional[str] = None
    revert_all: bool = False
    target_page_ids: Optional[List[str]] = None

class CropPageRequest(BaseModel):
    page_id: str
    crop_box: CropBoxModel
    apply_to_all: bool = False
    target_page_ids: Optional[List[str]] = None

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
    deskew_module_enabled: bool = False
    deskew_mode: str = "auto"
    deskew_angle: float = 0.0
    deskew_max_angle: float = 10.0
    deskew_ignore_borders: bool = True
    deskew_scope_mode: str = "all"
    deskew_custom_range: str = ""

    bleed_module_enabled: bool = False
    bleed_scope_mode: str = "all"
    bleed_custom_range: str = ""

    restoration_module_enabled: bool = False
    restoration_scope_mode: str = "all"
    restoration_custom_range: str = ""

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

    new_pages = []
    split_occurred = False
    new_selected_id = None
    target_ids = set(req.target_page_ids) if req.target_page_ids is not None else None

    for p in session["pages"]:
        if target_ids is not None:
            is_target = p["id"] in target_ids
        elif req.apply_to_all:
            is_target = True
        else:
            is_target = (p["id"] == req.page_id)

        if is_target and p.get("half", "full") == "full":
            split_occurred = True
            base_label = p.get("label", "Sheet").replace(" (Spread)", "")
            cb = req.crop_box.dict() if req.crop_box else p.get("crop_box")
            sp = req.split_pos if req.split_pos is not None else p.get("split_pos", 0.5)

            p_orig_w = p.get("orig_width_mm") or p.get("width_mm", 297.0)
            p_orig_h = p.get("orig_height_mm") or p.get("height_mm", 210.0)
            cb_w = (cb.get("x2", 1.0) - cb.get("x1", 0.0)) if cb else 1.0
            cb_h = (cb.get("y2", 1.0) - cb.get("y1", 0.0)) if cb else 1.0
            cropped_w = p_orig_w * cb_w
            cropped_h = p_orig_h * cb_h
            left_w = round(cropped_w * sp, 1)
            right_w = round(cropped_w * (1.0 - sp), 1)

            left_id = str(uuid.uuid4())[:8]
            right_id = str(uuid.uuid4())[:8]
            if p["id"] == req.page_id or new_selected_id is None:
                new_selected_id = left_id

            left_p = {
                "id": left_id,
                "source": p["source"],
                "doc_idx": p["doc_idx"],
                "half": "left",
                "crop_box": cb,
                "spread_crop_box": cb,
                "split_pos": sp,
                "spread_split_pos": sp,
                "page_crop_box": None,
                "rotation": p.get("rotation", 0),
                "label": f"{base_label} (Left)",
                "parent_page_id": p["id"],
                "is_spread": False,
                "width_mm": left_w,
                "height_mm": round(cropped_h, 1),
                "orig_width_mm": left_w,
                "orig_height_mm": round(cropped_h, 1),
                "parent_spread_width_mm": p_orig_w,
                "parent_spread_height_mm": p_orig_h,
            }
            right_p = {
                "id": right_id,
                "source": p["source"],
                "doc_idx": p["doc_idx"],
                "half": "right",
                "crop_box": cb,
                "spread_crop_box": cb,
                "split_pos": sp,
                "spread_split_pos": sp,
                "page_crop_box": None,
                "rotation": p.get("rotation", 0),
                "label": f"{base_label} (Right)",
                "parent_page_id": p["id"],
                "is_spread": False,
                "width_mm": right_w,
                "height_mm": round(cropped_h, 1),
                "orig_width_mm": right_w,
                "orig_height_mm": round(cropped_h, 1),
                "parent_spread_width_mm": p_orig_w,
                "parent_spread_height_mm": p_orig_h,
            }
            new_pages.extend([left_p, right_p])
        else:
            new_pages.append(p)

    if not split_occurred:
        raise HTTPException(status_code=400, detail="Target page is already split or not found.")

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

    target_pairs = set()

    if req.revert_all:
        for p in session["pages"]:
            if p.get("half") in ["left", "right"]:
                target_pairs.add((p["source"], p["doc_idx"]))
    elif req.target_page_ids:
        t_ids = set(req.target_page_ids)
        for p in session["pages"]:
            if p["id"] in t_ids and p.get("half") in ["left", "right"]:
                target_pairs.add((p["source"], p["doc_idx"]))
    elif req.page_id:
        target_page = next((p for p in session["pages"] if p["id"] == req.page_id), None)
        if not target_page:
            raise HTTPException(status_code=404, detail="Page not found.")
        target_pairs.add((target_page["source"], target_page["doc_idx"]))
    else:
        raise HTTPException(status_code=400, detail="page_id or revert_all required.")

    if not target_pairs:
        raise HTTPException(status_code=400, detail="No split pages found to revert.")

    new_pages = []
    recombined_pairs = set()
    new_selected_id = None

    for p in session["pages"]:
        pair = (p["source"], p["doc_idx"])
        if pair in target_pairs and p.get("half") in ["left", "right"]:
            if pair not in recombined_pairs:
                recombined_pairs.add(pair)
                orig_w = p.get("parent_spread_width_mm") or p.get("orig_width_mm") or 297.0
                orig_h = p.get("parent_spread_height_mm") or p.get("orig_height_mm") or 210.0
                reverted_id = p.get("parent_page_id") or str(uuid.uuid4())[:8]
                if new_selected_id is None:
                    new_selected_id = reverted_id
                new_pages.append({
                    "id": reverted_id,
                    "source": p["source"],
                    "doc_idx": p["doc_idx"],
                    "half": "full",
                    "crop_box": p.get("spread_crop_box") or p.get("crop_box"),
                    "split_pos": p.get("spread_split_pos") if p.get("spread_split_pos") is not None else p.get("split_pos", 0.5),
                    "rotation": p.get("rotation", 0),
                    "label": f"Sheet {p['doc_idx'] + 1} (Spread)",
                    "is_spread": True,
                    "width_mm": orig_w,
                    "height_mm": orig_h,
                    "orig_width_mm": orig_w,
                    "orig_height_mm": orig_h,
                })
        else:
            new_pages.append(p)

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

    cb_dict = req.crop_box.dict()
    cb_w = req.crop_box.x2 - req.crop_box.x1
    cb_h = req.crop_box.y2 - req.crop_box.y1
    target_ids = set(req.target_page_ids) if req.target_page_ids is not None else None

    for p in session["pages"]:
        if target_ids is not None:
            is_target = p["id"] in target_ids
        elif req.apply_to_all:
            is_target = True
        else:
            is_target = (p["id"] == req.page_id)

        if is_target:
            if p.get("half") in ["left", "right"]:
                p["page_crop_box"] = cb_dict
            else:
                p["crop_box"] = cb_dict
            orig_w = p.get("orig_width_mm") or p.get("width_mm", 210.0)
            orig_h = p.get("orig_height_mm") or p.get("height_mm", 297.0)
            p["orig_width_mm"] = orig_w
            p["orig_height_mm"] = orig_h
            p["width_mm"] = round(orig_w * cb_w, 1)
            p["height_mm"] = round(orig_h * cb_h, 1)

    return {
        "status": "ok",
        "pages": session["pages"]
    }

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
        per_page_bleed_list = []
        for idx, p_info in enumerate(pages):
            page_num = idx + 1
            raw_img = BookScanEngine.extract_page_image(doc_map, p_info, dpi=req.dpi)

            # Evaluate module scope per page
            apply_deskew = req.deskew_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.deskew_scope_mode, req.deskew_custom_range
            )
            apply_restoration = req.restoration_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.restoration_scope_mode, req.restoration_custom_range
            )
            apply_bleed = req.bleed_module_enabled and BookScanEngine.is_page_in_scope(
                page_num, req.bleed_scope_mode, req.bleed_custom_range
            )

            # Restoration settings
            if req.restoration_module_enabled:
                do_clean_borders = apply_restoration and req.clean_borders
                do_enhance_colors = apply_restoration and req.enhance_colors
            else:
                do_clean_borders = req.clean_borders
                do_enhance_colors = req.enhance_colors

            cleaned = BookScanEngine.process_single_page(
                raw_img,
                clean_borders=do_clean_borders,
                border_margin_px=req.border_margin_px,
                border_threshold=req.border_threshold,
                enhance_colors=do_enhance_colors,
                saturation=req.saturation,
                contrast=req.contrast,
                deskew=req.deskew if not req.deskew_module_enabled else False,
                sharpen=req.sharpen,
                deskew_module_enabled=apply_deskew,
                deskew_mode=req.deskew_mode,
                deskew_angle=req.deskew_angle,
                deskew_max_angle=req.deskew_max_angle,
                deskew_ignore_borders=req.deskew_ignore_borders,
            )
            processed_images.append(cleaned)

            # Bleed settings per page
            if req.bleed_module_enabled:
                p_bleed = req.bleed_mm if apply_bleed else 0.0
                p_marks = req.show_crop_marks if apply_bleed else False
            else:
                p_bleed = 0.0
                p_marks = False

            per_page_bleed_list.append({
                "bleed_mm": p_bleed,
                "show_crop_marks": p_marks
            })

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
