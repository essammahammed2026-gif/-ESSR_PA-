import os
import shutil
import subprocess
import sys
import time
from typing import Any, Dict, List, Tuple

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)

STORAGE_TARGETS = [
    {
        "key": "storage_cache",
        "label": "Thumbnail & Texture Cache",
        "description": "Rendered preview textures for books, impositions, and inspect triage. 100% safe to delete anytime (regenerates on demand).",
        "path": os.path.join(BACKEND_DIR, "data", "storage", "cache"),
        "display_path": "backend/data/storage/cache",
        "category": "cache",
        "safety_level": "safe",
        "shallow": False,
    },
    {
        "key": "public_flipbooks",
        "label": "3D Virtual Proof Renders",
        "description": "Generated WebGL and HTML flipbook textures. Safe to delete anytime (regenerates on demand).",
        "path": os.path.join(BACKEND_DIR, "public_flipbooks"),
        "display_path": "backend/public_flipbooks",
        "category": "cache",
        "safety_level": "safe",
        "shallow": False,
    },
    {
        "key": "temp_uploads",
        "label": "Upload Scratch & Intermediate Files",
        "description": "Temporary ingest uploads and scratch files in backend/temp_uploads/.",
        "path": os.path.join(BACKEND_DIR, "temp_uploads"),
        "display_path": "backend/temp_uploads",
        "category": "scratch",
        "safety_level": "safe",
        "shallow": False,
    },
    {
        "key": "next_cache",
        "label": "Web App Build Cache (Next.js)",
        "description": "Compiled Next.js page chunks and cache (.next). Safe to delete (recompiles on launch).",
        "path": os.path.join(ROOT_DIR, "frontend", ".next"),
        "display_path": "frontend/.next",
        "category": "build",
        "safety_level": "build",
        "shallow": False,
    },
    {
        "key": "tauri_target",
        "label": "Desktop Build Cache (Rust / Tauri)",
        "description": "Rust compiler intermediate binaries. Safe to delete (recompiles when building desktop app).",
        "path": os.path.join(ROOT_DIR, "frontend", "src-tauri", "target"),
        "display_path": "frontend/src-tauri/target",
        "category": "build",
        "safety_level": "build",
        "shallow": False,
    },
    {
        "key": "storage_exports",
        "label": "Exported Deliverables (PDF & ZIP)",
        "description": "Completed print exports and impositions in backend/data/storage/exports/. Managed by retention policy.",
        "path": os.path.join(BACKEND_DIR, "data", "storage", "exports"),
        "display_path": "backend/data/storage/exports",
        "category": "deliverables",
        "safety_level": "deliverables",
        "shallow": False,
    },
    {
        "key": "storage_sessions",
        "label": "Session Working Assets",
        "description": "Project slice files. Active projects are permanently protected; cleaning only prunes unlinked abandoned files.",
        "path": os.path.join(BACKEND_DIR, "data", "storage", "sessions"),
        "display_path": "backend/data/storage/sessions",
        "category": "user_data",
        "safety_level": "protected",
        "shallow": False,
    },
    {
        "key": "db_backups",
        "label": "Database Snapshots (SQLite Backups)",
        "description": "Automated rolling pre-migration backups of flint.db in backend/data/backups/. Preserves recovery points.",
        "path": os.path.join(BACKEND_DIR, "data", "backups"),
        "display_path": "backend/data/backups",
        "category": "backups",
        "safety_level": "protected",
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
        total_bytes = 0
        safe_cleanable_bytes = 0
        build_cleanable_bytes = 0

        for t in STORAGE_TARGETS:
            size_b, count = get_dir_size_and_count(t["path"], shallow=t["shallow"])
            total_bytes += size_b
            safety = t.get("safety_level", "safe")
            if safety == "safe":
                safe_cleanable_bytes += size_b
            elif safety == "build":
                build_cleanable_bytes += size_b

            items.append({
                "key": t["key"],
                "label": t["label"],
                "description": t["description"],
                "path": t["path"],
                "display_path": t["display_path"],
                "category": t.get("category", "runtime"),
                "safety_level": safety,
                "size_bytes": size_b,
                "size_human": format_bytes(size_b),
                "count": count,
            })

        # Query soft-deleted projects count and breakdown
        trash_count = 0
        breakdown = {
            "uploaded": {"count": 0, "size_bytes": 0, "size_human": "0 B"},
            "archived": {"count": 0, "size_bytes": 0, "size_human": "0 B"},
            "pending": {"count": 0, "size_bytes": 0, "size_human": "0 B"},
            "in_progress": {"count": 0, "size_bytes": 0, "size_human": "0 B"},
            "trash": {"count": 0, "size_bytes": 0, "size_human": "0 B"},
            "cache": {"count": 0, "size_bytes": safe_cleanable_bytes, "size_human": format_bytes(safe_cleanable_bytes)},
            "build": {"count": 0, "size_bytes": build_cleanable_bytes, "size_human": format_bytes(build_cleanable_bytes)},
        }

        try:
            from db.session import db_session
            from db.models import SessionModel, IntakeAssetModel
            with db_session() as db:
                # Intake assets (uploaded files)
                intake_assets = db.query(IntakeAssetModel).all()
                uploaded_count = len(intake_assets)
                uploaded_bytes = sum(a.file_size or 0 for a in intake_assets)
                breakdown["uploaded"] = {
                    "count": uploaded_count,
                    "size_bytes": uploaded_bytes,
                    "size_human": format_bytes(uploaded_bytes),
                }

                # Sessions breakdown
                sessions = db.query(SessionModel).all()
                arch_count, arch_bytes = 0, 0
                pend_count, pend_bytes = 0, 0
                prog_count, prog_bytes = 0, 0
                tr_count, tr_bytes = 0, 0

                for s in sessions:
                    s_size = s.file_size_bytes or 0
                    if s.status == "trash" or s.is_trash:
                        tr_count += 1
                        tr_bytes += s_size
                    elif s.status == "archived" or s.tag == "done":
                        arch_count += 1
                        arch_bytes += s_size
                    elif s.tag == "pending":
                        pend_count += 1
                        pend_bytes += s_size
                    else:
                        prog_count += 1
                        prog_bytes += s_size

                trash_count = tr_count
                breakdown["archived"] = {"count": arch_count, "size_bytes": arch_bytes, "size_human": format_bytes(arch_bytes)}
                breakdown["pending"] = {"count": pend_count, "size_bytes": pend_bytes, "size_human": format_bytes(pend_bytes)}
                breakdown["in_progress"] = {"count": prog_count, "size_bytes": prog_bytes, "size_human": format_bytes(prog_bytes)}
                breakdown["trash"] = {"count": tr_count, "size_bytes": tr_bytes, "size_human": format_bytes(tr_bytes)}
        except Exception:
            pass

        return {
            "items": items,
            "total_bytes": total_bytes,
            "total_human": format_bytes(total_bytes),
            "safe_cleanable_bytes": safe_cleanable_bytes,
            "safe_cleanable_human": format_bytes(safe_cleanable_bytes),
            "build_cleanable_bytes": build_cleanable_bytes,
            "build_cleanable_human": format_bytes(build_cleanable_bytes),
            "total_runtime_bytes": safe_cleanable_bytes,
            "total_runtime_human": format_bytes(safe_cleanable_bytes),
            "trash_count": trash_count,
            "breakdown": breakdown,
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
        if key in ["storage_cache", "cache"]:
            p = os.path.join(BACKEND_DIR, "data", "storage", "cache")
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
        elif key in ["storage_sessions", "sessions"]:
            # Absolute Data Preservation Policy:
            # Active user sessions are inviolable and must NEVER be bulk-deleted.
            # Only prune orphaned session directories that are NOT registered in SQLite.
            p = os.path.join(BACKEND_DIR, "data", "storage", "sessions")
            if os.path.exists(p):
                try:
                    from db.session import db_session
                    from db.models import SessionModel
                    with db_session() as db:
                        active_session_ids = {s.id for s in db.query(SessionModel.id).all()}
                except Exception:
                    # If DB is not queryable, abort immediately without touching any files
                    active_session_ids = None

                if active_session_ids is not None:
                    for entry in os.scandir(p):
                        if entry.name == ".gitkeep" or entry.name in active_session_ids:
                            continue  # Strictly preserve active session data
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
        elif key in ["storage_exports", "exports"]:
            # Prune completed exports
            p = os.path.join(BACKEND_DIR, "data", "storage", "exports")
            if os.path.exists(p):
                for entry in os.scandir(p):
                    if entry.name == ".gitkeep":
                        continue
                    if entry.is_file():
                        try:
                            freed += entry.stat().st_size
                            os.remove(entry.path)
                        except OSError:
                            pass
        elif key in ["db_backups", "backups"]:
            import glob
            p = os.path.join(BACKEND_DIR, "data", "backups")
            if os.path.exists(p):
                backups = sorted(glob.glob(os.path.join(p, "flint_backup_[0-9]*.db")))
                # Always preserve at least the latest backup snapshot
                if len(backups) > 1:
                    for old_b in backups[:-1]:
                        try:
                            size = os.path.getsize(old_b)
                            os.remove(old_b)
                            freed += size
                        except OSError:
                            pass
        elif key == "session_storage":
            # Only clean disposable rendered thumbnails; never touch user sessions
            freed += StorageCleaner.clean_target("storage_cache")
        elif key in ["book_scans", "temp_uploads"]:
            p = os.path.join(BACKEND_DIR, "temp_uploads")
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
    def prune_exports(retention_days: int) -> Dict[str, Any]:
        """
        Deletes export deliverables older than retention_days.
        If retention_days <= 0, no files are deleted (retention is set to forever).
        Also prunes corresponding ExportJobModel records in SQLite if present.
        """
        if retention_days <= 0:
            return {
                "pruned_files": 0,
                "freed_bytes": 0,
                "freed_human": "0 B",
                "message": "Retention is set to permanent (0 days). No files pruned.",
            }

        cutoff_time = time.time() - (retention_days * 86400)
        exports_dir = os.path.join(BACKEND_DIR, "data", "storage", "exports")
        freed = 0
        pruned_count = 0

        if os.path.exists(exports_dir):
            for entry in os.scandir(exports_dir):
                if entry.name == ".gitkeep":
                    continue
                if entry.is_file():
                    try:
                        mtime = entry.stat().st_mtime
                        if mtime < cutoff_time:
                            size = entry.stat().st_size
                            os.remove(entry.path)
                            freed += size
                            pruned_count += 1
                    except OSError:
                        pass

        try:
            from db.session import db_session
            from db.models import ExportJobModel
            with db_session() as db:
                stale_jobs = db.query(ExportJobModel).filter(ExportJobModel.created_at < cutoff_time).all()
                for job in stale_jobs:
                    db.delete(job)
        except Exception:
            pass

        return {
            "pruned_files": pruned_count,
            "freed_bytes": freed,
            "freed_human": format_bytes(freed),
            "message": f"Successfully pruned {pruned_count} exports older than {retention_days} days ({format_bytes(freed)} freed).",
        }

    @staticmethod
    def clean(mode: Any = "safe") -> Dict[str, Any]:
        total_freed = 0
        cleaned_keys: List[str] = []

        if isinstance(mode, list):
            keys = [str(k) for k in mode]
        elif mode in ["runtime", "safe"]:
            # Only clean disposable runtime caches and scratch files.
            keys = ["storage_cache", "temp_uploads", "public_flipbooks"]
        elif mode == "build":
            keys = ["next_cache", "tauri_target"]
        elif mode == "all_safe":
            keys = ["storage_cache", "temp_uploads", "public_flipbooks", "next_cache", "tauri_target"]
        elif mode == "all":
            # Clean all disposable build/cache directories.
            keys = [t["key"] for t in STORAGE_TARGETS if t.get("safety_level") in ["safe", "build"]]
        else:
            keys = [str(mode)]

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
