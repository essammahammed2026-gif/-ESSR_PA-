import glob
import logging
import os
import shutil
import sqlite3
import time
from contextlib import contextmanager
from typing import Generator, Optional
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.engine import Engine

logger = logging.getLogger("flint.db")

# Root directory resolution
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

SQLITE_DB_PATH = os.path.join(DATA_DIR, "flint.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{SQLITE_DB_PATH}")

# Initialize SQLite engine with robust concurrency settings
# WAL mode allows unlimited simultaneous readers while a writer writes.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
    pool_pre_ping=True,
)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA busy_timeout=15000;")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def backup_database(max_backups: int = 5) -> Optional[str]:
    """
    Creates an atomic, online hot snapshot of flint.db using SQLite's online backup API.
    Guarantees ACID consistency without locking out WAL readers or writers.
    Maintains a rolling rotation of the latest `max_backups` snapshots.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return None
    if not os.path.exists(SQLITE_DB_PATH) or os.path.getsize(SQLITE_DB_PATH) == 0:
        return None

    try:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(BACKUP_DIR, f"flint_backup_{timestamp}.db")
        latest_file = os.path.join(BACKUP_DIR, "flint_backup_latest.db")

        # Atomic online snapshot via SQLite backup API
        src_conn = sqlite3.connect(SQLITE_DB_PATH)
        dest_conn = sqlite3.connect(backup_file)
        try:
            src_conn.backup(dest_conn)
        finally:
            dest_conn.close()
            src_conn.close()

        # Update latest pointer copy
        try:
            shutil.copy2(backup_file, latest_file)
        except Exception:
            pass

        # Rolling retention: keep newest max_backups
        backups = sorted(glob.glob(os.path.join(BACKUP_DIR, "flint_backup_[0-9]*.db")))
        if len(backups) > max_backups:
            for old_b in backups[:-max_backups]:
                try:
                    os.remove(old_b)
                except OSError:
                    pass

        return backup_file
    except Exception as e:
        logger.warning(f"Database backup skipped due to error: {e}")
        return None


def init_db() -> None:
    """Create all database tables non-destructively with automated hot backup."""
    # Pre-migration automated safety snapshot
    backup_database()

    # Ensure all models are imported so Base.metadata knows about them
    import db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Strictly non-destructive migrations for existing SQLite databases
    if DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            for col_name, col_type in [
                ("tag", "VARCHAR(32) DEFAULT 'in-progress'"),
                ("notes", "TEXT"),
                ("original_filename", "VARCHAR(255)"),
                ("trash_reason", "VARCHAR(64)"),
                ("file_size_bytes", "INTEGER"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {col_name} {col_type};"))
                    conn.commit()
                except Exception:
                    pass  # column already exists

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a transactional DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def db_session() -> Generator[Session, None, None]:
    """Context manager for standalone script / background task DB sessions."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
