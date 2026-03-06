from __future__ import annotations

from pathlib import Path
import json


def read_json_file(path: str | Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_parent_dir(path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
