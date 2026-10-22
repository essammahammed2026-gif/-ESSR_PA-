"""Shared imposing request schemas — single copy (fix.md Phase 1.4).

Pydantic models live here so both the FastAPI router and engine prep
helpers (`imposing_prep`) import from one place. Routers must not define
their own copies.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ImposingItem(BaseModel):
    file_id: str
    copies: int = 1
    name: str
    w: Optional[float] = None
    h: Optional[float] = None
    keep_aspect: bool = False
    fill_color: str = "#FFFFFF"
    page_count: Optional[int] = 1
    page_range: Optional[str] = "all"
    page_num: Optional[int] = 0
    # Fit mode (authoritative): "stretch" | "fit" | "crop"
    # "stretch" → force-fill exact W×H (may distort).
    # "fit"     → scale proportionally + letterbox-pad with fill_color.
    # "crop"    → scale to fill, centre-crop any overflow.
    fit_mode: str = "stretch"
    # Page rotation applied to content (independent of packer auto-rotation)
    # "none" | "cw" (90° CW) | "ccw" (90° CCW)
    page_rotation: str = "none"
    # Bleed mode: "none" | "solid" | "mirror"
    bleed_mode: str = "none"
    bleed_mm: float = 0.0
    bleed_color: str = "#FFFFFF"
    # Bleed placement: "inside" (trim size locked, artwork inset) | "outside" (artwork locked, outer box expands)
    bleed_type: str = "inside"


class ImposingRequest(BaseModel):
    items: List[ImposingItem]
    job_mode: str = "gang"
    mode: str = "Sheet"
    sheet_w: float = 320.0
    sheet_h: float = 450.0
    margin: float = 10.0
    gap: float = 5.0
    draw_border: bool = False
    border_color: str = "#000000"
    crop_marks: bool = False
    reg_marks: bool = False
    align: str = "Center"
    nesting_mode: str = "Grid"
    auto_rotate_sheet: bool = True
    uniform_orientation: bool = True
    rows: Optional[int] = None
    cols: Optional[int] = None
    page_index: Optional[int] = 0


# --- Book Scan Studio schemas (moved from book_scan_api, fix.md 1.4b) ---

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
    clean_borders: bool = False
    border_margin_px: int = 15
    border_threshold: int = 210
    enhance_colors: bool = True
    saturation: float = 1.30
    contrast: float = 1.10
    color_mode: str = "color"  # "color" | "grayscale" | "bw"
    bw_threshold: int = 180
    whiten_bg: bool = False
    deskew: bool = False
    sharpen: bool = True


class CropBoxModel(BaseModel):
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 1.0
    y2: float = 1.0


class SplitSpreadRequest(BaseModel):
    page_id: Optional[str] = None
    crop_box: Optional[CropBoxModel] = None
    split_pos: Optional[float] = 0.5
    split_lines: Optional[List[float]] = None
    split_direction: Optional[str] = "vertical"
    apply_to_all: bool = False
    target_page_ids: Optional[List[str]] = None


class RevertSpreadRequest(BaseModel):
    page_id: Optional[str] = None
    revert_all: bool = False
    target_page_ids: Optional[List[str]] = None


class CropPageRequest(BaseModel):
    page_id: Optional[str] = None
    crop_box: CropBoxModel
    apply_to_all: bool = False
    target_page_ids: Optional[List[str]] = None
    per_page_crops: Optional[Dict[str, CropBoxModel]] = None


class BatchDetectCropRequest(BaseModel):
    mode: str = "paper"  # "paper" | "content"
    target_page_ids: Optional[List[str]] = None


class BatchDetectAngleRequest(BaseModel):
    max_angle: float = 10.0
    ignore_borders: bool = True
    target_page_ids: Optional[List[str]] = None


class PageDeskewRequest(BaseModel):
    page_id: Optional[str] = None
    angle: Optional[float] = None
    per_page_angles: Optional[Dict[str, float]] = None
    clear_all: bool = False


class MaskBoxModel(BaseModel):
    id: str = ""
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 0.0
    y2: float = 0.0
    color: Optional[str] = None
    fill: Optional[str] = None


class MaskPageRequest(BaseModel):
    action: str = "add"  # "add" | "remove" | "clear_page" | "clear_all"
    mask: Optional[MaskBoxModel] = None
    mask_box: Optional[MaskBoxModel] = None
    mask_id: Optional[str] = None
    page_id: Optional[str] = None
    scope: str = "current"  # "current" | "selected" | "all" | "odds" | "evens" | "range"
    custom_range: str = ""
    target_page_ids: Optional[List[str]] = None


class PageColorModeRequest(BaseModel):
    page_id: Optional[str] = None
    color_mode: Optional[str] = None  # "auto" | "color" | "grayscale" | "bw" | None
    target_page_ids: Optional[List[str]] = None
    clear_all: bool = False


class ExportRequest(BaseModel):
    export_format: str = "pdf"  # "pdf" | "pdf_split" | "jpeg" | "png" | "tiff"
    tiff_compression: str = "lzw"  # "lzw" | "deflate" | "none"

    bleed_mm: float = 3.0
    bleed_mode: str = "mirror"  # "mirror" | "solid"
    bleed_color: str = "#ffffff"
    bleed_placement: str = "outside"  # "outside" | "inside"
    show_crop_marks: bool = True

    dpi: int = 200
    quality: int = 90
    optimize_compression: bool = True
    clean_borders: bool = False
    border_margin_px: int = 15
    border_threshold: int = 210
    enhance_colors: bool = True
    saturation: float = 1.30
    contrast: float = 1.10
    color_mode: str = "auto"  # "auto" | "color" | "grayscale" | "bw"
    bw_threshold: int = 180
    whiten_bg: bool = False
    deskew: bool = False
    sharpen: bool = True
    deskew_module_enabled: bool = False
    deskew_mode: str = "auto"
    deskew_angle: float = 0.0
    deskew_max_angle: float = 10.0
    deskew_ignore_borders: bool = True
    deskew_scope_mode: str = "all"
    deskew_custom_range: str = ""
    per_page_deskew_angles: Optional[Dict[str, float]] = None
    per_page_crops: Optional[Dict[str, CropBoxModel]] = None
    per_page_color_modes: Optional[Dict[str, str]] = None

    cleanup_module_enabled: bool = False
    flatten_illumination: bool = False
    despeckle_level: int = 0  # 0=off, 1=light, 2=medium, 3=strong
    cleanup_scope_mode: str = "all"
    cleanup_custom_range: str = ""

    bleed_module_enabled: bool = False
    bleed_scope_mode: str = "all"
    bleed_custom_range: str = ""

    restoration_module_enabled: bool = False
    restoration_scope_mode: str = "all"
    restoration_custom_range: str = ""


class DuplicatePageRequest(BaseModel):
    page_id: str
    position: str = "after"  # "before" | "after"


class InsertBlankPageRequest(BaseModel):
    page_id: str
    position: str = "after"  # "before" | "after"
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None


class RestorePagesRequest(BaseModel):
    pages: List[Dict[str, Any]]

