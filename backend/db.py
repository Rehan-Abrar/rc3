from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first release. `create_all` only creates missing tables, so a
# database that already exists needs these added in place; the demo box must not have to be
# wiped to pick up a feature.
_ADDED_COLUMNS = {
    "jobs": {
        "weight_skills": "FLOAT DEFAULT 50",
        "weight_experience": "FLOAT DEFAULT 25",
        "weight_projects": "FLOAT DEFAULT 15",
        "weight_qualifications": "FLOAT DEFAULT 10",
        "scoring_version": "INTEGER DEFAULT 1",
    },
    "assessments": {
        "weights_json": "TEXT DEFAULT '{}'",
        "weights_version": "INTEGER DEFAULT 1",
    },
}


def ensure_columns() -> list[str]:
    """Add any missing columns/tables in place and return what was added (for logging)."""
    from sqlalchemy import inspect, text

    added: list[str] = []
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                added.append(f"{table}.{name}")
    return added
