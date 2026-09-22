import json
import os
from typing import List, Optional
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

class ImposingSettings(BaseModel):
    default_sheet_unit: str = "mm"
    default_margin: float = 10.0
    default_gap: float = 5.0
    default_bleed: float = 2.0
    crop_marks: bool = False
    draw_border: bool = False
    auto_rotate_sheet: bool = True

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

class AppSettings(BaseModel):
    sheets: List[SheetPreset] = []
    rolls: List[RollPreset] = []
    imposing: ImposingSettings = Field(default_factory=ImposingSettings)
    contour: ContourSettings = Field(default_factory=ContourSettings)
    flipbook: FlipbookSettings = Field(default_factory=FlipbookSettings)

DEFAULT_SETTINGS: dict = {
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
    "imposing": {
        "default_sheet_unit": "mm",
        "default_margin": 10.0,
        "default_gap": 5.0,
        "default_bleed": 2.0,
        "crop_marks": False,
        "draw_border": False,
        "auto_rotate_sheet": True,
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
            for k in ["imposing", "contour", "flipbook"]:
                if k in data and isinstance(data[k], dict):
                    merged[k] = {**DEFAULT_SETTINGS[k], **data[k]}
            if "rolls" not in merged:
                merged["rolls"] = DEFAULT_SETTINGS["rolls"]
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
