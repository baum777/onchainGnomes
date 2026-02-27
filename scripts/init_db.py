"""Initialize the SQLite database with migrations."""

import asyncio
import sqlite3
from pathlib import Path

# Add project root to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))


def get_migrations_dir() -> Path:
    """Get migrations directory path."""
    return Path(__file__).parent.parent / "src" / "state" / "migrations"


def run_migrations(db_path: str) -> None:
    """Run all SQL migrations in order."""
    db = Path(db_path)
    db.parent.mkdir(parents=True, exist_ok=True)

    migrations_dir = get_migrations_dir()
    migration_files = sorted(migrations_dir.glob("*.sql"))

    conn = sqlite3.connect(str(db))
    try:
        # Create migrations tracking table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        for migration_file in migration_files:
            name = migration_file.name
            cursor = conn.execute(
                "SELECT 1 FROM _migrations WHERE name = ?",
                (name,),
            )
            if cursor.fetchone():
                continue

            sql = migration_file.read_text()
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO _migrations (name) VALUES (?)",
                (name,),
            )
            print(f"Applied migration: {name}")

        conn.commit()
    finally:
        conn.close()


def main() -> None:
    """Run database initialization."""
    from src.config import get_settings

    settings = get_settings()
    db_path = settings.state_db

    print(f"Initializing database at {db_path}")
    run_migrations(str(db_path))
    print("Database initialized successfully")


if __name__ == "__main__":
    main()
