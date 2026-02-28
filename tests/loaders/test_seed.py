"""Tests for seed module (mulberry32 PRNG)."""

import pytest

from src.loaders.seed import seed_from_string, mulberry32


class TestSeedFromString:
    """Test suite for seed_from_string function."""

    def test_determinism(self):
        """Test that same string produces same seed."""
        seed1 = seed_from_string("test_string")
        seed2 = seed_from_string("test_string")
        assert seed1 == seed2

    def test_different_strings_produce_different_seeds(self):
        """Test that different strings produce different seeds."""
        seed1 = seed_from_string("string_a")
        seed2 = seed_from_string("string_b")
        assert seed1 != seed2

    def test_returns_32_bit_integer(self):
        """Test that seed is a valid 32-bit unsigned integer."""
        seed = seed_from_string("any_string")
        assert isinstance(seed, int)
        assert 0 <= seed <= 2**32 - 1

    def test_unicode_handling(self):
        """Test that unicode strings work."""
        seed1 = seed_from_string("unicode: äöü")
        seed2 = seed_from_string("unicode: äöü")
        assert seed1 == seed2


class TestMulberry32:
    """Test suite for mulberry32 PRNG."""

    def test_returns_float_between_0_and_1(self):
        """Test that RNG returns values in [0, 1)."""
        rng = mulberry32(12345)

        for _ in range(1000):
            value = rng()
            assert 0.0 <= value < 1.0

    def test_determinism(self):
        """Test that same seed produces same sequence."""
        rng1 = mulberry32(12345)
        rng2 = mulberry32(12345)

        for _ in range(100):
            assert rng1() == rng2()

    def test_different_seeds_produce_different_sequences(self):
        """Test that different seeds produce different sequences."""
        rng1 = mulberry32(12345)
        rng2 = mulberry32(54321)

        values1 = [rng1() for _ in range(10)]
        values2 = [rng2() for _ in range(10)]

        assert values1 != values2

    def test_distribution(self):
        """Test that values are reasonably distributed."""
        rng = mulberry32(12345)

        # Generate many values and check distribution
        values = [rng() for _ in range(10000)]

        # Check that values span the range
        assert min(values) < 0.1
        assert max(values) > 0.9

        # Check that mean is roughly 0.5
        mean = sum(values) / len(values)
        assert 0.45 < mean < 0.55

    def test_sequence_length(self):
        """Test that we can generate many values."""
        rng = mulberry32(12345)

        # Should be able to generate many values without issues
        values = [rng() for _ in range(100000)]
        assert len(values) == 100000
        assert len(set(values)) > 90000  # Most values should be unique


class TestIntegration:
    """Integration tests for seed + PRNG."""

    def test_full_deterministic_pipeline(self):
        """Test the full pipeline: string -> seed -> sequence."""
        input_string = "tweet_id_12345"

        # Generate seed from string
        seed = seed_from_string(input_string)

        # Create RNG
        rng = mulberry32(seed)

        # Generate sequence
        sequence = [rng() for _ in range(10)]

        # Repeat and verify same sequence
        seed2 = seed_from_string(input_string)
        rng2 = mulberry32(seed2)
        sequence2 = [rng2() for _ in range(10)]

        assert sequence == sequence2
