from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from utils import ensure_parent_dir


def write_ndjson(path: str, record: dict[str, Any]) -> None:
    ensure_parent_dir(path)
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **record,
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
