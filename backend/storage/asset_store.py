import os
import shutil
import time
from typing import Any, Dict, Optional, Tuple

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_STORAGE_ROOT = os.path.join(BACKEND_DIR, "data", "storage")


class AssetStore:
    """
    Centralized Asset & Blob Storage Manager.
    Keeps large PDF files, rendered thumbnail caches, and print exports organized
    on the filesystem with deduplication, atomic writes, and safe cleanup.
    """

    def __init__(self, root_dir: Optional[str] = None):
        self.root = root_dir or os.environ.get("FLINT_STORAGE_DIR", DEFAULT_STORAGE_ROOT)
        self.originals_dir = os.path.join(self.root, "originals")
        self.cache_dir = os.path.join(self.root, "cache")
        self.exports_dir = os.path.join(self.root, "exports")
        self.sessions_dir = os.path.join(self.root, "sessions")

        # Ensure directory structures exist
        for d in [self.originals_dir, self.cache_dir, self.exports_dir, self.sessions_dir]:
            os.makedirs(d, exist_ok=True)

    def get_session_dir(self, session_id: str) -> str:
        """Returns the isolated working directory for a session."""
        path = os.path.join(self.sessions_dir, session_id)
        os.makedirs(path, exist_ok=True)
        return path

    def save_file_stream(self, dest_path: str, file_obj: Any) -> str:
        """Atomically saves content from a file-like object or bytes to dest_path."""
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        tmp_path = f"{dest_path}.tmp_{os.getpid()}_{int(time.time() * 1000)}"
        with open(tmp_path, "wb") as f:
            if hasattr(file_obj, "read"):
                shutil.copyfileobj(file_obj, f)
            elif isinstance(file_obj, bytes):
                f.write(file_obj)
            else:
                f.write(bytes(file_obj))
        os.replace(tmp_path, dest_path)
        return dest_path

    def save_session_file(self, session_id: str, filename: str, content: Any) -> Tuple[str, str]:
        """
        Saves an uploaded or generated file into the session directory.
        Returns (relative_filename, absolute_path).
        """
        session_dir = self.get_session_dir(session_id)
        safe_name = os.path.basename(filename)
        dest_path = os.path.join(session_dir, safe_name)
        self.save_file_stream(dest_path, content)
        return safe_name, dest_path

    def save_original(self, filename: str, content: Any) -> Tuple[str, str]:
        """
        Saves an immutable raw uploaded artwork or scan into originals_dir.
        Returns (safe_filename, absolute_path).
        """
        safe_name = os.path.basename(filename)
        dest_path = os.path.join(self.originals_dir, safe_name)
        self.save_file_stream(dest_path, content)
        return safe_name, dest_path

    def get_thumbnail_cache_path(self, session_id: str, cache_tag: str) -> str:
        """Returns disk cache path for a rendered thumbnail."""
        sess_cache = os.path.join(self.cache_dir, session_id)
        os.makedirs(sess_cache, exist_ok=True)
        return os.path.join(sess_cache, f"{cache_tag}.jpg")

    def get_export_path(self, job_id: str, ext: str = "pdf") -> str:
        """Returns the destination file path for a generated export."""
        clean_ext = ext.lstrip(".")
        return os.path.join(self.exports_dir, f"{job_id}.{clean_ext}")

    def purge_session(self, session_id: str) -> int:
        """Deletes session working files and cached thumbnails, returning freed bytes."""
        freed = 0
        s_dir = os.path.join(self.sessions_dir, session_id)
        if os.path.exists(s_dir):
            for entry in os.scandir(s_dir):
                if entry.is_file():
                    freed += entry.stat().st_size
            shutil.rmtree(s_dir, ignore_errors=True)

        c_dir = os.path.join(self.cache_dir, session_id)
        if os.path.exists(c_dir):
            for entry in os.scandir(c_dir):
                if entry.is_file():
                    freed += entry.stat().st_size
            shutil.rmtree(c_dir, ignore_errors=True)

        return freed

    def clear_cache(self) -> int:
        """Purges all rendered thumbnail caches without touching originals, sessions, or exports."""
        freed = 0
        if os.path.exists(self.cache_dir):
            for entry in os.scandir(self.cache_dir):
                if entry.name == ".gitkeep":
                    continue
                if entry.is_dir():
                    size = sum(f.stat().st_size for f in os.scandir(entry.path) if f.is_file())
                    shutil.rmtree(entry.path, ignore_errors=True)
                    freed += size
                elif entry.is_file():
                    freed += entry.stat().st_size
                    try:
                        os.remove(entry.path)
                    except OSError:
                        pass
        return freed

    def resolve_asset_file(self, file_id_or_name: str, session_id: Optional[str] = None) -> Optional[str]:
        """
        Locates an asset file across storage tiers:
        1. Specific session folder (if session_id provided)
        2. Originals storage
        3. Any session folder
        4. Legacy temp_uploads (migration fallback)
        """
        if not file_id_or_name:
            return None

        # Direct absolute/relative path check
        if os.path.isfile(file_id_or_name):
            return os.path.abspath(file_id_or_name)

        safe_name = os.path.basename(file_id_or_name)

        # 1. Target session dir
        if session_id:
            candidate = os.path.join(self.sessions_dir, session_id, safe_name)
            if os.path.isfile(candidate):
                return candidate

        # 2. Originals
        candidate = os.path.join(self.originals_dir, safe_name)
        if os.path.isfile(candidate):
            return candidate

        # 2b. Check with standard extensions in originals
        for ext in [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tiff"]:
            cand_ext = os.path.join(self.originals_dir, f"{safe_name}{ext}")
            if os.path.isfile(cand_ext):
                return cand_ext

        # 3. Scan session directories
        if os.path.exists(self.sessions_dir):
            for s_entry in os.scandir(self.sessions_dir):
                if s_entry.is_dir():
                    cand = os.path.join(s_entry.path, safe_name)
                    if os.path.isfile(cand):
                        return cand

        # 4. Fallback to temp_uploads (legacy migration safety)
        legacy_dir = os.path.join(BACKEND_DIR, "temp_uploads")
        if os.path.exists(legacy_dir):
            cand = os.path.join(legacy_dir, safe_name)
            if os.path.isfile(cand):
                return cand
            for ext in [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tiff"]:
                cand_ext = os.path.join(legacy_dir, f"{safe_name}{ext}")
                if os.path.isfile(cand_ext):
                    return cand_ext

        return None

    def get_stats(self) -> Dict[str, Any]:
        """Computes current storage consumption across originals, cache, and exports."""
        def dir_size(path: str) -> Tuple[int, int]:
            total = 0
            count = 0
            if os.path.exists(path):
                for root, _, files in os.walk(path):
                    for f in files:
                        p = os.path.join(root, f)
                        try:
                            total += os.path.getsize(p)
                            count += 1
                        except OSError:
                            pass
            return total, count

        sess_size, sess_count = dir_size(self.sessions_dir)
        cache_size, cache_count = dir_size(self.cache_dir)
        export_size, export_count = dir_size(self.exports_dir)

        return {
            "root": self.root,
            "sessions": {"bytes": sess_size, "files": sess_count},
            "cache": {"bytes": cache_size, "files": cache_count},
            "exports": {"bytes": export_size, "files": export_count},
            "total_bytes": sess_size + cache_size + export_size,
        }


# Global default instance
asset_store = AssetStore()
