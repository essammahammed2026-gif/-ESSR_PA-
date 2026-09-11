import json
import os
from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter()
SETTINGS_FILE = "settings.json"

DEFAULT_SETTINGS = {
    "sheets": [
        {"name": "A4", "width": 210, "height": 297, "unit": "mm"},
        {"name": "A3", "width": 297, "height": 420, "unit": "mm"},
        {"name": "SRA3", "width": 320, "height": 450, "unit": "mm"}
    ]
}

def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "w") as f:
            json.dump(DEFAULT_SETTINGS, f, indent=4)
        return DEFAULT_SETTINGS
    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)

@router.get("/api/settings")
def get_settings():
    return load_settings()

@router.post("/api/settings/sheets")
def add_sheet(name: str = Body(...), width: float = Body(...), height: float = Body(...), unit: str = Body("mm")):
    settings = load_settings()
    settings["sheets"].append({"name": name, "width": width, "height": height, "unit": unit})
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=4)
    return settings
