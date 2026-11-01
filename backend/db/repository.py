import os
import json
import uuid
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from db.models import SessionModel, PageModel, SessionLockModel, ExportJobModel, IntakeAssetModel


class SessionRepository:
    """Transactional repository managing session lifecycle, pages, and multi-user locks."""

    @staticmethod
    def create_session(
        db: Session,
        session_id: str,
        studio_type: str = "book_scan",
        intake_mode: str = "single",
        is_spread: bool = False,
        session_dir: str = "",
        title: Optional[str] = None,
        original_filename: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        tag: str = "in-progress",
        notes: Optional[str] = None,
        pages_data: Optional[List[Dict[str, Any]]] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> SessionModel:
        clean_title = title or (original_filename or f"Session {session_id[:8]}")
        session = SessionModel(
            id=session_id,
            studio_type=studio_type,
            title=clean_title,
            original_filename=original_filename or clean_title,
            file_size_bytes=file_size_bytes,
            intake_mode=intake_mode,
            is_spread=is_spread,
            tag=tag,
            notes=notes or "",
            session_dir=session_dir,
            settings=settings or {},
            rev=1,
            created_at=time.time(),
            updated_at=time.time(),
        )
        db.add(session)
        db.flush()

        if pages_data:
            for idx, p_dict in enumerate(pages_data):
                page_obj = PageModel.from_dict(session_id, idx, p_dict)
                db.add(page_obj)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_session(db: Session, session_id: str) -> Optional[SessionModel]:
        return (
            db.query(SessionModel)
            .options(joinedload(SessionModel.pages), joinedload(SessionModel.lock))
            .filter(SessionModel.id == session_id)
            .first()
        )

    @staticmethod
    def verify_session_files(session: SessionModel) -> bool:
        """Checks whether the physical files for the session still exist on disk."""
        if not session.session_dir:
            return False
        if not os.path.exists(session.session_dir):
            return False
        return True

    @staticmethod
    def list_sessions(
        db: Session,
        studio_type: Optional[str] = None,
        status: Optional[str] = "active",
        tag: Optional[str] = None,
        date_from: Optional[float] = None,
        date_to: Optional[float] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[SessionModel], int]:
        # Pre-flight check: if an active/archived session's physical directory is gone,
        # automatically flag and move it to trash with reason "file_not_found".
        active_sessions = db.query(SessionModel).filter(SessionModel.status.in_(["active", "archived"])).all()
        has_updates = False
        now = time.time()
        for s in active_sessions:
            if not SessionRepository.verify_session_files(s):
                s.status = "trash"
                s.trash_reason = "file_not_found"
                s.updated_at = now
                has_updates = True

        if has_updates:
            db.commit()

        q = db.query(SessionModel)

        if status == "trash":
            q = q.filter(SessionModel.status == "trash")
        elif status and status != "all":
            q = q.filter(SessionModel.status == status)
        else:
            # When status is "all" or omitted, exclude trash by default
            q = q.filter(SessionModel.status != "trash")

        if studio_type and studio_type != "all":
            q = q.filter(SessionModel.studio_type == studio_type)
        if tag and tag != "all":
            q = q.filter(SessionModel.tag == tag)
        if date_from is not None and isinstance(date_from, (int, float)):
            q = q.filter(SessionModel.updated_at >= date_from)
        if date_to is not None and isinstance(date_to, (int, float)):
            q = q.filter(SessionModel.updated_at <= date_to)
        if search and isinstance(search, str) and search.strip():
            s_term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    SessionModel.title.ilike(s_term),
                    SessionModel.id.ilike(s_term),
                    SessionModel.original_filename.ilike(s_term),
                    SessionModel.notes.ilike(s_term),
                )
            )

        total_count = q.count()
        offset = max(0, (page - 1) * page_size)
        items = q.order_by(SessionModel.updated_at.desc()).offset(offset).limit(page_size).all()
        return items, total_count

    @staticmethod
    def save_pages(
        db: Session,
        session_id: str,
        pages_data: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Atomically replaces the page deck of a session and increments session rev."""
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Delete old pages
        db.query(PageModel).filter(PageModel.session_id == session_id).delete(synchronize_session="fetch")

        # Insert new pages
        new_pages = []
        for idx, p_dict in enumerate(pages_data):
            p_obj = PageModel.from_dict(session_id, idx, p_dict)
            db.add(p_obj)
            new_pages.append(p_obj)

        session.rev = (session.rev or 0) + 1
        session.updated_at = time.time()
        db.commit()

        return [p.to_dict() for p in new_pages]

    @staticmethod
    def get_pages(db: Session, session_id: str) -> List[Dict[str, Any]]:
        pages = (
            db.query(PageModel)
            .filter(PageModel.session_id == session_id)
            .order_by(PageModel.sort_order.asc())
            .all()
        )
        return [p.to_dict() for p in pages]

    @staticmethod
    def update_page_attributes(
        db: Session,
        session_id: str,
        page_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        page = (
            db.query(PageModel)
            .filter(PageModel.session_id == session_id, PageModel.id == page_id)
            .first()
        )
        if not page:
            return None

        for k, v in updates.items():
            if hasattr(page, k):
                setattr(page, k, v)

        page.rev = (page.rev or 0) + 1
        db.commit()
        db.refresh(page)
        return page.to_dict()

    @staticmethod
    def soft_delete_session(db: Session, session_id: str, reason: str = "deleted") -> bool:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return False
        session.status = "trash"
        session.trash_reason = reason
        session.updated_at = time.time()
        db.commit()
        return True

    @staticmethod
    def restore_session(db: Session, session_id: str) -> bool:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return False
        session.status = "active"
        session.trash_reason = None
        session.updated_at = time.time()
        db.commit()
        return True

    @staticmethod
    def empty_trash(db: Session) -> List[str]:
        trash_sessions = db.query(SessionModel).filter(SessionModel.status == "trash").all()
        session_ids = [s.id for s in trash_sessions]
        for s in trash_sessions:
            db.delete(s)
        db.commit()
        return session_ids

    @staticmethod
    def delete_session(db: Session, session_id: str) -> bool:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    @staticmethod
    def _parse_notes(raw: Optional[str]) -> List[Dict[str, Any]]:
        if not raw or not raw.strip():
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [{
            "id": "initial",
            "text": raw.strip(),
            "created_at": time.time(),
            "updated_at": time.time(),
        }]

    @staticmethod
    def _serialize_notes(notes: List[Dict[str, Any]]) -> str:
        return json.dumps(notes)

    @staticmethod
    def get_notes(db: Session, session_id: str) -> List[Dict[str, Any]]:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return []
        return SessionRepository._parse_notes(session.notes)

    @staticmethod
    def add_note(db: Session, session_id: str, text: str) -> List[Dict[str, Any]]:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        notes = SessionRepository._parse_notes(session.notes)
        now = time.time()
        new_note = {
            "id": str(uuid.uuid4())[:12],
            "text": text.strip(),
            "created_at": now,
            "updated_at": now,
        }
        notes.insert(0, new_note)
        session.notes = SessionRepository._serialize_notes(notes)
        session.updated_at = now
        db.commit()
        return notes

    @staticmethod
    def update_note(db: Session, session_id: str, note_id: str, new_text: str) -> List[Dict[str, Any]]:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        notes = SessionRepository._parse_notes(session.notes)
        now = time.time()
        for n in notes:
            if n["id"] == note_id:
                n["text"] = new_text.strip()
                n["updated_at"] = now
                break
        session.notes = SessionRepository._serialize_notes(notes)
        session.updated_at = now
        db.commit()
        return notes

    @staticmethod
    def delete_note(db: Session, session_id: str, note_id: str) -> List[Dict[str, Any]]:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        notes = [n for n in SessionRepository._parse_notes(session.notes) if n["id"] != note_id]
        session.notes = SessionRepository._serialize_notes(notes)
        session.updated_at = time.time()
        db.commit()
        return notes

    @staticmethod
    def update_session_meta(
        db: Session,
        session_id: str,
        title: Optional[str] = None,
        original_filename: Optional[str] = None,
        status: Optional[str] = None,
        tag: Optional[str] = None,
        notes: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Optional[SessionModel]:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return None
        if title is not None:
            session.title = title
        if original_filename is not None:
            session.original_filename = original_filename
        if tag is not None:
            session.tag = tag
            if tag == "done":
                session.status = "archived"
        if status is not None:
            session.status = status
        if notes is not None:
            session.notes = notes
        if settings is not None:
            session.settings = settings
        session.updated_at = time.time()
        session.rev = (session.rev or 0) + 1
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def batch_update_sessions(
        db: Session,
        session_ids: List[str],
        tag: Optional[str] = None,
        status: Optional[str] = None,
    ) -> int:
        """
        Updates tag and/or status across multiple sessions.
        Rule: If tag is 'done', status is automatically set to 'archived'.
        Rule: If status is set to 'archived', existing tag is preserved unless explicitly provided.
        """
        if not session_ids:
            return 0

        sessions = db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).all()
        now = time.time()
        for s in sessions:
            if tag:
                s.tag = tag
                if tag == "done":
                    s.status = "archived"
            if status:
                s.status = status
            s.updated_at = now
            s.rev = (s.rev or 0) + 1

        db.commit()
        return len(sessions)

    # Multi-User Concurrency & Session Locks
    @staticmethod
    def acquire_lock(
        db: Session,
        session_id: str,
        workstation_id: str,
        operator_name: str = "Operator",
        ttl_seconds: int = 60,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Attempts to acquire a lease on the session.
        Returns (success: bool, current_lock_info: dict).
        """
        now = time.time()
        lock = db.query(SessionLockModel).filter(SessionLockModel.session_id == session_id).first()

        if lock:
            if lock.is_active() and lock.workstation_id != workstation_id:
                # Locked by another active workstation
                return False, lock.to_dict()
            # Renew expired lock or own lock
            lock.workstation_id = workstation_id
            lock.operator_name = operator_name
            lock.lease_expires_at = now + ttl_seconds
        else:
            lock = SessionLockModel(
                session_id=session_id,
                workstation_id=workstation_id,
                operator_name=operator_name,
                lease_expires_at=now + ttl_seconds,
            )
            db.add(lock)

        db.commit()
        db.refresh(lock)
        return True, lock.to_dict()

    @staticmethod
    def release_lock(db: Session, session_id: str, workstation_id: str) -> bool:
        lock = (
            db.query(SessionLockModel)
            .filter(
                SessionLockModel.session_id == session_id,
                SessionLockModel.workstation_id == workstation_id,
            )
            .first()
        )
        if lock:
            db.delete(lock)
            db.commit()
            return True
        return False

    # Export Job Tracking
    @staticmethod
    def create_or_update_export_job(
        db: Session,
        job_id: str,
        session_id: str,
        status: str = "queued",
        stage: str = "init",
        progress: float = 0.0,
        message: str = "",
        current_page: int = 0,
        total_pages: int = 0,
        output_file_path: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        error: Optional[str] = None,
    ) -> ExportJobModel:
        job = db.query(ExportJobModel).filter(ExportJobModel.id == job_id).first()
        now = time.time()
        if not job:
            job = ExportJobModel(
                id=job_id,
                session_id=session_id,
                status=status,
                stage=stage,
                progress=progress,
                message=message,
                current_page=current_page,
                total_pages=total_pages,
                output_file_path=output_file_path,
                file_size_bytes=file_size_bytes,
                error=error,
                created_at=now,
                updated_at=now,
            )
            db.add(job)
        else:
            job.status = status
            job.stage = stage
            job.progress = progress
            job.message = message
            job.current_page = current_page
            job.total_pages = total_pages
            if output_file_path:
                job.output_file_path = output_file_path
            if file_size_bytes is not None:
                job.file_size_bytes = file_size_bytes
            if error is not None:
                job.error = error
            job.updated_at = now

        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def get_export_job(db: Session, job_id: str) -> Optional[Dict[str, Any]]:
        job = db.query(ExportJobModel).filter(ExportJobModel.id == job_id).first()
        return job.to_dict() if job else None

    @staticmethod
    def list_export_jobs_paginated(
        db: Session,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        q = db.query(ExportJobModel)
        if status and status != "all":
            if status in ["success", "completed"]:
                q = q.filter(ExportJobModel.status == "completed")
            elif status in ["fail", "failed"]:
                q = q.filter(ExportJobModel.status == "failed")
            else:
                q = q.filter(ExportJobModel.status == status)
        total_count = q.count()
        offset = max(0, (page - 1) * page_size)
        jobs = q.order_by(ExportJobModel.created_at.desc()).offset(offset).limit(page_size).all()
        return [j.to_dict() for j in jobs], total_count

    @staticmethod
    def list_export_jobs(
        db: Session,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        q = db.query(ExportJobModel)
        if status and status != "all":
            q = q.filter(ExportJobModel.status == status)
        jobs = q.order_by(ExportJobModel.created_at.desc()).limit(limit).all()
        return [j.to_dict() for j in jobs]

    @staticmethod
    def delete_export_job(db: Session, job_id: str) -> bool:
        job = db.query(ExportJobModel).filter(ExportJobModel.id == job_id).first()
        if job:
            db.delete(job)
            db.commit()
            return True
        return False

    # --- Intake Assets CRUD ---

    @staticmethod
    def create_intake_asset(
        db: Session,
        file_id: str,
        filename: str,
        file_path: str,
        file_size: int = 0,
        page_count: int = 1,
        width_mm: float = 0.0,
        height_mm: float = 0.0,
        created_at: Optional[float] = None,
    ) -> IntakeAssetModel:
        asset = db.query(IntakeAssetModel).filter(IntakeAssetModel.id == file_id).first()
        if asset:
            asset.filename = filename
            asset.file_path = file_path
            asset.file_size = file_size
            asset.page_count = page_count
            asset.width_mm = width_mm
            asset.height_mm = height_mm
            if created_at is not None:
                asset.created_at = created_at
        else:
            asset = IntakeAssetModel(
                id=file_id,
                filename=filename,
                file_path=file_path,
                file_size=file_size,
                page_count=page_count,
                width_mm=width_mm,
                height_mm=height_mm,
                created_at=created_at or time.time(),
            )
            db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def list_intake_assets(
        db: Session,
        page: int = 1,
        page_size: int = 12,
        search: Optional[str] = None,
        file_type: Optional[str] = None,
        date_from: Optional[float] = None,
        date_to: Optional[float] = None,
    ) -> Tuple[List[IntakeAssetModel], int]:
        q = db.query(IntakeAssetModel)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            q = q.filter(IntakeAssetModel.filename.ilike(term))

        if file_type and file_type != "all":
            if file_type == "pdf":
                q = q.filter(IntakeAssetModel.filename.ilike("%.pdf"))
            elif file_type in ["image", "images"]:
                q = q.filter(
                    or_(
                        IntakeAssetModel.filename.ilike("%.png"),
                        IntakeAssetModel.filename.ilike("%.jpg"),
                        IntakeAssetModel.filename.ilike("%.jpeg"),
                        IntakeAssetModel.filename.ilike("%.webp"),
                        IntakeAssetModel.filename.ilike("%.tiff"),
                        IntakeAssetModel.filename.ilike("%.tif"),
                        IntakeAssetModel.filename.ilike("%.bmp"),
                    )
                )

        if date_from is not None and isinstance(date_from, (int, float)):
            q = q.filter(IntakeAssetModel.created_at >= date_from)
        if date_to is not None and isinstance(date_to, (int, float)):
            q = q.filter(IntakeAssetModel.created_at <= date_to)

        total_count = q.count()
        offset = max(0, (page - 1) * page_size)
        assets = q.order_by(IntakeAssetModel.created_at.desc()).offset(offset).limit(page_size).all()
        return assets, total_count

    @staticmethod
    def rename_intake_asset(db: Session, file_id: str, new_filename: str) -> Optional[IntakeAssetModel]:
        asset = db.query(IntakeAssetModel).filter(IntakeAssetModel.id == file_id).first()
        if not asset:
            return None
        asset.filename = new_filename.strip()
        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def get_intake_asset(db: Session, file_id: str) -> Optional[IntakeAssetModel]:
        return db.query(IntakeAssetModel).filter(IntakeAssetModel.id == file_id).first()

    @staticmethod
    def delete_intake_asset(db: Session, file_id: str) -> bool:
        asset = db.query(IntakeAssetModel).filter(IntakeAssetModel.id == file_id).first()
        if not asset:
            return False
        db.delete(asset)
        db.commit()
        return True

    @staticmethod
    def clear_intake_assets(db: Session) -> int:
        count = db.query(IntakeAssetModel).delete()
        db.commit()
        return count

    @staticmethod
    def sync_intake_assets_with_disk(db: Session, originals_dir: str) -> List[IntakeAssetModel]:
        """
        Synchronizes SQLite intake_assets with files on disk:
        1. If a file exists in originals_dir but is not in intake_assets, probe & add it.
        2. If an intake_asset record points to a missing file on disk, remove the record.
        """
        import re
        if not os.path.exists(originals_dir):
            return db.query(IntakeAssetModel).all()

        existing_assets = {a.id: a for a in db.query(IntakeAssetModel).all()}

        # 1. Clean up missing files from DB
        needs_commit = False
        for fid, asset in list(existing_assets.items()):
            if not os.path.isfile(asset.file_path):
                db.delete(asset)
                del existing_assets[fid]
                needs_commit = True

        # 2. Check disk for unindexed files
        try:
            for fname in os.listdir(originals_dir):
                abs_path = os.path.join(originals_dir, fname)
                if not os.path.isfile(abs_path) or fname.startswith("."):
                    continue

                if fname not in existing_assets:
                    clean_name = re.sub(r'^\d+_', '', fname)
                    file_ctime = os.path.getctime(abs_path)
                    try:
                        from engines.intake_engine import IntakeEngine
                        meta = IntakeEngine.probe_file_meta(abs_path)
                        new_asset = IntakeAssetModel(
                            id=fname,
                            filename=clean_name,
                            file_path=abs_path,
                            file_size=meta.get("file_size", os.path.getsize(abs_path)),
                            page_count=meta.get("page_count", 1),
                            width_mm=meta.get("width_mm", 210.0),
                            height_mm=meta.get("height_mm", 297.0),
                            created_at=file_ctime,
                        )
                        db.add(new_asset)
                        needs_commit = True
                    except Exception:
                        pass
            if needs_commit:
                db.commit()
        except Exception:
            db.rollback()

        return db.query(IntakeAssetModel).order_by(IntakeAssetModel.created_at.desc()).all()

