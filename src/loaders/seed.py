"""Deterministic seed generation and PRNG (Python port of TypeScript seed.ts)."""

import hashlib
import struct
from typing import Callable


def seed_from_string(input_str: str) -> int:
    """Generate a 32-bit seed from a string using SHA256."""
    h = hashlib.sha256(input_str.encode("utf-8")).digest()
    # Read first 4 bytes as unsigned 32-bit integer (big-endian)
    return struct.unpack(">I", h[:4])[0]


RNG = Callable[[], float]  # Returns float in [0, 1)


def mulberry32(seed: int) -> RNG:
    """
    Mulberry32 PRNG - fast, high-quality 32-bit random number generator.
    Returns values in [0, 1).

    Ported from TypeScript implementation.
    """
    a = seed & 0xFFFFFFFF  # Ensure unsigned 32-bit

    def rng() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = (a ^ (a >> 15)) * (1 | a)
        t = (t + ((t ^ (t >> 7)) * (61 | t))) & 0xFFFFFFFF
        result = (t ^ (t >> 14)) & 0xFFFFFFFF
        return result / 4294967296.0

    return rng
