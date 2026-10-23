import time
from typing import Any, Dict
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    JSON,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.orm import relationship
from db.session import Base


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    studio_type = Column(String(32), default="book_scan", index=True)  # 'book_scan', 'imposing', 'contour', 'flipbook'
    title = Column(String(255), nullable=True)
    intake_mode = Column(String(32), default="single")  # 'single', 'dual', 'multi_merge'
    is_spread = Column(Boolean, default=False)
    status = Column(String(32), default="active", index=True)  # 'active', 'completed', 'archived'
    session_dir = Column(String(512), nullable=False)
    settings = Column(JSON, default=dict)
    rev = Column(Integer, default=1)
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time, onupdate=time.time)

    # Relationships
    pages = relationship(
        "PageModel",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PageModel.sort_order",
    )
    applied_layers = relationship(
        "AppliedLayerModel",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AppliedLayerModel.layer_order",
    )
    lock = relationship(
        "SessionLockModel",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    export_jobs = relationship(
        "ExportJobModel",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ExportJobModel.created_at.desc()",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "studio_type": self.studio_type,
            "title": self.title,
            "mode": self.intake_mode,
            "intake_mode": self.intake_mode,
            "is_spread": self.is_spread,
            "status": self.status,
            "session_dir": self.session_dir,
            "settings": self.settings or {},
            "rev": self.rev,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "pages": [p.to_dict() for p in self.pages],
            "total_pages": len(self.pages),
        }


class PageModel(Base):
    __tablename__ = "pages"

    id = Column(String(64), primary_key=True)
    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, default=0, index=True)

    source = Column(String(255), nullable=False)
    doc_idx = Column(Integer, default=0)
    label = Column(String(128), default="Page 1")
    half = Column(String(32), default="full")  # 'full', 'left', 'right'
    is_spread = Column(Boolean, default=False)
    is_blank = Column(Boolean, default=False)

    parent_page_id = Column(String(64), nullable=True)
    immediate_parent_id = Column(String(64), nullable=True)
    parent_spread_width_mm = Column(Float, nullable=True)
    parent_spread_height_mm = Column(Float, nullable=True)

    split_pos = Column(Float, default=0.5)
    spread_split_pos = Column(Float, nullable=True)
    split_direction = Column(String(32), default="vertical")
    split_lines = Column(JSON, nullable=True)

    width_mm = Column(Float, default=210.0)
    height_mm = Column(Float, default=297.0)
    orig_width_mm = Column(Float, default=210.0)
    orig_height_mm = Column(Float, default=297.0)

    rotation = Column(Integer, default=0)
    deskew_angle = Column(Float, nullable=True)
    color_mode = Column(String(32), nullable=True)

    crop_box = Column(JSON, nullable=True)
    spread_crop_box = Column(JSON, nullable=True)
    page_crop_box = Column(JSON, nullable=True)
    slice_box = Column(JSON, nullable=True)
    masks = Column(JSON, default=list)

    color_space = Column(String(32), nullable=True)
    dpi = Column(Integer, default=200)
    rev = Column(Integer, default=0)

    session = relationship("SessionModel", back_populates="pages")

    __table_args__ = (
        Index("idx_page_session_sort", "session_id", "sort_order"),
    )

    def to_dict(self) -> Dict[str, Any]:
        res: Dict[str, Any] = {
            "id": self.id,
            "source": self.source,
            "doc_idx": self.doc_idx,
            "label": self.label,
            "half": self.half,
            "is_spread": self.is_spread,
            "is_blank": self.is_blank,
            "split_pos": self.split_pos,
            "split_direction": self.split_direction,
            "width_mm": self.width_mm,
            "height_mm": self.height_mm,
            "orig_width_mm": self.orig_width_mm,
            "orig_height_mm": self.orig_height_mm,
            "rotation": self.rotation,
            "rev": self.rev,
        }
        if self.parent_page_id:
            res["parent_page_id"] = self.parent_page_id
        if self.immediate_parent_id:
            res["immediate_parent_id"] = self.immediate_parent_id
        if self.parent_spread_width_mm is not None:
            res["parent_spread_width_mm"] = self.parent_spread_width_mm
        if self.parent_spread_height_mm is not None:
            res["parent_spread_height_mm"] = self.parent_spread_height_mm
        if self.spread_split_pos is not None:
            res["spread_split_pos"] = self.spread_split_pos
        if self.split_lines:
            res["split_lines"] = self.split_lines
        if self.deskew_angle is not None:
            res["deskew_angle"] = self.deskew_angle
        if self.color_mode:
            res["color_mode"] = self.color_mode
        if self.crop_box:
            res["crop_box"] = self.crop_box
        if self.spread_crop_box:
            res["spread_crop_box"] = self.spread_crop_box
        if self.page_crop_box:
            res["page_crop_box"] = self.page_crop_box
        if self.slice_box:
            res["slice_box"] = self.slice_box
        if self.masks:
            res["masks"] = self.masks
        if self.color_space:
            res["color_space"] = self.color_space
        if self.dpi:
            res["dpi"] = self.dpi
        return res

    @staticmethod
    def from_dict(session_id: str, sort_order: int, d: Dict[str, Any]) -> "PageModel":
        return PageModel(
            id=d["id"],
            session_id=session_id,
            sort_order=sort_order,
            source=d.get("source", ""),
            doc_idx=int(d.get("doc_idx", 0)),
            label=d.get("label", f"Page {sort_order + 1}"),
            half=d.get("half", "full"),
            is_spread=bool(d.get("is_spread", False)),
            is_blank=bool(d.get("is_blank", False)),
            parent_page_id=d.get("parent_page_id"),
            immediate_parent_id=d.get("immediate_parent_id"),
            parent_spread_width_mm=d.get("parent_spread_width_mm"),
            parent_spread_height_mm=d.get("parent_spread_height_mm"),
            split_pos=float(d.get("split_pos", 0.5)),
            spread_split_pos=d.get("spread_split_pos"),
            split_direction=d.get("split_direction", "vertical"),
            split_lines=d.get("split_lines"),
            width_mm=float(d.get("width_mm", 210.0)),
            height_mm=float(d.get("height_mm", 297.0)),
            orig_width_mm=float(d.get("orig_width_mm", d.get("width_mm", 210.0))),
            orig_height_mm=float(d.get("orig_height_mm", d.get("height_mm", 297.0))),
            rotation=int(d.get("rotation", 0)),
            deskew_angle=float(d["deskew_angle"]) if d.get("deskew_angle") is not None else None,
            color_mode=d.get("color_mode"),
            crop_box=d.get("crop_box"),
            spread_crop_box=d.get("spread_crop_box"),
            page_crop_box=d.get("page_crop_box"),
            slice_box=d.get("slice_box"),
            masks=d.get("masks", []),
            color_space=d.get("color_space"),
            dpi=int(d.get("dpi", 200)),
            rev=int(d.get("rev", 0)),
        )


class AppliedLayerModel(Base):
    __tablename__ = "applied_layers"

    id = Column(String(64), primary_key=True)
    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    module_key = Column(String(32), nullable=False, index=True)  # 'crop', 'deskew', 'cleanup', 'color', 'bleed'
    layer_order = Column(Integer, default=0, index=True)
    label = Column(String(128), nullable=False)
    details = Column(String(255), nullable=True)
    scope_label = Column(String(64), default="All")
    target_page_ids = Column(JSON, default=list)
    target_pages = Column(JSON, default=list)
    visible = Column(Boolean, default=True)
    params = Column(JSON, default=dict)
    created_at = Column(Float, default=time.time)

    session = relationship("SessionModel", back_populates="applied_layers")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "module_key": self.module_key,
            "layer_order": self.layer_order,
            "label": self.label,
            "details": self.details,
            "scopeLabel": self.scope_label,
            "targetPageIds": self.target_page_ids or [],
            "targetPages": self.target_pages or [],
            "visible": self.visible,
            "params": self.params or {},
            "created_at": self.created_at,
        }


class SessionLockModel(Base):
    __tablename__ = "session_locks"

    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True)
    workstation_id = Column(String(128), nullable=False)
    operator_name = Column(String(128), default="Operator")
    lease_expires_at = Column(Float, nullable=False, index=True)

    session = relationship("SessionModel", back_populates="lock")

    def is_active(self) -> bool:
        return time.time() < self.lease_expires_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "workstation_id": self.workstation_id,
            "operator_name": self.operator_name,
            "lease_expires_at": self.lease_expires_at,
            "is_locked": self.is_active(),
            "remaining_seconds": max(0, int(self.lease_expires_at - time.time())),
        }


class ExportJobModel(Base):
    __tablename__ = "export_jobs"

    id = Column(String(64), primary_key=True)
    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), default="queued", index=True)  # 'queued', 'processing', 'completed', 'failed'
    stage = Column(String(64), default="idle")
    progress = Column(Float, default=0.0)
    message = Column(String(255), default="")
    current_page = Column(Integer, default=0)
    total_pages = Column(Integer, default=0)
    output_file_path = Column(String(512), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time, onupdate=time.time)

    session = relationship("SessionModel", back_populates="export_jobs")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "jobId": self.id,
            "session_id": self.session_id,
            "status": self.status,
            "stage": self.stage,
            "progress": self.progress,
            "message": self.message,
            "currentPage": self.current_page,
            "totalPages": self.total_pages,
            "outputFilePath": self.output_file_path,
            "fileSizeBytes": self.file_size_bytes,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
