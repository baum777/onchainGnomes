from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL = os.getenv("OPENAI_MODEL", "gpt-5")
TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))


@dataclass
class LLMResult:
    text: str
    latency_ms: int
    usage: dict[str, Any] | None
    raw_model: str | None


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=TIMEOUT_SECONDS)


def ask_llm(user_input: str, system_prompt: str | None = None) -> LLMResult:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_input})

    started = time.perf_counter()
    response = client.responses.create(
        model=MODEL,
        input=messages,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    usage = None
    if getattr(response, "usage", None) is not None:
        usage = {
            "input_tokens": getattr(response.usage, "input_tokens", None),
            "output_tokens": getattr(response.usage, "output_tokens", None),
            "total_tokens": getattr(response.usage, "total_tokens", None),
        }

    return LLMResult(
        text=(response.output_text or "").strip(),
        latency_ms=latency_ms,
        usage=usage,
        raw_model=getattr(response, "model", None),
    )
