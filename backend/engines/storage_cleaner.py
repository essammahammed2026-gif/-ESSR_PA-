import os
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Tuple

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)

STORAGE_TARGETS = [
    {
        "key": "book_scans",
        "label": "Book Studio Scans & Thumbnails",
        "description": "Uploaded book scan PDFs, spread slices, and rendered page thumbnails.",
        "path": os.path.join(BACKEND_DIR, "temp_uploads", "book_scans"),
        "display_path": "backend/temp_uploads/book_scans",
        "category": "runtime",
        "shallow": False,
    },
    {
        "key": "temp_uploads",
        "label": "Imposing & Contour Previews",
        "description": "Temporary uploaded artwork PDFs and extracted preview images.",
        "path": os.path.join(BACKEND_DIR, "temp_uploads"),
        "display_path": "backend/temp_uploads",
        "category": "runtime",
        "shallow": True,
    },
    {
        "key": "public_flipbooks",
        "label": "3D Flipbook Rendered Proofs",
        "description": "Generated 3D virtual proof page textures and viewer assets.",
        "path": os.path.join(BACKEND_DIR, "public_flipbooks"),
        "display_path": "backend/public_flipbooks",
        "category": "runtime",
        "shallow": False,
    },
    {
        "key": "tauri_target",
        "label": "Desktop App Build Cache (Rust / Tauri)",
        "description": "Rust compiler cache and intermediate binaries. Safe to delete (rebuilds on demand).",
        "path": os.path.join(ROOT_DIR, "frontend", "src-tauri", "target"),
        "display_path": "frontend/src-tauri/target",
        "category": "build",
        "shallow": False,
    },
    {
        "key": "next_cache",
        "label": "Web App Compilation Cache (Next.js)",
        "description": "Next.js development build chunks and cached page bundles.",
        "path": os.path.join(ROOT_DIR, "frontend", ".next"),
        "display_path": "frontend/.next",
        "category": "build",
        "shallow": False,
    },
]


def format_bytes(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.2f} GB"


def get_dir_size_and_count(path: str, shallow: bool = False) -> Tuple[int, int]:
    total_size = 0
    count = 0
    if not os.path.exists(path):
        return 0, 0
    if shallow:
        try:
            for entry in os.scandir(path):
                if entry.is_file() and entry.name != ".gitkeep":
                    total_size += entry.stat().st_size
                    count += 1
        except OSError:
            pass
        return total_size, count

    for root, _dirs, files in os.walk(path):
        for f in files:
            if f == ".gitkeep":
                continue
            fp = os.path.join(root, f)
            try:
                total_size += os.path.getsize(fp)
                count += 1
            except OSError:
                pass
    return total_size, count


class StorageCleaner:
    @staticmethod
    def get_status() -> Dict[str, Any]:
        items: List[Dict[str, Any]] = []
        total_runtime_bytes = 0
        total_bytes = 0

        for t in STORAGE_TARGETS:
            size_b, count = get_dir_size_and_count(t["path"], shallow=t["shallow"])
            total_bytes += size_b
            if t["category"] == "runtime":
                total_runtime_bytes += size_b

            items.append({
                "key": t["key"],
                "label": t["label"],
                "description": t["description"],
                "path": t["path"],
                "display_path": t["display_path"],
                "category": t["category"],
                "size_bytes": size_b,
                "size_human": format_bytes(size_b),
                "count": count,
            })

        return {
            "items": items,
            "total_runtime_bytes": total_runtime_bytes,
            "total_runtime_human": format_bytes(total_runtime_bytes),
            "total_bytes": total_bytes,
            "total_human": format_bytes(total_bytes),
        }

    @staticmethod
    def open_folder(key: str) -> str:
        target = next((t for t in STORAGE_TARGETS if t["key"] == key), None)
        path = target["path"] if target else os.path.join(BACKEND_DIR, "temp_uploads")
        os.makedirs(path, exist_ok=True)

        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return path

    @staticmethod
    def clean_target(key: str) -> int:
        freed = 0
        if key == "book_scans":
            p = os.path.join(BACKEND_DIR, "temp_uploads", "book_scans")
            if os.path.exists(p):
                for entry in os.scandir(p):
                    if entry.name == ".gitkeep":
                        continue
                    if entry.is_dir():
                        size, _ = get_dir_size_and_count(entry.path)
                        shutil.rmtree(entry.path, ignore_errors=True)
                        freed += size
                    elif entry.is_file():
                        freed += entry.stat().st_size
                        try:
                            os.remove(entry.path)
                        except OSError:
                            pass
        elif key == "temp_uploads":
            p = os.path.join(BACKEND_DIR, "temp_uploads")
            if os.path.exists(p):
                for entry in os.scandir(p):
                    if entry.name in [".gitkeep", "book_scans"]:
                        continue
                    if entry.is_file():
                        freed += entry.stat().st_size
                        try:
                            os.remove(entry.path)
                        except OSError:
                            pass
        elif key == "public_flipbooks":
            p = os.path.join(BACKEND_DIR, "public_flipbooks")
            if os.path.exists(p):
                for entry in os.scandir(p):
                    if entry.name == ".gitkeep":
                        continue
                    if entry.is_dir():
                        size, _ = get_dir_size_and_count(entry.path)
                        shutil.rmtree(entry.path, ignore_errors=True)
                        freed += size
                    elif entry.is_file():
                        freed += entry.stat().st_size
                        try:
                            os.remove(entry.path)
                        except OSError:
                            pass
        elif key == "tauri_target":
            p = os.path.join(ROOT_DIR, "frontend", "src-tauri", "target")
            if os.path.exists(p):
                size, _ = get_dir_size_and_count(p)
                shutil.rmtree(p, ignore_errors=True)
                freed += size
        elif key == "next_cache":
            for folder_name in [".next", ".next-build"]:
                p = os.path.join(ROOT_DIR, "frontend", folder_name)
                if os.path.exists(p):
                    size, _ = get_dir_size_and_count(p)
                    shutil.rmtree(p, ignore_errors=True)
                    freed += size
        return freed

    @staticmethod
    def clean(mode: str = "runtime") -> Dict[str, Any]:
        total_freed = 0
        cleaned_keys: List[str] = []

        if mode == "runtime":
            keys = ["book_scans", "temp_uploads", "public_flipbooks"]
        elif mode == "all":
            keys = [t["key"] for t in STORAGE_TARGETS]
        else:
            keys = [mode]

        for k in keys:
            freed = StorageCleaner.clean_target(k)
            total_freed += freed
            cleaned_keys.append(k)

        return {
            "success": True,
            "freed_bytes": total_freed,
            "freed_human": format_bytes(total_freed),
            "cleaned_keys": cleaned_keys,
        }
