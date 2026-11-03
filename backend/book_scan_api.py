import os
import re
import uuid
import shutil
import threading
from collections import OrderedDict
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse, Response
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session as DBSession
from db.session import get_db, db_session
from db.repository import SessionRepository
from storage.asset_store import asset_store
from engines.book_scan_engine import BookScanEngine, PageOpError
from engines.units import mm_to_px
from engines.schemas import (
    ReorderRequest, PageRotateRequest,
    SplitSpreadRequest, RevertSpreadRequest, CropPageRequest, RevertCropRequest,
    BatchDetectCropRequest, BatchDetectAngleRequest, PageDeskewRequest,
    MaskPageRequest, PageColorModeRequest,
    ExportRequest, DuplicatePageRequest, InsertBlankPageRequest, RestorePagesRequest,
)

import time

router = APIRouter(prefix="/api/book-scan", tags=["Book Scan Studio"])

# In-memory L1 session store & TTL tracking
SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TIMESTAMPS: Dict[str, float] = {}
SESSION_TTL_SECONDS = 7200  # 2 hours

# Fast in-memory LRU thumbnail cache
_THUMB_RAM_CACHE: OrderedDict[str, bytes] = OrderedDict()
_THUMB_RAM_LOCK = threading.Lock()
MAX_THUMB_RAM_ITEMS = 128

def get_ram_thumbnail(cache_tag: str) -> Optional[bytes]:
    with _THUMB_RAM_LOCK:
        if cache_tag in _THUMB_RAM_CACHE:
            _THUMB_RAM_CACHE.move_to_end(cache_tag)
            return _THUMB_RAM_CACHE[cache_tag]
    return None

def put_ram_thumbnail(cache_tag: str, data: bytes) -> None:
    if not data:
        return
    with _THUMB_RAM_LOCK:
        _THUMB_RAM_CACHE[cache_tag] = data
        _THUMB_RAM_CACHE.move_to_end(cache_tag)
        while len(_THUMB_RAM_CACHE) > MAX_THUMB_RAM_ITEMS:
            _THUMB_RAM_CACHE.popitem(last=False)

# Session open document handles cache (avoids repeated fitz.open/close per thumbnail)
_SESSION_DOCS: Dict[str, Dict[str, Any]] = {}
_SESSION_DOCS_LOCK = threading.Lock()
_DOC_RENDER_LOCK = threading.Lock()

def get_session_docs(session: Dict[str, Any], session_id: Optional[str] = None) -> Dict[str, Any]:
    sid = session_id or session.get("id") or ""
    if not sid:
        return BookScanEngine.open_session_docs(session)
    with _SESSION_DOCS_LOCK:
        if sid in _SESSION_DOCS:
            return _SESSION_DOCS[sid]
        doc_map = BookScanEngine.open_session_docs(session)
        _SESSION_DOCS[sid] = doc_map
        return doc_map

def purge_session_ram_cache(session_id: str) -> None:
    if not session_id:
        return
    with _THUMB_RAM_LOCK:
        keys_to_remove = [k for k in _THUMB_RAM_CACHE if k.startswith(f"{session_id}_")]
        for k in keys_to_remove:
            _THUMB_RAM_CACHE.pop(k, None)

def close_cached_session_docs(session_id: str) -> None:
    if not session_id:
        return
    with _SESSION_DOCS_LOCK:
        doc_map = _SESSION_DOCS.pop(session_id, None)
        if doc_map:
            BookScanEngine.close_session_docs(doc_map)
    purge_session_ram_cache(session_id)

# Export jobs tracking
EXPORT_JOBS: Dict[str, Dict[str, Any]] = {}

def get_or_load_session(session_id: str, db: Optional[DBSession] = None) -> Dict[str, Any]:
    """Resolves session from memory cache, or loads from database upon restart/multi-worker."""
    if session_id in SESSIONS:
        SESSION_TIMESTAMPS[session_id] = time.time()
        return SESSIONS[session_id]

    if db is not None:
        model = SessionRepository.get_session(db, session_id)
        if model:
            settings_dict = model.settings or {}
            session_data = {
                "id": model.id,
                "mode": model.intake_mode,
                "is_spread": model.is_spread,
                "odds_order": settings_dict.get("odds_order", "forward"),
                "evens_order": settings_dict.get("evens_order", "reverse"),
                "start_with": settings_dict.get("start_with", "odds"),
                "spread_split_pos": settings_dict.get("spread_split_pos", 0.5),
                "odds_path": settings_dict.get("odds_path"),
                "evens_path": settings_dict.get("evens_path"),
                "single_path": settings_dict.get("single_path"),
                "pages": [p.to_dict() for p in model.pages],
                "session_dir": model.session_dir,
                "rev": model.rev,
            }
            SESSIONS[session_id] = session_data
            SESSION_TIMESTAMPS[session_id] = time.time()
            return session_data

    raise HTTPException(status_code=404, detail="Session not found or expired.")

def evict_stale_sessions():
    now = time.time()
    stale_ids = [sid for sid, ts in SESSION_TIMESTAMPS.items() if now - ts > SESSION_TTL_SECONDS]
    for sid in stale_ids:
        SESSION_TIMESTAMPS.pop(sid, None)
        sess = SESSIONS.pop(sid, None)
        close_cached_session_docs(sid)
        asset_store.purge_session(sid)
    stale_jobs = [jid for jid, j in EXPORT_JOBS.items() if now - j.get("created_at", now) > SESSION_TTL_SECONDS]
    for jid in stale_jobs:
        EXPORT_JOBS.pop(jid, None)

def cleanup_session_dir(session_dir: str, session_id: Optional[str] = None):
    if session_id:
        close_cached_session_docs(session_id)
        asset_store.purge_session(session_id)
    elif os.path.exists(session_dir):
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
    original_filename: Optional[str] = Form(None),
    db: DBSession = Depends(get_db),
):
    session_id = str(uuid.uuid4())
    session_dir = asset_store.get_session_dir(session_id)

    if not (hasattr(file_single, "file") and hasattr(file_single, "filename")):
        file_single = None
    if not (hasattr(file_odds, "file") and hasattr(file_odds, "filename")):
        file_odds = None
    if not (hasattr(file_evens, "file") and hasattr(file_evens, "filename")):
        file_evens = None
    if not isinstance(files, list):
        files = None
    if not isinstance(existing_file_path, str):
        existing_file_path = None
    if not isinstance(reverse_file_indices, str):
        reverse_file_indices = None
    if not isinstance(mode, str):
        mode = "single"
    if not isinstance(is_spread, bool):
        is_spread = False
    if not isinstance(odds_order, str):
        odds_order = "forward"
    if not isinstance(evens_order, str):
        evens_order = "reverse"
    if not isinstance(spread_split_pos, (int, float)):
        spread_split_pos = 0.5
    if not isinstance(start_with, str):
        start_with = "odds"

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
        asset_store.save_file_stream(odds_path, file_odds.file)
        asset_store.save_file_stream(evens_path, file_evens.file)

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
            asset_store.save_file_stream(save_path, upload.file)
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
            asset_store.save_file_stream(single_path, file_single.file)
            if not single_path.lower().endswith(".pdf"):
                combined_pdf_path = os.path.join(session_dir, "single_converted.pdf")
                if BookScanEngine.combine_files_to_pdf([single_path], combined_pdf_path):
                    single_path = combined_pdf_path
        else:
            resolved = asset_store.resolve_asset_file(existing_file_path, session_id=session_id)
            if not resolved or not os.path.exists(resolved):
                raise HTTPException(status_code=404, detail="Referenced file does not exist on server.")
            single_path = resolved

        pages = BookScanEngine.collate_from_paths(
            single_path=single_path,
            is_spread=is_spread,
            odds_order=odds_order,
            evens_order=evens_order,
            spread_split_pos=spread_split_pos,
        )
    evict_stale_sessions()
    SESSION_TIMESTAMPS[session_id] = time.time()

    # Evict any legacy unkeyed handles if they exist
    with _SESSION_DOCS_LOCK:
        legacy_doc_map = _SESSION_DOCS.pop("", None)
        if legacy_doc_map:
            BookScanEngine.close_session_docs(legacy_doc_map)

    session_data = {
        "id": session_id,
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
    SESSIONS[session_id] = session_data

    if db is not None:
        orig_fname = "Document"
        if original_filename and original_filename.strip():
            orig_fname = original_filename.strip()
        elif file_single and hasattr(file_single, "filename") and file_single.filename:
            orig_fname = file_single.filename
        elif existing_file_path:
            base = os.path.basename(existing_file_path)
            orig_fname = re.sub(r'^\d+_', '', base)
        elif files and len(files) > 0 and hasattr(files[0], "filename") and files[0].filename:
            orig_fname = files[0].filename
        elif file_odds and hasattr(file_odds, "filename") and file_odds.filename:
            orig_fname = file_odds.filename

        orig_file_size = 0
        if single_path and os.path.exists(single_path):
            try:
                orig_file_size = os.path.getsize(single_path)
            except OSError:
                pass
        elif odds_path or evens_path:
            for p in (odds_path, evens_path):
                if p and os.path.exists(p):
                    try:
                        orig_file_size += os.path.getsize(p)
                    except OSError:
                        pass
        elif existing_file_path and os.path.exists(existing_file_path):
            try:
                orig_file_size = os.path.getsize(existing_file_path)
            except OSError:
                pass

        SessionRepository.create_session(
            db,
            session_id=session_id,
            studio_type="book_scan",
            title=orig_fname,
            original_filename=orig_fname,
            file_size_bytes=orig_file_size,
            intake_mode=mode,
            is_spread=is_spread,
            session_dir=session_dir,
            pages_data=pages,
            settings={
                "odds_order": odds_order,
                "evens_order": evens_order,
                "start_with": start_with,
                "spread_split_pos": spread_split_pos,
                "odds_path": odds_path,
                "evens_path": evens_path,
                "single_path": single_path,
            },
        )

    return {
        "session_id": session_id,
        "mode": mode,
        "is_spread": is_spread,
        "total_pages": len(pages),
        "pages": pages
    }

@router.get("/page-thumbnail/{session_id}/{page_id}")
def get_page_thumbnail(
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
    spine_strength: float = 1.0,
    spine_box: Optional[str] = None,
    despeckle_level: float = 0.0,
    exclude_mask_ids: Optional[str] = None,
    rev: int = 0,
    db: DBSession = Depends(get_db),
):
    session = get_or_load_session(session_id, db)

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
    if exclude_mask_ids and preview_clean:
        if exclude_mask_ids.strip() == "*":
            masks_list = []
        else:
            excluded = {x.strip() for x in exclude_mask_ids.split(",") if x.strip()}
            masks_list = [m for m in masks_list if m.get("id") not in excluded]
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

    parsed_spine_box: Optional[Dict[str, float]] = None
    if spine_box:
        try:
            parts = [float(x.strip()) for x in spine_box.split(",") if x.strip()]
            if len(parts) == 4:
                parsed_spine_box = {"x1": parts[0], "y1": parts[1], "x2": parts[2], "y2": parts[3]}
        except Exception:
            parsed_spine_box = None

    has_active_processing = (
        clean_borders
        or enhance_colors
        or whiten_bg
        or deskew
        or deskew_module_enabled
        or (page_info.get("deskew_angle") is not None)
        or len(masks_list) > 0
        or (flatten_illumination and spine_strength > 0)
        or despeckle_level > 0
    )
    if preview_clean and has_active_processing:
        cache_tag += f"_{int(clean_borders)}_{border_margin_px}_{int(enhance_colors)}_{int(saturation*100)}_{int(contrast*100)}_{eff_color_mode}_{bw_threshold}_{int(whiten_bg)}_{int(deskew)}_fi{int(flatten_illumination)}_st{int(spine_strength*100)}_ds{int(round(despeckle_level*10))}"
        if parsed_spine_box:
            cache_tag += f"_spb_{int(parsed_spine_box['x1']*1000)}_{int(parsed_spine_box['y1']*1000)}_{int(parsed_spine_box['x2']*1000)}_{int(parsed_spine_box['y2']*1000)}"
        if deskew_module_enabled or (page_info.get("deskew_angle") is not None):
            eff_ang = float(page_info["deskew_angle"]) if page_info.get("deskew_angle") is not None else deskew_angle
            cache_tag += f"_dm_{deskew_mode}_{int(eff_ang*100)}_{int(deskew_max_angle)}_{int(deskew_ignore_borders)}"
    if bleed_mm > 0:
        clean_hex = (bleed_color or "#ffffff").lstrip("#")
        cache_tag += f"_bl_{int(bleed_mm*100)}_{bleed_mode}_{clean_hex}_{int(show_crop_marks)}_{bleed_placement}"

    # 1. Fast in-memory RAM cache check (< 1ms)
    ram_cache_key = f"{session_id}_{cache_tag}"
    cached_ram = get_ram_thumbnail(ram_cache_key)
    if cached_ram is not None:
        return Response(content=cached_ram, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    thumb_path = asset_store.get_thumbnail_cache_path(session_id, cache_tag)

    # 2. Disk cache check
    if os.path.exists(thumb_path):
        try:
            with open(thumb_path, "rb") as f:
                data = f.read()
            put_ram_thumbnail(ram_cache_key, data)
            return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception:
            return FileResponse(thumb_path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    legacy_thumb = os.path.join(session["session_dir"], f"{cache_tag}.jpg")
    if os.path.exists(legacy_thumb):
        try:
            with open(legacy_thumb, "rb") as f:
                data = f.read()
            put_ram_thumbnail(ram_cache_key, data)
            return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
        except Exception:
            return FileResponse(legacy_thumb, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    # 3. Render thumbnail using cached session doc handle (thread-safe)
    with _DOC_RENDER_LOCK:
        doc_map = get_session_docs(session, session_id=session_id)
        try:
            raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=dpi)
        except Exception:
            # Recreate cached doc_map if a handle became stale
            close_cached_session_docs(session_id)
            doc_map = get_session_docs(session, session_id=session_id)
            raw_img = BookScanEngine.extract_page_image(doc_map, page_info, dpi=dpi)

    if preview_clean and has_active_processing:
        eff_deskew_mode = "manual"
        eff_deskew_angle = float(page_info["deskew_angle"]) if page_info.get("deskew_angle") is not None else float(deskew_angle)
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
            spine_strength=spine_strength,
            spine_box=parsed_spine_box,
        )
    else:
        proc_img = raw_img

    if bleed_mm > 0:
        h_px, w_px = proc_img.shape[:2]
        w_mm_val = float(page_info.get("width_mm") or 0.0)
        px_per_mm = (w_px / w_mm_val) if w_mm_val > 0 else float(mm_to_px(1.0, dpi))
        bleed_px = int(round(max(0.0, float(bleed_mm)) * px_per_mm))
        proc_img = BookScanEngine.apply_bleed_to_image(
            proc_img,
            bleed_px=bleed_px,
            bleed_mode=bleed_mode,
            bleed_color=bleed_color,
            draw_crop_marks=show_crop_marks,
            placement=bleed_placement,
        )

    encoded_bytes = BookScanEngine.encode_thumbnail_jpg(proc_img, quality=80)
    if not encoded_bytes:
        raise HTTPException(status_code=500, detail="Failed to encode thumbnail.")

    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    try:
        with open(thumb_path, "wb") as f:
            f.write(encoded_bytes)
    except Exception:
        pass

    put_ram_thumbnail(ram_cache_key, encoded_bytes)
    return Response(content=encoded_bytes, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

@router.post("/reorder/{session_id}")
async def reorder_pages(session_id: str, req: ReorderRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

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
    if db is not None:
        SessionRepository.save_pages(db, session_id, new_pages)
    return {"status": "ok", "pages": session["pages"]}

@router.post("/rotate/{session_id}")
async def rotate_page(session_id: str, req: PageRotateRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

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

    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])
    return {"status": "ok", "page": page_info}

@router.delete("/page/{session_id}/{page_id}")
async def delete_page(session_id: str, page_id: str, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    session["pages"] = [p for p in session["pages"] if p["id"] != page_id]
    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])
    return {"status": "ok", "remaining": len(session["pages"]), "pages": session["pages"]}

@router.post("/detect-angle/{session_id}/{page_id}")
async def detect_page_angle(
    session_id: str,
    page_id: str,
    max_angle: float = 10.0,
    ignore_borders: bool = True,
    db: DBSession = Depends(get_db),
):
    session = get_or_load_session(session_id, db)

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
        if db is not None:
            SessionRepository.save_pages(db, session_id, session["pages"])
        return {
            "status": "ok",
            "page_id": page_id,
            "detected_angle": detected_angle,
            "pages": session["pages"],
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/detect-angle-batch/{session_id}")
async def detect_angle_batch(session_id: str, req: BatchDetectAngleRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

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

        if db is not None:
            SessionRepository.save_pages(db, session_id, session["pages"])

        return {
            "status": "ok",
            "angles": angles_map,
            "pages": session["pages"],
        }
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/deskew-page/{session_id}")
async def set_page_deskew(session_id: str, req: PageDeskewRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    BookScanEngine.apply_deskew_to_pages(
        session["pages"],
        page_id=req.page_id,
        angle=req.angle,
        per_page_angles=req.per_page_angles,
        clear_all=req.clear_all,
    )
    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/mask-page/{session_id}")
async def mask_page(session_id: str, req: MaskPageRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    BookScanEngine.apply_masks_to_pages(session["pages"], req)
    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/color-mode-page/{session_id}")
async def set_page_color_mode(session_id: str, req: PageColorModeRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    BookScanEngine.apply_color_mode_to_pages(
        session["pages"],
        page_id=req.page_id,
        color_mode=req.color_mode,
        target_page_ids=req.target_page_ids,
        clear_all=req.clear_all,
    )
    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])
    return {
        "status": "ok",
        "pages": session["pages"],
    }

@router.post("/detect-crop/{session_id}/{page_id}")
async def detect_page_crop(
    session_id: str,
    page_id: str,
    mode: str = "paper",
    db: DBSession = Depends(get_db),
):
    session = get_or_load_session(session_id, db)

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    doc_map = BookScanEngine.open_session_docs(session)

    try:
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
async def detect_crop_batch(session_id: str, req: BatchDetectCropRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

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
async def split_spread(session_id: str, req: SplitSpreadRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)
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
    if db is not None:
        SessionRepository.save_pages(db, session_id, new_pages)
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_selected_id": new_selected_id
    }

@router.post("/revert-spread/{session_id}")
async def revert_spread(session_id: str, req: RevertSpreadRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    try:
        new_pages, new_selected_id = BookScanEngine.revert_pages(
            session["pages"],
            page_id=req.page_id,
            revert_all=req.revert_all,
            target_page_ids=req.target_page_ids,
            single_level=req.single_level,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    if db is not None:
        SessionRepository.save_pages(db, session_id, new_pages)
    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_selected_id": new_selected_id
    }

@router.post("/revert-crop/{session_id}")
async def revert_crop(session_id: str, req: RevertCropRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)
    if not session.get("pages"):
        raise HTTPException(status_code=400, detail="No pages available in session.")

    BookScanEngine.revert_crop_pages(
        session["pages"],
        page_id=req.page_id,
        mode=req.mode,
        apply_to_all=req.apply_to_all,
        target_page_ids=req.target_page_ids,
    )

    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])

    return {
        "status": "ok",
        "pages": session["pages"]
    }

@router.post("/crop-page/{session_id}")
async def crop_page(session_id: str, req: CropPageRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)
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

    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])

    return {
        "status": "ok",
        "pages": session["pages"]
    }

@router.post("/restore-pages/{session_id}")
async def restore_pages(session_id: str, req: RestorePagesRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    try:
        session["pages"] = BookScanEngine.restore_pages(session["pages"], req.pages)
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    if db is not None:
        SessionRepository.save_pages(db, session_id, session["pages"])

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
    target_indices = getattr(req, "target_page_indices", None)
    if target_indices and len(target_indices) > 0:
        target_set = set(target_indices)
        filtered_pages = [p for i, p in enumerate(pages) if i in target_set]
        if filtered_pages:
            pages = filtered_pages

    total_pages = len(pages)
    EXPORT_JOBS[job_id]["total_pages"] = total_pages
    EXPORT_JOBS[job_id]["status"] = "processing"
    EXPORT_JOBS[job_id]["progress"] = 2
    EXPORT_JOBS[job_id]["stage"] = "processing_pages"
    EXPORT_JOBS[job_id]["message"] = f"Initializing export for {total_pages} page(s)..."

    with db_session() as db:
        SessionRepository.create_or_update_export_job(
            db,
            job_id=job_id,
            session_id=session_id,
            status="processing",
            stage="processing_pages",
            progress=2.0,
            message=f"Initializing export for {total_pages} page(s)...",
            total_pages=total_pages,
        )

    doc_map = BookScanEngine.open_session_docs(session)
    doc_paths = {
        "odds": session.get("odds_path"),
        "evens": session.get("evens_path"),
        "single": session.get("single_path"),
    }
    try:
        def export_progress(cur, total, msg):
            pct = int((cur / max(1, total)) * 96) + 2
            EXPORT_JOBS[job_id]["progress"] = max(2, min(98, pct))
            EXPORT_JOBS[job_id]["current_page"] = cur
            EXPORT_JOBS[job_id]["stage"] = "processing_pages"
            EXPORT_JOBS[job_id]["message"] = msg

        export_fmt = (getattr(req, "export_format", "pdf") or "pdf").lower()

        # Resolve clean original filename
        og_name = "Document"
        try:
            with db_session() as db:
                s_obj = SessionRepository.get_session(db, session_id)
                if s_obj:
                    og_name = s_obj.get("original_filename") or s_obj.get("title") or "Document"
        except Exception:
            pass

        clean_og = re.sub(r'^\d+_', '', og_name)
        base_og = os.path.splitext(clean_og)[0]
        base_og = re.sub(r'[^\w\-.]+', '_', base_og).strip('_') or "Document"
        first_session_part = session_id.split("-")[0] if "-" in session_id else session_id[:8]
        timestamp_str = time.strftime("%Y%m%d_%H%M%S")

        if export_fmt in ["pdf_split", "jpeg", "jpg", "png", "tiff", "tif"]:
            export_filename = f"{timestamp_str}_{base_og}_{first_session_part}_{export_fmt}.zip"
            output_file_path = asset_store.get_export_path(f"{job_id}_{export_filename}", "zip")
            media_type = "application/zip"
            success = BookScanEngine.stream_export_archive(
                doc_map=doc_map,
                pages=pages,
                req=req,
                output_zip_path=output_file_path,
                progress_callback=export_progress,
                doc_paths=doc_paths,
            )
        else:
            export_filename = f"{timestamp_str}_{base_og}_{first_session_part}.pdf"
            output_file_path = asset_store.get_export_path(f"{job_id}_{export_filename}", "pdf")
            media_type = "application/pdf"
            success = BookScanEngine.stream_export_pdf(
                doc_map=doc_map,
                pages=pages,
                req=req,
                output_pdf_path=output_file_path,
                progress_callback=export_progress,
                doc_paths=doc_paths,
            )

        if not success or not os.path.exists(output_file_path):
            EXPORT_JOBS[job_id]["status"] = "failed"
            EXPORT_JOBS[job_id]["error"] = "Export compilation failed."
            EXPORT_JOBS[job_id]["message"] = "Export compilation failed."
            with db_session() as db:
                SessionRepository.create_or_update_export_job(
                    db,
                    job_id=job_id,
                    session_id=session_id,
                    status="failed",
                    error="Export compilation failed.",
                    message="Export compilation failed.",
                )
            return

        file_size = os.path.getsize(output_file_path)
        EXPORT_JOBS[job_id]["status"] = "success"
        EXPORT_JOBS[job_id]["progress"] = 100
        EXPORT_JOBS[job_id]["stage"] = "completed"
        EXPORT_JOBS[job_id]["message"] = f"Export complete ({total_pages} pages)"
        EXPORT_JOBS[job_id]["output_path"] = output_file_path
        file_id = f"{job_id}_{export_filename}"
        EXPORT_JOBS[job_id]["file_id"] = file_id
        EXPORT_JOBS[job_id]["filename"] = export_filename
        EXPORT_JOBS[job_id]["media_type"] = media_type
        EXPORT_JOBS[job_id]["file_size_bytes"] = file_size
        EXPORT_JOBS[job_id]["download_url"] = f"/api/book-scan/export-download/{job_id}"

        with db_session() as db:
            SessionRepository.create_or_update_export_job(
                db,
                job_id=job_id,
                session_id=session_id,
                status="success",
                stage="completed",
                progress=100.0,
                message=f"Export complete ({total_pages} pages)",
                output_file_path=output_file_path,
                file_size_bytes=file_size,
            )
            # Only archive and mark done if this is a standard export, not a non-destructive studio handoff
            should_archive = getattr(req, "archive_session", True) and not getattr(req, "is_handoff", False)
            if should_archive:
                SessionRepository.update_session_meta(
                    db,
                    session_id=session_id,
                    tag="done",
                    status="archived",
                )
        if session_id in SESSIONS and should_archive:
            SESSIONS[session_id]["tag"] = "done"
            SESSIONS[session_id]["status"] = "archived"
    except Exception as e:
        EXPORT_JOBS[job_id]["status"] = "failed"
        EXPORT_JOBS[job_id]["error"] = str(e)
        EXPORT_JOBS[job_id]["message"] = f"Export failed: {str(e)}"
        with db_session() as db:
            SessionRepository.create_or_update_export_job(
                db,
                job_id=job_id,
                session_id=session_id,
                status="failed",
                error=str(e),
                message=f"Export failed: {str(e)}",
            )
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/export-job/{session_id}")
async def start_export_job(
    session_id: str,
    req: ExportRequest,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
):
    evict_stale_sessions()
    session = get_or_load_session(session_id, db)

    pages = session.get("pages", [])
    if not pages:
        raise HTTPException(status_code=400, detail="No pages available to export.")

    target_indices = getattr(req, "target_page_indices", None)
    if target_indices and len(target_indices) > 0:
        target_set = set(target_indices)
        filtered_pages = [p for i, p in enumerate(pages) if i in target_set]
        if filtered_pages:
            pages = filtered_pages

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

    if db is not None:
        SessionRepository.create_or_update_export_job(
            db,
            job_id=job_id,
            session_id=session_id,
            status="pending",
            stage="queued",
            progress=0.0,
            message="Export queued...",
            total_pages=len(pages),
        )

    background_tasks.add_task(_run_export_job, job_id, session_id, req)
    return {"job_id": job_id, "status": "started", "total_pages": len(pages)}

@router.get("/export-job/{job_id}")
async def get_export_job_status(job_id: str, db: DBSession = Depends(get_db)):
    job = EXPORT_JOBS.get(job_id)
    if not job and db is not None:
        db_job = SessionRepository.get_export_job(db, job_id)
        if db_job:
            return db_job
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
    db: DBSession = Depends(get_db),
):
    evict_stale_sessions()
    session = get_or_load_session(session_id, db)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    pages = session["pages"]
    if not pages:
        raise HTTPException(status_code=400, detail="No pages available to export.")

    doc_map = BookScanEngine.open_session_docs(session)

    try:
        og_name = "Document"
        if db is not None:
            s_obj = SessionRepository.get_session(db, session_id)
            if s_obj:
                og_name = s_obj.get("original_filename") or s_obj.get("title") or "Document"
        clean_og = re.sub(r'^\d+_', '', og_name)
        base_og = os.path.splitext(clean_og)[0]
        base_og = re.sub(r'[^\w\-.]+', '_', base_og).strip('_') or "Document"
        first_session_part = session_id.split("-")[0] if "-" in session_id else session_id[:8]
        timestamp_str = time.strftime("%Y%m%d_%H%M%S")
        export_filename = f"{timestamp_str}_{base_og}_{first_session_part}.pdf"
        output_pdf_path = asset_store.get_export_path(f"sync_{session_id[:8]}", "pdf")

        success = BookScanEngine.stream_export_pdf(
            doc_map=doc_map,
            pages=pages,
            req=req,
            output_pdf_path=output_pdf_path,
        )

        if not success:
            raise HTTPException(status_code=500, detail="PDF generation failed.")

        if db is not None:
            SessionRepository.update_session_meta(
                db,
                session_id=session_id,
                tag="done",
                status="archived",
            )
        if session_id in SESSIONS:
            SESSIONS[session_id]["tag"] = "done"
            SESSIONS[session_id]["status"] = "archived"

        return FileResponse(
            output_pdf_path,
            media_type="application/pdf",
            filename=export_filename
        )
    finally:
        BookScanEngine.close_session_docs(doc_map)

@router.post("/duplicate-page/{session_id}")
async def duplicate_page(session_id: str, req: DuplicatePageRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

    try:
        new_pages, new_id = BookScanEngine.duplicate_page(
            session["pages"],
            target_page_id=req.page_id,
            position=req.position,
        )
    except PageOpError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    session["pages"] = new_pages
    if db is not None:
        SessionRepository.save_pages(db, session_id, new_pages)

    return {
        "status": "ok",
        "total_pages": len(session["pages"]),
        "pages": session["pages"],
        "new_page_id": new_id,
    }

@router.post("/insert-blank/{session_id}")
async def insert_blank_page(session_id: str, req: InsertBlankPageRequest, db: DBSession = Depends(get_db)):
    session = get_or_load_session(session_id, db)

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
    if db is not None:
        SessionRepository.save_pages(db, session_id, new_pages)

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
    db: DBSession = Depends(get_db),
):
    session = get_or_load_session(session_id, db)

    page_info = next((p for p in session["pages"] if p["id"] == page_id), None)
    if not page_info:
        raise HTTPException(status_code=404, detail="Page not found.")

    fmt = format.lower()
    if fmt not in ["pdf", "png", "jpeg", "jpg", "webp"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Choose pdf, png, jpeg, or webp.")

    ext = "pdf" if fmt == "pdf" else ("jpg" if fmt in ["jpeg", "jpg"] else fmt)
    media_type = "application/pdf" if fmt == "pdf" else f"image/{fmt}"
    export_filename = f"page_{page_id[:8]}.{ext}"
    output_path = asset_store.get_export_path(f"page_{session_id[:8]}_{page_id[:8]}", ext)

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

# Multi-User Concurrency, Session Browsing & Locking Endpoints
@router.get("/sessions")
async def list_active_sessions(db: DBSession = Depends(get_db)):
    sessions = SessionRepository.list_sessions(db, studio_type="book_scan")
    return {
        "status": "ok",
        "sessions": [s.to_dict() for s in sessions]
    }

@router.post("/lock/{session_id}")
async def acquire_session_lock(
    session_id: str,
    workstation_id: str = Form(...),
    operator_name: str = Form("Operator"),
    ttl_seconds: int = Form(60),
    db: DBSession = Depends(get_db),
):
    success, lock_info = SessionRepository.acquire_lock(
        db,
        session_id=session_id,
        workstation_id=workstation_id,
        operator_name=operator_name,
        ttl_seconds=ttl_seconds,
    )
    if not success:
        return {
            "status": "locked",
            "message": f"Session is currently active by {lock_info.get('operator_name', 'another operator')} on {lock_info.get('workstation_id')}.",
            "lock": lock_info,
        }
    return {"status": "ok", "lock": lock_info}

@router.delete("/lock/{session_id}")
async def release_session_lock(
    session_id: str,
    workstation_id: str = Form(...),
    db: DBSession = Depends(get_db),
):
    released = SessionRepository.release_lock(db, session_id, workstation_id)
    return {"status": "ok", "released": released}

@router.get("/lock/{session_id}")
async def get_session_lock_status(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    session = SessionRepository.get_session(db, session_id)
    if not session or not session.lock:
        return {"status": "unlocked", "is_locked": False}
    return {"status": "ok", "is_locked": session.lock.is_active(), "lock": session.lock.to_dict()}

