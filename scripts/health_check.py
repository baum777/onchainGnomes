"""Health check script for the agent system."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


async def check_db() -> bool:
    """Check database connectivity."""
    try:
        from src.state.manager import StateManager
        from src.config import get_settings

        settings = get_settings()
        mgr = StateManager(str(settings.state_db))
        await mgr.connect()
        await mgr.close()
        return True
    except Exception as e:
        print(f"DB check failed: {e}")
        return False


async def check_x_api() -> bool:
    """Check X API connectivity (optional - may fail without credentials)."""
    try:
        from src.clients.x_client import XClient
        from src.config import get_settings

        settings = get_settings()
        if not settings.x_api_key:
            return True  # Skip if not configured
        # Don't actually call API - just check client init
        client = XClient()
        return client is not None
    except Exception as e:
        print(f"X API check: {e}")
        return False


async def check_xai_api() -> bool:
    """Check xAI API (optional - may fail without credentials)."""
    try:
        from src.clients.xai_client import XAIClient
        from src.config import get_settings

        settings = get_settings()
        if not settings.xai_api_key:
            return True  # Skip if not configured
        client = XAIClient()
        return client is not None
    except Exception as e:
        print(f"xAI check: {e}")
        return False


async def main() -> int:
    """Run health checks."""
    checks = {
        "database": await check_db(),
        "x_api": await check_x_api(),
        "xai_api": await check_xai_api(),
    }
    all_ok = all(checks.values())
    for name, ok in checks.items():
        print(f"  {name}: {'OK' if ok else 'FAIL'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
