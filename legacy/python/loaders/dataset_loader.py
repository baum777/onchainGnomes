"""Dataset loader for text files (captions, example tweets, roast replies)."""

from pathlib import Path
from typing import Dict, List, Literal, Optional

DatasetKey = Literal["captions", "example_tweets", "roast_replies"]


class DatasetLoader:
    """
    Loads and caches text datasets from the prompts/datasets directory.

    Each dataset is a text file with one entry per line.
    Lines starting with # are treated as comments and filtered out.
    Empty lines are also filtered.
    """

    DEFAULT_FILES: Dict[DatasetKey, str] = {
        "captions": "captions.txt",
        "example_tweets": "example_tweets.txt",
        "roast_replies": "roast_replies.txt",
    }

    def __init__(self, datasets_dir: str, file_map: Optional[Dict[DatasetKey, str]] = None):
        """
        Initialize the dataset loader.

        Args:
            datasets_dir: Base directory containing dataset files
            file_map: Optional override mapping of dataset keys to filenames
        """
        self.datasets_dir = Path(datasets_dir)
        self.file_map = file_map or {}
        self._cache: Dict[DatasetKey, List[str]] = {}

    def _resolve_file(self, key: DatasetKey) -> Path:
        """Resolve the file path for a dataset key."""
        mapped = self.file_map.get(key)
        if mapped:
            path = Path(mapped)
            return path if path.is_absolute() else self.datasets_dir / path
        return self.datasets_dir / self.DEFAULT_FILES[key]

    def load(self, key: DatasetKey) -> List[str]:
        """
        Load a dataset by key. Results are cached.

        Args:
            key: One of 'captions', 'example_tweets', 'roast_replies'

        Returns:
            List of non-empty, non-comment lines from the dataset file

        Raises:
            FileNotFoundError: If the dataset file doesn't exist
            ValueError: If the dataset is empty
        """
        if key in self._cache:
            return self._cache[key]

        file_path = self._resolve_file(key)

        if not file_path.exists():
            raise FileNotFoundError(f'Dataset "{key}" not found at {file_path}')

        raw = file_path.read_text(encoding="utf-8")
        lines = [
            line.strip()
            for line in raw.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]

        if not lines:
            raise ValueError(f'Dataset "{key}" is empty ({file_path})')

        self._cache[key] = lines
        return lines

    def warm(self) -> None:
        """Pre-load all known datasets into cache."""
        for key in self.DEFAULT_FILES.keys():
            try:
                self.load(key)
            except (FileNotFoundError, ValueError):
                pass  # Ignore missing/empty datasets during warm-up

    def clear(self) -> None:
        """Clear the cache."""
        self._cache.clear()

    def is_cached(self, key: DatasetKey) -> bool:
        """Check if a dataset is currently cached."""
        return key in self._cache
