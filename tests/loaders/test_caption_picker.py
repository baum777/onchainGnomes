"""Tests for caption_picker module."""

from pathlib import Path

import pytest

from src.loaders.caption_picker import pick_caption, PickCaptionArgs, normalize_bank
from src.loaders.dataset_loader import DatasetLoader


class TestNormalizeBank:
    """Test suite for normalize_bank function."""

    def test_captions_default(self):
        """Test default is captions."""
        assert normalize_bank(None) == "captions"
        assert normalize_bank("captions") == "captions"

    def test_roast_replies(self):
        """Test roast_replies normalization."""
        assert normalize_bank("roast_replies") == "roast_replies"


class TestPickCaption:
    """Test suite for pick_caption function."""

    @pytest.fixture
    def loader(self, tmp_path: Path):
        """Create a DatasetLoader with test data."""
        captions_file = tmp_path / "captions.txt"
        captions_file.write_text("Caption A\nCaption B\nCaption C\nCaption D\n")
        return DatasetLoader(datasets_dir=str(tmp_path))

    def test_determinism(self, loader: DatasetLoader):
        """Test that same seed produces same result."""
        args = PickCaptionArgs(
            dataset_loader=loader,
            bank="captions",
            seed_key="test_seed_123"
        )

        caption1 = pick_caption(args)
        caption2 = pick_caption(args)

        assert caption1 == caption2

    def test_returns_string(self, loader: DatasetLoader):
        """Test that pick_caption returns a string."""
        args = PickCaptionArgs(
            dataset_loader=loader,
            seed_key="test"
        )

        caption = pick_caption(args)
        assert isinstance(caption, str)
        assert len(caption) > 0
