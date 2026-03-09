"""Run database migrations."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.init_db import run_migrations
from src.config import get_settings


def main() -> None:
    """Run migrations."""
    settings = get_settings()
    run_migrations(str(settings.state_db))


if __name__ == "__main__":
    main()
