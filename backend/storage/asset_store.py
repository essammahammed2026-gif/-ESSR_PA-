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

    def save_session_file(self, session_id: str, filename: str, content: bytes) -> Tuple[str, str]:
        """
        Saves an uploaded file into the session directory.
        Returns (relative_filename, absolute_path).
        """
        session_dir = self.get_session_dir(session_id)
        safe_name = os.path.basename(filename)
        dest_path = os.path.join(session_dir, safe_name)

        # Atomic write
        tmp_path = f"{dest_path}.tmp_{os.getpid()}_{int(time.time() * 1000)}"
        with open(tmp_path, "wb") as f:
            f.write(content)
        os.replace(tmp_path, dest_path)

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
