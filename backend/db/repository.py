import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from db.models import SessionModel, PageModel, SessionLockModel, ExportJobModel


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
        pages_data: Optional[List[Dict[str, Any]]] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> SessionModel:
        session = SessionModel(
            id=session_id,
            studio_type=studio_type,
            title=title or f"Session {session_id[:8]}",
            intake_mode=intake_mode,
            is_spread=is_spread,
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
    def list_sessions(
        db: Session,
        studio_type: Optional[str] = None,
        status: str = "active",
        limit: int = 50,
    ) -> List[SessionModel]:
        q = db.query(SessionModel).filter(SessionModel.status == status)
        if studio_type:
            q = q.filter(SessionModel.studio_type == studio_type)
        return q.order_by(SessionModel.updated_at.desc()).limit(limit).all()

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
    def delete_session(db: Session, session_id: str) -> bool:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

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
