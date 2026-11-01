import json
import os
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
SETTINGS_FILE = "settings.json"

class SheetPreset(BaseModel):
    name: str
    width: float = Field(..., gt=0, description="Width in mm")
    height: float = Field(..., gt=0, description="Height in mm")
    unit: str = "mm"

class RollPreset(BaseModel):
    name: str
    width: float = Field(..., gt=0, description="Roll width in mm")
    unit: str = "mm"

class BookTrimPreset(BaseModel):
    name: str
    width: float = Field(..., gt=0, description="Width in mm")
    height: float = Field(..., gt=0, description="Height in mm")
    unit: str = "mm"

class TagPreset(BaseModel):
    id: str
    name: str
    color: str = "#06b6d4"
    icon: str = "PlayCircle"

class TagDisplayModeRequest(BaseModel):
    display_mode: str = Field("both", pattern="^(both|icon|name)$")

class ImposingSettings(BaseModel):
    default_sheet_unit: str = "mm"
    default_margin: float = 10.0
    default_gap: float = 5.0
    default_bleed: float = 2.0
    crop_marks: bool = False
    draw_border: bool = False
    auto_rotate_sheet: bool = True
    uniform_orientation: bool = True

class ContourSettings(BaseModel):
    default_dpi: int = 300
    default_threshold: int = 20
    default_offset: float = 0.0
    default_stroke_color: str = "#FF00FF"
    default_stroke_width: float = 1.0
    default_smoothing: float = 2.0
    keep_holes: bool = False

class FlipbookSettings(BaseModel):
    default_dpi: int = 101
    default_direction: str = "Left to Right (LTR)"
    default_binding: str = "Soft Cover (Paperback)"
    default_texture: str = "Dark Mode"
    sound_enabled: bool = False
    eco_mode: bool = False

class BookStudioSettings(BaseModel):
    history_limit: int = Field(50, ge=5, le=50)
    shortcuts: dict = Field(default_factory=lambda: {
        "undo": "ctrl+z",
        "redo": "ctrl+y",
        "restore_original": "ctrl+shift+r",
        "prev_page": "[",
        "next_page": "]",
        "toggle_original": "o",
        "rotate": "r"
    })

class StorageSettings(BaseModel):
    export_retention_days: int = Field(0, ge=0, le=365, description="0 means retain forever")
    auto_clean_temp_hours: int = Field(24, ge=1, le=720)

class AppSettings(BaseModel):
    sheets: List[SheetPreset] = []
    rolls: List[RollPreset] = []
    book_trims: List[BookTrimPreset] = []
    tags: List[TagPreset] = []
    tag_display_mode: str = "both"
    imposing: ImposingSettings = Field(default_factory=ImposingSettings)
    contour: ContourSettings = Field(default_factory=ContourSettings)
    flipbook: FlipbookSettings = Field(default_factory=FlipbookSettings)
    book_studio: BookStudioSettings = Field(default_factory=BookStudioSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)

DEFAULT_SETTINGS: dict = {
    "tags": [
        {"id": "pending", "name": "Pending", "color": "#f59e0b", "icon": "Clock"},
        {"id": "in-progress", "name": "In-Progress", "color": "#06b6d4", "icon": "PlayCircle"},
        {"id": "done", "name": "Done", "color": "#10b981", "icon": "CheckCircle2"},
    ],
    "tag_display_mode": "both",
    "sheets": [
        {"name": "A4", "width": 210.0, "height": 297.0, "unit": "mm"},
        {"name": "A3", "width": 297.0, "height": 420.0, "unit": "mm"},
        {"name": "SRA3", "width": 320.0, "height": 450.0, "unit": "mm"},
        {"name": "B2", "width": 480.0, "height": 650.0, "unit": "mm"},
    ],
    "rolls": [
        {"name": "60cm Roll", "width": 600.0, "unit": "mm"},
        {"name": "100cm Roll", "width": 1000.0, "unit": "mm"},
        {"name": "160cm Wide Roll", "width": 1600.0, "unit": "mm"},
    ],
    "book_trims": [
        {"name": "A4", "width": 210.0, "height": 297.0, "unit": "mm"},
        {"name": "A5", "width": 148.0, "height": 210.0, "unit": "mm"},
        {"name": "B5 (JIS)", "width": 182.0, "height": 257.0, "unit": "mm"},
        {"name": "US Trade (6\" × 9\")", "width": 152.4, "height": 228.6, "unit": "mm"},
        {"name": "US Digest (5.5\" × 8.5\")", "width": 139.7, "height": 215.9, "unit": "mm"},
        {"name": "Pocket Book (4.25\" × 6.87\")", "width": 108.0, "height": 174.5, "unit": "mm"},
        {"name": "Royal (6.14\" × 9.21\")", "width": 156.0, "height": 234.0, "unit": "mm"},
        {"name": "Square Large (8.25\" × 8.25\")", "width": 210.0, "height": 210.0, "unit": "mm"},
    ],
    "imposing": {
        "default_sheet_unit": "mm",
        "default_margin": 10.0,
        "default_gap": 5.0,
        "default_bleed": 2.0,
        "crop_marks": False,
        "draw_border": False,
        "auto_rotate_sheet": True,
        "uniform_orientation": True,
    },
    "contour": {
        "default_dpi": 300,
        "default_threshold": 20,
        "default_offset": 0.0,
        "default_stroke_color": "#FF00FF",
        "default_stroke_width": 1.0,
        "default_smoothing": 2.0,
        "keep_holes": False,
    },
    "flipbook": {
        "default_dpi": 101,
        "default_direction": "Left to Right (LTR)",
        "default_binding": "Soft Cover (Paperback)",
        "default_texture": "Dark Mode",
        "sound_enabled": False,
        "eco_mode": False,
    },
    "book_studio": {
        "history_limit": 50,
        "shortcuts": {
            "undo": "ctrl+z",
            "redo": "ctrl+y",
            "restore_original": "ctrl+shift+r",
            "prev_page": "[",
            "next_page": "]",
            "toggle_original": "o",
            "rotate": "r"
        }
    },
    "storage": {
        "export_retention_days": 0,
        "auto_clean_temp_hours": 24,
    },
}

def load_settings() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        save_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge with defaults for missing keys
            merged = {**DEFAULT_SETTINGS, **data}
            for k in ["imposing", "contour", "flipbook", "book_studio", "storage"]:
                if k in data and isinstance(data[k], dict):
                    merged[k] = {**DEFAULT_SETTINGS[k], **data[k]}
            if "rolls" not in merged:
                merged["rolls"] = DEFAULT_SETTINGS["rolls"]
            if "book_trims" not in merged:
                merged["book_trims"] = DEFAULT_SETTINGS["book_trims"]
            if "tags" not in merged or not merged["tags"]:
                merged["tags"] = DEFAULT_SETTINGS["tags"]
            if "tag_display_mode" not in merged:
                merged["tag_display_mode"] = DEFAULT_SETTINGS["tag_display_mode"]
            return merged
    except Exception:
        return DEFAULT_SETTINGS

def save_settings(data: dict) -> None:
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

@router.get("/api/settings")
def get_settings():
    return load_settings()

@router.put("/api/settings")
def update_full_settings(settings: AppSettings):
    data = settings.dict()
    save_settings(data)
    return {"success": True, "settings": data}

@router.post("/api/settings/reset")
def reset_to_defaults():
    save_settings(DEFAULT_SETTINGS)
    return {"success": True, "settings": DEFAULT_SETTINGS}

@router.post("/api/settings/sheets")
def add_sheet(sheet: SheetPreset):
    settings = load_settings()
    # Replace if duplicate name, otherwise append
    existing = [s for s in settings.get("sheets", []) if s.get("name") != sheet.name]
    existing.append(sheet.dict())
    settings["sheets"] = existing
    save_settings(settings)
    return settings

@router.put("/api/settings/sheets/{sheet_name}")
def edit_sheet(sheet_name: str, sheet: SheetPreset):
    settings = load_settings()
    current_sheets = settings.get("sheets", [])
    found = False
    for i, s in enumerate(current_sheets):
        if s.get("name") == sheet_name:
            current_sheets[i] = sheet.dict()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Sheet not found")
    settings["sheets"] = current_sheets
    save_settings(settings)
    return settings

@router.delete("/api/settings/sheets/{sheet_name}")
def delete_sheet(sheet_name: str):
    settings = load_settings()
    current_sheets = settings.get("sheets", [])
    filtered = [s for s in current_sheets if s.get("name") != sheet_name]
    if len(filtered) == len(current_sheets):
        raise HTTPException(status_code=404, detail="Sheet not found")
    settings["sheets"] = filtered
    save_settings(settings)
    return settings

@router.post("/api/settings/rolls")
def add_roll(roll: RollPreset):
    settings = load_settings()
    existing = [r for r in settings.get("rolls", []) if r.get("name") != roll.name]
    existing.append(roll.dict())
    settings["rolls"] = existing
    save_settings(settings)
    return settings

@router.put("/api/settings/rolls/{roll_name}")
def edit_roll(roll_name: str, roll: RollPreset):
    settings = load_settings()
    current_rolls = settings.get("rolls", [])
    found = False
    for i, r in enumerate(current_rolls):
        if r.get("name") == roll_name:
            current_rolls[i] = roll.dict()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Roll not found")
    settings["rolls"] = current_rolls
    save_settings(settings)
    return settings

@router.delete("/api/settings/rolls/{roll_name}")
def delete_roll(roll_name: str):
    settings = load_settings()
    current_rolls = settings.get("rolls", [])
    filtered = [r for r in current_rolls if r.get("name") != roll_name]
    if len(filtered) == len(current_rolls):
        raise HTTPException(status_code=404, detail="Roll not found")
    settings["rolls"] = filtered
    save_settings(settings)
    return settings

@router.post("/api/settings/book-trims")
def add_book_trim(trim: BookTrimPreset):
    settings = load_settings()
    existing = [t for t in settings.get("book_trims", []) if t.get("name") != trim.name]
    existing.append(trim.dict())
    settings["book_trims"] = existing
    save_settings(settings)
    return settings

@router.put("/api/settings/book-trims/{trim_name}")
def edit_book_trim(trim_name: str, trim: BookTrimPreset):
    settings = load_settings()
    current_trims = settings.get("book_trims", [])
    found = False
    for i, t in enumerate(current_trims):
        if t.get("name") == trim_name:
            current_trims[i] = trim.dict()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Book trim preset not found")
    settings["book_trims"] = current_trims
    save_settings(settings)
    return settings

@router.delete("/api/settings/book-trims/{trim_name}")
def delete_book_trim(trim_name: str):
    settings = load_settings()
    current_trims = settings.get("book_trims", [])
    filtered = [t for t in current_trims if t.get("name") != trim_name]
    if len(filtered) == len(current_trims):
        raise HTTPException(status_code=404, detail="Book trim preset not found")
    settings["book_trims"] = filtered
    save_settings(settings)
    return settings


# --- Storage & Cleanup Endpoints ---

class OpenFolderRequest(BaseModel):
    key: str

class CleanStorageRequest(BaseModel):
    target: Optional[str] = None  # "safe", "build", "all", or specific key
    targets: Optional[List[str]] = None  # Selective list of keys

@router.get("/api/settings/storage-status")
def get_storage_status():
    from engines.storage_cleaner import StorageCleaner
    return StorageCleaner.get_status()

@router.post("/api/settings/open-folder")
def open_storage_folder(req: OpenFolderRequest):
    from engines.storage_cleaner import StorageCleaner
    path = StorageCleaner.open_folder(req.key)
    return {"success": True, "path": path}

@router.post("/api/settings/clean-storage")
def clean_storage(req: CleanStorageRequest):
    from engines.storage_cleaner import StorageCleaner
    targets = req.targets if req.targets is not None else (req.target or "safe")
    res = StorageCleaner.clean(targets)
    cleaned = res.get("cleaned_keys", [])
    if any(k in cleaned for k in ["storage_cache", "safe", "runtime", "all", "all_safe"]):
        try:
            from book_scan_api import _THUMB_RAM_CACHE, _THUMB_RAM_LOCK
            with _THUMB_RAM_LOCK:
                _THUMB_RAM_CACHE.clear()
        except ImportError:
            pass
    return res

@router.post("/api/settings/backup-db")
def trigger_database_backup():
    """Triggers an immediate on-demand hot snapshot of flint.db."""
    from db.session import backup_database
    backup_path = backup_database()
    if backup_path:
        return {
            "success": True,
            "path": backup_path,
            "filename": os.path.basename(backup_path),
            "message": f"Created database backup snapshot: {os.path.basename(backup_path)}"
        }
    return {
        "success": False,
        "message": "No database found or backup could not be created."
    }

@router.post("/api/settings/empty-trash")
def empty_trash_from_settings():
    """Empties all soft-deleted projects in trash and purges their storage."""
    from db.session import db_session
    from db.repository import SessionRepository
    from storage.asset_store import asset_store
    with db_session() as db:
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
        "message": f"Successfully emptied Trash ({len(session_ids)} projects permanently purged)."
    }

class RetentionPruneRequest(BaseModel):
    retention_days: Optional[int] = None

@router.post("/api/settings/retention-prune")
def prune_retention(req: Optional[RetentionPruneRequest] = None):
    from engines.storage_cleaner import StorageCleaner
    settings = load_settings()
    retention_days = req.retention_days if (req and req.retention_days is not None) else settings.get("storage", {}).get("export_retention_days", 0)
    res = StorageCleaner.prune_exports(retention_days)
    return res

@router.put("/api/settings/retention")
def set_retention_policy(req: StorageSettings):
    settings = load_settings()
    settings["storage"] = req.dict()
    save_settings(settings)
    return {"success": True, "storage": settings["storage"]}


# --- Dynamic Tag Customization Endpoints ---

@router.get("/api/settings/tags")
def get_tags():
    settings = load_settings()
    return {
        "success": True,
        "tags": settings.get("tags", DEFAULT_SETTINGS["tags"]),
        "tag_display_mode": settings.get("tag_display_mode", "both"),
    }


@router.post("/api/settings/tags")
def create_or_update_tag(tag: TagPreset):
    settings = load_settings()
    tags = settings.get("tags", list(DEFAULT_SETTINGS["tags"]))
    # Replace if ID exists, else append
    existing = [t for t in tags if t.get("id") != tag.id]
    existing.append(tag.dict())
    settings["tags"] = existing
    save_settings(settings)
    return {"success": True, "tags": settings["tags"]}


@router.delete("/api/settings/tags/{tag_id}")
def delete_tag(tag_id: str):
    settings = load_settings()
    tags = settings.get("tags", list(DEFAULT_SETTINGS["tags"]))
    filtered = [t for t in tags if t.get("id") != tag_id]
    if len(filtered) == len(tags):
        raise HTTPException(status_code=404, detail="Tag not found")
    settings["tags"] = filtered
    save_settings(settings)
    return {"success": True, "tags": settings["tags"]}


@router.put("/api/settings/tags/display-mode")
def set_tag_display_mode(req: TagDisplayModeRequest):
    settings = load_settings()
    settings["tag_display_mode"] = req.display_mode
    save_settings(settings)
    return {"success": True, "tag_display_mode": req.display_mode}


