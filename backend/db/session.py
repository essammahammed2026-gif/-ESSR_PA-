import os
from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.engine import Engine

# Root directory resolution
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

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

def init_db() -> None:
    """Create all database tables if they do not exist."""
    # Ensure all models are imported so Base.metadata knows about them
    import db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

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
