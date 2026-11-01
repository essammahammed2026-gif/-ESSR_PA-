import os
import re
import uuid
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from db.session import get_db
from db.repository import SessionRepository
from db.models import SessionModel, ExportJobModel
from storage.asset_store import asset_store
from engines.intake_engine import IntakeEngine

router = APIRouter()


# --- Pydantic Request Models ---

class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    original_filename: Optional[str] = None
    status: Optional[str] = None  # 'active', 'archived', 'completed'
    tag: Optional[str] = None     # 'pending', 'in-progress', 'done'
    notes: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class BatchUpdateSessionRequest(BaseModel):
    session_ids: List[str]
    tag: Optional[str] = None
    status: Optional[str] = None


class NoteCreateRequest(BaseModel):
    text: str


class NoteUpdateRequest(BaseModel):
    text: str


class SequentialCombineRequest(BaseModel):
    file_ids: List[str]
    reverse_indices: List[int] = Field(default_factory=list)
    output_title: Optional[str] = None


class DuplexCombineRequest(BaseModel):
    odds_file_id: str
    evens_file_id: str
    odds_order: str = "forward"  # 'forward' or 'reverse'
    evens_order: str = "reverse"  # 'reverse' or 'forward'
    start_with: str = "odds"  # 'odds' or 'evens'
    output_title: Optional[str] = None


class RenameIntakeAssetRequest(BaseModel):
    filename: str


class BatchDeleteIntakeRequest(BaseModel):
    file_ids: List[str]


class PruneIntakeByDateRequest(BaseModel):
    before_timestamp: float


class BatchDeleteSessionRequest(BaseModel):
    session_ids: List[str]
    permanent: bool = True



# --- Sessions CRUD & Registry ---

@router.get("/api/sessions")
def list_dashboard_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    studio_type: Optional[str] = Query(None),
    status: Optional[str] = Query("active"),
    tag: Optional[str] = Query(None),
    date_preset: Optional[str] = Query(None),
    date_from: Optional[float] = Query(None),
    date_to: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    db: DBSession = Depends(get_db),
):
    """
    Lists paginated sessions for the dashboard with date filtering, tag filtering,
    deep notes search, thumbnails, and lock metadata.
    """
    now = time.time()
    effective_from = date_from if isinstance(date_from, (int, float)) else None
    effective_to = date_to if isinstance(date_to, (int, float)) else None
    date_preset_val = date_preset if isinstance(date_preset, str) else None

    if date_preset_val == "today":
        # Midnight of today
        import datetime
        today_midnight = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        effective_from = today_midnight.timestamp()
    elif date_preset_val == "week":
        effective_from = now - (7 * 86400)
    elif date_preset_val == "month":
        effective_from = now - (30 * 86400)

    page_num = page if isinstance(page, int) else 1
    page_sz = page_size if isinstance(page_size, int) else 10
    studio_val = studio_type if isinstance(studio_type, str) else None
    status_val = status if isinstance(status, str) else "active"
    tag_val = tag if isinstance(tag, str) else None
    search_val = search if isinstance(search, str) else None

    sessions, total_count = SessionRepository.list_sessions(
        db,
        studio_type=studio_val,
        status=status_val,
        tag=tag_val,
        date_from=effective_from,
        date_to=effective_to,
        search=search_val,
        page=page_num,
        page_size=page_sz,
    )

    results: List[Dict[str, Any]] = []
    for s in sessions:
        pages = s.pages or []
        first_page = pages[0] if pages else None
        first_page_thumb = None
        if first_page:
            first_page_thumb = f"/api/book-scan/page-thumbnail/{s.id}/{first_page.id}"

        lock_data = s.lock.to_dict() if s.lock and s.lock.is_active() else None

        results.append({
            "id": s.id,
            "studio_type": s.studio_type,
            "title": s.title or f"Session {s.id[:8]}",
            "original_filename": s.original_filename or s.title or f"Session {s.id[:8]}",
            "file_size": s.file_size_bytes or 0,
            "file_size_bytes": s.file_size_bytes or 0,
            "status": s.status,
            "trash_reason": s.trash_reason,
            "tag": s.tag or "in-progress",
            "notes": s.notes or "",
            "total_pages": len(pages),
            "width_mm": first_page.width_mm if first_page else 210.0,
            "height_mm": first_page.height_mm if first_page else 297.0,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "thumbnail_url": first_page_thumb,
            "lock": lock_data,
        })

    total_pages = max(1, (total_count + page_sz - 1) // page_sz) if total_count > 0 else 1

    return {
        "success": True,
        "sessions": results,
        "total_count": total_count,
        "page": page_num,
        "page_size": page_sz,
        "total_pages": total_pages,
    }


@router.post("/api/sessions/batch")
def batch_update_sessions_endpoint(
    req: BatchUpdateSessionRequest,
    db: DBSession = Depends(get_db),
):
    """Batch updates tags or status across multiple sessions."""
    updated_count = SessionRepository.batch_update_sessions(
        db,
        session_ids=req.session_ids,
        tag=req.tag,
        status=req.status,
    )
    return {"success": True, "updated_count": updated_count}


@router.get("/api/sessions/{session_id}")
def get_session_details(session_id: str, db: DBSession = Depends(get_db)):
    """Retrieves full session model with page deck and lock state."""
    session = SessionRepository.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "session": session.to_dict()}


@router.patch("/api/sessions/{session_id}")
def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    db: DBSession = Depends(get_db),
):
    """Updates session title, original_filename, tag, notes, status, or settings."""
    updated = SessionRepository.update_session_meta(
        db,
        session_id=session_id,
        title=req.title,
        original_filename=req.original_filename,
        status=req.status,
        tag=req.tag,
        notes=req.notes,
        settings=req.settings,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "session": updated.to_dict()}
    return {"success": True, "session": updated.to_dict()}


@router.delete("/api/sessions/{session_id}")
def delete_session_record(
    session_id: str,
    permanent: bool = Query(False),
    db: DBSession = Depends(get_db),
):
    """
    Deletes a session. By default, performs a soft delete (moves to trash).
    If permanent=True, permanently removes from SQLite and purges storage.
    """
    if permanent:
        deleted = SessionRepository.delete_session(db, session_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Session not found")
        freed_bytes = asset_store.purge_session(session_id)
        return {
            "success": True,
            "session_id": session_id,
            "permanent": True,
            "freed_bytes": freed_bytes,
        }

    # Soft delete
    soft_deleted = SessionRepository.soft_delete_session(db, session_id, reason="deleted")
    if not soft_deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "success": True,
        "session_id": session_id,
        "status": "trash",
        "trash_reason": "deleted",
    }


@router.post("/api/sessions/{session_id}/restore")
def restore_session_record(session_id: str, db: DBSession = Depends(get_db)):
    """Restores a session from trash back to active."""
    restored = SessionRepository.restore_session(db, session_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "session_id": session_id, "status": "active"}


@router.delete("/api/sessions/{session_id}/permanent")
def permanent_delete_session_record(session_id: str, db: DBSession = Depends(get_db)):
    """Permanently deletes a session and purges its storage."""
    deleted = SessionRepository.delete_session(db, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    freed_bytes = asset_store.purge_session(session_id)
    return {
        "success": True,
        "session_id": session_id,
        "freed_bytes": freed_bytes,
    }


@router.post("/api/sessions/trash/empty")
def empty_trash_records(db: DBSession = Depends(get_db)):
    """Permanently empties all trash sessions and purges their storage."""
    session_ids = SessionRepository.empty_trash(db)
    total_freed_bytes = 0
    for sid in session_ids:
        try:
            total_freed_bytes += asset_store.purge_session(sid)
        except Exception:
            pass
    return {
        "success": True,
        "purged_count": len(session_ids),
        "total_freed_bytes": total_freed_bytes,
    }


# --- Multi-Note Timeline Endpoints ---

@router.get("/api/sessions/{session_id}/notes")
def get_session_notes(session_id: str, db: DBSession = Depends(get_db)):
    """Returns the list of notes with timestamps for a session."""
    notes = SessionRepository.get_notes(db, session_id)
    return {"success": True, "session_id": session_id, "notes": notes}


@router.post("/api/sessions/{session_id}/notes")
def add_session_note(
    session_id: str,
    req: NoteCreateRequest,
    db: DBSession = Depends(get_db),
):
    """Adds a new timestamped note to a session."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Note text cannot be empty")
    try:
        notes = SessionRepository.add_note(db, session_id, req.text)
        return {"success": True, "session_id": session_id, "notes": notes}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/api/sessions/{session_id}/notes/{note_id}")
def update_session_note(
    session_id: str,
    note_id: str,
    req: NoteUpdateRequest,
    db: DBSession = Depends(get_db),
):
    """Updates an existing note's text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Note text cannot be empty")
    try:
        notes = SessionRepository.update_note(db, session_id, note_id, req.text)
        return {"success": True, "session_id": session_id, "notes": notes}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/api/sessions/{session_id}/notes/{note_id}")
def delete_session_note(
    session_id: str,
    note_id: str,
    db: DBSession = Depends(get_db),
):
    """Deletes a specific note from a session."""
    try:
        notes = SessionRepository.delete_note(db, session_id, note_id)
        return {"success": True, "session_id": session_id, "notes": notes}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Export Jobs Tracking & Downloads ---

@router.get("/api/sessions/exports/jobs")
def list_export_deliverables(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    limit: Optional[int] = Query(None, ge=1, le=100),
    status: Optional[str] = Query("all"),
    db: DBSession = Depends(get_db),
):
    """Lists background export deliverables and their current progress with pagination and status filters."""
    actual_page_size = limit if limit is not None else page_size
    jobs, total_count = SessionRepository.list_export_jobs_paginated(
        db, page=page, page_size=actual_page_size, status=status
    )
    total_pages = max(1, (total_count + actual_page_size - 1) // actual_page_size) if total_count > 0 else 1
    return {
        "success": True,
        "jobs": jobs,
        "total_count": total_count,
        "page": page,
        "page_size": actual_page_size,
        "total_pages": total_pages,
    }


@router.delete("/api/sessions/exports/{job_id}")
def delete_export_deliverable(job_id: str, db: DBSession = Depends(get_db)):
    """Deletes an export job record and removes the file from disk."""
    job = SessionRepository.get_export_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    output_path = job.get("outputFilePath")
    if output_path and os.path.isfile(output_path):
        try:
            os.remove(output_path)
        except OSError:
            pass

    deleted = SessionRepository.delete_export_job(db, job_id)
    return {"success": deleted, "job_id": job_id}


@router.get("/api/sessions/exports/{job_id}/download")
def download_export_deliverable(job_id: str, db: DBSession = Depends(get_db)):
    """Direct file download for a completed export deliverable."""
    job = SessionRepository.get_export_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    output_path = job.get("outputFilePath")
    if not output_path or not os.path.isfile(output_path):
        raise HTTPException(status_code=404, detail="Exported deliverable file is missing from disk")

    raw_filename = os.path.basename(output_path)
    clean_filename = re.sub(r'^(?:sync_|export_)?[a-f0-9\-]{8,36}_', '', raw_filename)
    return FileResponse(
        path=output_path,
        filename=clean_filename or raw_filename,
        media_type="application/octet-stream",
    )


# --- Workshop Telemetry & Storage Stats ---

@router.get("/api/sessions/telemetry/stats")
def get_workshop_telemetry(db: DBSession = Depends(get_db)):
    """Computes high-level workshop statistics: active sessions, exports, disk usage."""
    storage_stats = asset_store.get_stats()
    active_sessions, active_count = SessionRepository.list_sessions(db, status="active", page=1, page_size=1000)
    archived_sessions, archived_count = SessionRepository.list_sessions(db, status="archived", page=1, page_size=1000)
    export_jobs = SessionRepository.list_export_jobs(db, limit=100)

    by_studio: Dict[str, int] = {}
    for s in active_sessions:
        st = s.studio_type or "book_scan"
        by_studio[st] = by_studio.get(st, 0) + 1

    processing_exports = sum(1 for j in export_jobs if j.get("status") in ["queued", "processing"])

    return {
        "success": True,
        "total_active_sessions": active_count,
        "total_archived_sessions": archived_count,
        "sessions_by_studio": by_studio,
        "processing_exports": processing_exports,
        "total_exports": len(export_jobs),
        "storage": storage_stats,
    }


# --- Staged Batch Intake & Collation Endpoints ---

@router.get("/api/intake/assets")
def list_intake_assets_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=1000),
    search: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    date_preset: Optional[str] = Query(None),
    date_from: Optional[float] = Query(None),
    date_to: Optional[float] = Query(None),
    db: DBSession = Depends(get_db),
):
    """
    Lists paginated staged intake assets persisted in SQLite with search, file type, and date filters.
    Automatically synchronizes with files in storage/originals to recover any unindexed uploads.
    """
    import math
    now = time.time()
    effective_from = date_from if isinstance(date_from, (int, float)) else None
    effective_to = date_to if isinstance(date_to, (int, float)) else None
    date_preset_val = date_preset if isinstance(date_preset, str) else None

    if date_preset_val == "today":
        import datetime
        today_midnight = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        effective_from = today_midnight.timestamp()
    elif date_preset_val == "week":
        effective_from = now - (7 * 86400)
    elif date_preset_val == "month":
        effective_from = now - (30 * 86400)

    SessionRepository.sync_intake_assets_with_disk(db, asset_store.originals_dir)
    assets, total_count = SessionRepository.list_intake_assets(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        file_type=file_type,
        date_from=effective_from,
        date_to=effective_to,
    )
    total_pages = max(1, math.ceil(total_count / page_size)) if page_size else 1

    return {
        "success": True,
        "assets": [a.to_dict() for a in assets],
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.patch("/api/intake/assets/{file_id}")
def rename_intake_asset_endpoint(
    file_id: str,
    req: RenameIntakeAssetRequest,
    db: DBSession = Depends(get_db),
):
    """Renames the display filename of a staged intake asset in SQLite."""
    clean_name = req.filename.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Filename cannot be blank")

    asset = SessionRepository.rename_intake_asset(db, file_id, clean_name)
    if not asset:
        raise HTTPException(status_code=404, detail="Staged intake asset not found")

    return {"success": True, "asset": asset.to_dict()}



@router.post("/api/intake/upload-batch")
async def upload_intake_batch(
    files: List[UploadFile] = File(...),
    db: DBSession = Depends(get_db),
):
    """
    Uploads multiple files into the asset store originals tier, probes geometry/page counts,
    and transactionally persists them into SQLite intake_assets so they persist across refreshes.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    results: List[Dict[str, Any]] = []

    for f in files:
        safe_name = os.path.basename(f.filename or "upload.pdf")
        # Prefix with timestamp to prevent collisions
        prefixed_name = f"{int(time.time() * 1000)}_{safe_name}"
        _, abs_path = asset_store.save_original(prefixed_name, f.file)

        meta = IntakeEngine.probe_file_meta(abs_path)
        asset_record = SessionRepository.create_intake_asset(
            db=db,
            file_id=prefixed_name,
            filename=safe_name,
            file_path=abs_path,
            file_size=meta.get("file_size", 0),
            page_count=meta.get("page_count", 1),
            width_mm=meta.get("width_mm", 210.0),
            height_mm=meta.get("height_mm", 297.0),
        )
        results.append(asset_record.to_dict())

    return {"success": True, "files": results}


@router.post("/api/intake/combine-sequential")
def combine_sequential_endpoint(
    req: SequentialCombineRequest,
    db: DBSession = Depends(get_db),
):
    """Combines a list of uploaded files in sequential order with optional per-file reversal."""
    file_paths: List[str] = []
    for fid in req.file_ids:
        path = asset_store.resolve_asset_file(fid)
        if not path:
            raise HTTPException(status_code=404, detail=f"File not found: {fid}")
        file_paths.append(path)

    out_name = f"combined_{int(time.time() * 1000)}.pdf"
    out_path = os.path.join(asset_store.originals_dir, out_name)

    reverse_set = set(req.reverse_indices)
    success = IntakeEngine.combine_sequential(file_paths, out_path, reverse_indices=reverse_set)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to combine files sequentially")

    meta = IntakeEngine.probe_file_meta(out_path)
    combined_title = req.output_title or out_name
    asset_record = SessionRepository.create_intake_asset(
        db=db,
        file_id=out_name,
        filename=combined_title,
        file_path=out_path,
        file_size=meta.get("file_size", 0),
        page_count=meta.get("page_count", 1),
        width_mm=meta.get("width_mm", 210.0),
        height_mm=meta.get("height_mm", 297.0),
    )
    return {
        "success": True,
        **asset_record.to_dict(),
    }


@router.post("/api/intake/combine-duplex")
def combine_duplex_endpoint(
    req: DuplexCombineRequest,
    db: DBSession = Depends(get_db),
):
    """Interleaves Odds and Evens files with optional reverse-evens support."""
    odds_path = asset_store.resolve_asset_file(req.odds_file_id)
    if not odds_path:
        raise HTTPException(status_code=404, detail=f"Odds file not found: {req.odds_file_id}")

    evens_path = asset_store.resolve_asset_file(req.evens_file_id)
    if not evens_path:
        raise HTTPException(status_code=404, detail=f"Evens file not found: {req.evens_file_id}")

    out_name = f"duplex_combined_{int(time.time() * 1000)}.pdf"
    out_path = os.path.join(asset_store.originals_dir, out_name)

    success = IntakeEngine.combine_duplex_scans(
        odds_path=odds_path,
        evens_path=evens_path,
        output_pdf_path=out_path,
        odds_order=req.odds_order,
        evens_order=req.evens_order,
        start_with=req.start_with,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to interleave duplex scans")

    meta = IntakeEngine.probe_file_meta(out_path)
    duplex_title = req.output_title or out_name
    asset_record = SessionRepository.create_intake_asset(
        db=db,
        file_id=out_name,
        filename=duplex_title,
        file_path=out_path,
        file_size=meta.get("file_size", 0),
        page_count=meta.get("page_count", 1),
        width_mm=meta.get("width_mm", 210.0),
        height_mm=meta.get("height_mm", 297.0),
    )
    return {
        "success": True,
        **asset_record.to_dict(),
    }


@router.delete("/api/intake/assets/{file_id}")
def delete_intake_asset_endpoint(file_id: str, db: DBSession = Depends(get_db)):
    """Removes an intake asset from the database and safely cleans up its file from originals storage."""
    asset = SessionRepository.get_intake_asset(db, file_id)
    if not asset:
        # Check if file exists anyway
        path = asset_store.resolve_asset_file(file_id)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
        return {"success": True, "file_id": file_id}

    file_path = asset.file_path
    if file_path and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass

    deleted = SessionRepository.delete_intake_asset(db, file_id)
    return {"success": deleted, "file_id": file_id}


@router.delete("/api/intake/assets")
def clear_intake_assets_endpoint(db: DBSession = Depends(get_db)):
    """Clears all staged intake assets from the database and removes them from originals storage."""
    assets = SessionRepository.list_intake_assets(db)
    for a in assets:
        if a.file_path and os.path.isfile(a.file_path):
            try:
                os.remove(a.file_path)
            except OSError:
                pass
    count = SessionRepository.clear_intake_assets(db)
    return {"success": True, "count": count}


@router.post("/api/intake/assets/batch-delete")
def batch_delete_intake_assets_endpoint(
    req: BatchDeleteIntakeRequest,
    db: DBSession = Depends(get_db),
):
    """Batch deletes selected staged intake files and removes them from originals storage."""
    deleted_count = 0
    freed_bytes = 0
    for fid in req.file_ids:
        asset = SessionRepository.get_intake_asset(db, fid)
        if asset:
            if asset.file_path and os.path.isfile(asset.file_path):
                try:
                    freed_bytes += os.path.getsize(asset.file_path)
                    os.remove(asset.file_path)
                except OSError:
                    pass
            SessionRepository.delete_intake_asset(db, fid)
            deleted_count += 1
        else:
            path = asset_store.resolve_asset_file(fid)
            if path and os.path.isfile(path):
                try:
                    freed_bytes += os.path.getsize(path)
                    os.remove(path)
                except OSError:
                    pass
                deleted_count += 1

    return {
        "success": True,
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes,
    }


@router.post("/api/intake/assets/prune-by-date")
def prune_intake_assets_by_date_endpoint(
    req: PruneIntakeByDateRequest,
    db: DBSession = Depends(get_db),
):
    """Deletes staged intake files created before the specified timestamp."""
    from db.models import IntakeAssetModel
    stale_assets = (
        db.query(IntakeAssetModel)
        .filter(IntakeAssetModel.created_at < req.before_timestamp)
        .all()
    )
    deleted_count = 0
    freed_bytes = 0
    for a in stale_assets:
        if a.file_path and os.path.isfile(a.file_path):
            try:
                freed_bytes += os.path.getsize(a.file_path)
                os.remove(a.file_path)
            except OSError:
                pass
        db.delete(a)
        deleted_count += 1
    db.commit()

    return {
        "success": True,
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes,
    }


@router.post("/api/sessions/batch-delete")
def batch_delete_sessions_endpoint(
    req: BatchDeleteSessionRequest,
    db: DBSession = Depends(get_db),
):
    """Batch deletes multiple sessions. Either soft-deletes to trash or permanently purges."""
    deleted_count = 0
    freed_bytes = 0

    for sid in req.session_ids:
        if req.permanent:
            deleted = SessionRepository.delete_session(db, sid)
            if deleted:
                freed_bytes += asset_store.purge_session(sid)
                deleted_count += 1
        else:
            soft_deleted = SessionRepository.soft_delete_session(db, sid, reason="deleted")
            if soft_deleted:
                deleted_count += 1

    return {
        "success": True,
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes,
        "permanent": req.permanent,
    }

